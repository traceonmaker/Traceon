import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Tarif abonnement TraceOn — 250€/mois
export const PRICE_ID = 'price_1TcSJNAccwoyUYrn0HQYe2mV'
export const TRIAL_DAYS = 7
