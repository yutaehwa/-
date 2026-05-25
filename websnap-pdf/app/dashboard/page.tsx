import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardClient from './DashboardClient'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/')

  const { upgraded } = await searchParams

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, email: true, name: true, image: true },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [conversions, todayCount] = await Promise.all([
    prisma.conversion.findMany({
      where: {
        userId: session.user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        url: true,
        title: true,
        format: true,
        createdAt: true,
        storagePath: true,
        expiresAt: true,
      },
    }),
    prisma.conversion.count({
      where: { userId: session.user.id, createdAt: { gte: today } },
    }),
  ])

  return (
    <DashboardClient
      user={{
        id: session.user.id,
        name: user?.name ?? session.user.name ?? null,
        email: user?.email ?? session.user.email ?? null,
        image: user?.image ?? session.user.image ?? null,
        plan: user?.plan ?? 'FREE',
      }}
      conversions={conversions.map((c: (typeof conversions)[number]) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        expiresAt: c.expiresAt?.toISOString() ?? null,
      }))}
      todayCount={todayCount}
      justUpgraded={upgraded === 'true'}
    />
  )
}
