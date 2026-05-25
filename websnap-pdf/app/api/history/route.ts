import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getSignedUrl } from '@/lib/storage'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const conversions = await prisma.conversion.findMany({
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
  })

  // Attach signed URLs for stored PDFs
  const items = await Promise.all(
    conversions.map(async (c: typeof conversions[number]) => {
      let downloadUrl: string | null = null
      if (c.storagePath) {
        try {
          downloadUrl = await getSignedUrl(c.storagePath)
        } catch {
          // expired or deleted
        }
      }
      return { ...c, downloadUrl }
    })
  )

  return Response.json({ items })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await request.json() as { id: string }

  await prisma.conversion.deleteMany({
    where: { id, userId: session.user.id },
  })

  return Response.json({ ok: true })
}
