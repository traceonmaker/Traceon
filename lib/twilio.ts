import twilio from 'twilio'

// Client Twilio partagé (null si non configuré)
export function twilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const tok = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !tok) return null
  return twilio(sid, tok)
}

/**
 * Provisionne automatiquement un numéro TraceOn dédié pour un nouvel artisan
 * et y câble le webhook Voice (capture d'appel manqué → SMS).
 *
 * Sécurité : ne fait RIEN tant que TWILIO_AUTO_PROVISION !== '1'
 * (un numéro est payant ~1$/mois → on n'achète jamais par accident, ni en démo/test).
 *
 * Retourne le numéro E.164 acheté, ou null si désactivé / indisponible / erreur.
 * Best-effort : ne doit jamais faire échouer l'onboarding.
 */
export async function provisionTraceOnNumber(): Promise<string | null> {
  if (process.env.TWILIO_AUTO_PROVISION !== '1') return null

  const client = twilioClient()
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!client || !base) return null

  const country = process.env.TWILIO_NUMBER_COUNTRY || 'FR'
  // Twilio ne vend PAS de mobile FR -> on prend du "local" (+33 9...), parfait comme
  // cible de renvoi (le client ne le voit jamais, il appelle le numero de l'artisan).
  const type = (process.env.TWILIO_NUMBER_TYPE || 'local').toLowerCase()
  const bundleSid = process.env.TWILIO_FR_BUNDLE_SID    // bundle réglementaire FR (1 fois sur le compte)
  const addressSid = process.env.TWILIO_FR_ADDRESS_SID

  try {
    // 1. Chercher un numéro disponible (voix + SMS)
    const opts = { limit: 1, voiceEnabled: true, smsEnabled: true }
    const dispo = type === 'local'
      ? await client.availablePhoneNumbers(country).local.list(opts)
      : await client.availablePhoneNumbers(country).mobile.list(opts)
    const candidat = dispo[0]?.phoneNumber
    if (!candidat) return null

    // 2. Acheter + câbler le webhook Voice
    //    (pas de statusCallback ici : le <Dial action> de /api/voice/incoming
    //     déclenche déjà /api/voice/status — éviter un double traitement)
    const cree = await client.incomingPhoneNumbers.create({
      phoneNumber: candidat,
      voiceUrl: `${base}/api/voice/incoming`,
      voiceMethod: 'POST',
      ...(bundleSid ? { bundleSid } : {}),
      ...(addressSid ? { addressSid } : {}),
    })
    return cree.phoneNumber || null
  } catch (e) {
    console.error('Provisioning Twilio:', (e as { message?: string })?.message)
    return null
  }
}
