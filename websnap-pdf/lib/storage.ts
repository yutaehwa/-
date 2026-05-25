import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = process.env.SUPABASE_BUCKET || 'websnap-pdfs'

export async function uploadPdf(
  userId: string,
  conversionId: string,
  buffer: Buffer
): Promise<string> {
  const path = `${userId}/${conversionId}.pdf`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  return path
}

export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data) throw new Error('Failed to create signed URL')

  return data.signedUrl
}

export async function deletePdf(storagePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath])
}
