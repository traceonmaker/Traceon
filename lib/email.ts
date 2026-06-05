// Envoi d'email transactionnel via Resend (fallback du SMS).
// Graceful : si RESEND_API_KEY n'est pas configurée, on ne fait rien (le SMS reste le canal principal).
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'TraceOn <onboarding@resend.dev>'
  if (!key || !to) return false
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })
    return r.ok
  } catch {
    return false
  }
}

// Petit gabarit HTML sobre aux couleurs TraceOn
export function emailLayout(titre: string, corps: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Inter,sans-serif;max-width:480px;margin:0 auto;padding:28px 24px;color:#0c1424">
    <div style="font-size:20px;font-weight:800;color:#1d5fed;letter-spacing:-.02em;margin-bottom:16px">TraceOn</div>
    <h1 style="font-size:19px;font-weight:800;margin:0 0 10px">${titre}</h1>
    <div style="font-size:15px;line-height:1.6;color:#3d4a5c">${corps}</div>
    <p style="font-size:12px;color:#8a94a3;margin-top:24px;border-top:1px solid #e9edf3;padding-top:14px">Votre business, sous contrôle.</p>
  </div>`
}
