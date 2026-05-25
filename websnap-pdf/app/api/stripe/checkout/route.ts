import { auth } from '@/auth'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  try {
    const url = await createCheckoutSession(session.user.id, session.user.email)
    return Response.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : '결제 세션 생성 실패'
    return Response.json({ error: message }, { status: 500 })
  }
}
