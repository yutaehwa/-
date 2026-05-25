import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return Response.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (userId && session.customer && session.subscription) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: 'PRO',
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
        })
        // Extend existing conversions to 1 year for Pro users
        await prisma.conversion.updateMany({
          where: { userId },
          data: { expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
        })
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await prisma.user.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { plan: 'FREE', stripeSubscriptionId: null },
      })
      break
    }
  }

  return Response.json({ received: true })
}
