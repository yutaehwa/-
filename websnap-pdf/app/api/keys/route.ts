import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/api-key'

const MAX_KEYS = 5

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, lastUsed: true, createdAt: true },
  })

  return Response.json({ keys })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { name } = await request.json() as { name: string }
  if (!name?.trim()) {
    return Response.json({ error: 'API 키 이름을 입력해 주세요.' }, { status: 400 })
  }

  const count = await prisma.apiKey.count({ where: { userId: session.user.id } })
  if (count >= MAX_KEYS) {
    return Response.json({ error: `API 키는 최대 ${MAX_KEYS}개까지 생성할 수 있습니다.` }, { status: 400 })
  }

  const { key, prefix, hash } = generateApiKey()

  await prisma.apiKey.create({
    data: { userId: session.user.id, name: name.trim(), keyHash: hash, prefix },
  })

  // Return the raw key only once
  return Response.json({ key, prefix, name: name.trim() }, { status: 201 })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await request.json() as { id: string }

  await prisma.apiKey.deleteMany({ where: { id, userId: session.user.id } })

  return Response.json({ ok: true })
}
