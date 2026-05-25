import { prisma } from './prisma'

const FREE_DAILY_LIMIT = 5

export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; total: number }> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })

  if (user?.plan === 'PRO') {
    return { allowed: true, remaining: Infinity, total: Infinity }
  }

  const count = await prisma.conversion.count({
    where: {
      userId,
      createdAt: { gte: startOfDay },
    },
  })

  const remaining = Math.max(0, FREE_DAILY_LIMIT - count)
  return {
    allowed: count < FREE_DAILY_LIMIT,
    remaining,
    total: FREE_DAILY_LIMIT,
  }
}
