import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export async function createCheckoutSession(userId: string, userEmail: string): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: userEmail,
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    metadata: { userId },
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/dashboard`,
  })

  return session.url!
}

export async function createPortalSession(stripeCustomerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/dashboard`,
  })

  return session.url
}
