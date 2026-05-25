import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createPortalSession } from '@/lib/stripe'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  })

  if (!user?.stripeCustomerId) {
    return Response.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  try {
    const url = await createPortalSession(user.stripeCustomerId)
    return Response.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : '포털 세션 생성 실패'
    return Response.json({ error: message }, { status: 500 })
  }
}
