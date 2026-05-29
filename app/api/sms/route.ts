import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function POST(req: NextRequest) {
  const { to, message } = await req.json()
  if (!to || !message) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })

  try {
    const msg = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to
    })
    return NextResponse.json({ sid: msg.sid })
  } catch (err: any) {
    console.error('SMS error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
