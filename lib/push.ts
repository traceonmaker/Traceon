import webpush from 'web-push'

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIV = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@traceon.app'

let configured = false
function ensure() {
  if (configured) return true
  if (!PUB || !PRIV) return false
  webpush.setVapidDetails(SUBJECT, PUB, PRIV)
  configured = true
  return true
}

type Payload = { title: string; body?: string; url?: string; tag?: string }

// Envoie une notif à toutes les souscriptions ; renvoie les endpoints morts (à purger)
export async function sendPush(subs: any[], payload: Payload): Promise<string[]> {
  if (!ensure() || !Array.isArray(subs) || subs.length === 0) return []
  const dead: string[] = []
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, JSON.stringify(payload))
      } catch (e: any) {
        const code = e?.statusCode
        if (code === 404 || code === 410) dead.push(s?.endpoint)
      }
    })
  )
  return dead
}
