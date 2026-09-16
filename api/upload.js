import { issueSignedToken, presignUrl } from '@vercel/blob'

const APK_TYPES = new Set([
  'application/vnd.android.package-archive',
  'application/octet-stream',
  '',
])

function safeFilename(name) {
  const base = String(name || 'app.apk').split(/[/\\]/).pop() || 'app.apk'
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '-')
  return cleaned.toLowerCase().endsWith('.apk') ? cleaned : `${cleaned}.apk`
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not available in this deployment.')
  return token
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = await request.json()
    const configuredKey = (process.env.ADMIN_UPLOAD_KEY || '').trim()
    const suppliedKey = String(body.adminKey || '').trim()

    if (!configuredKey || !suppliedKey || configuredKey !== suppliedKey) {
      return response.status(401).json({ error: 'Unauthorized' })
    }

    const filename = safeFilename(body.filename)
    const contentType = String(body.contentType || 'application/vnd.android.package-archive')
    const size = Number(body.size || 0)

    if (!filename.toLowerCase().endsWith('.apk')) {
      return response.status(400).json({ error: 'Only .apk files are allowed.' })
    }

    if (!APK_TYPES.has(contentType)) {
      return response.status(400).json({ error: 'Invalid APK content type.' })
    }

    if (!Number.isFinite(size) || size <= 0 || size > 1024 * 1024 * 1024) {
      return response.status(400).json({ error: 'APK must be between 1 byte and 1 GB.' })
    }

    const pathname = `apks/${Date.now()}-${filename}`
    const validUntil = Date.now() + 15 * 60 * 1000
    const token = await issueSignedToken({
      token: blobToken(),
      pathname,
      operations: ['put'],
      validUntil,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: size,
    })

    const { presignedUrl } = await presignUrl(token, {
      pathname,
      operation: 'put',
      access: 'private',
      validUntil,
    })

    return response.status(200).json({ pathname, presignedUrl, validUntil })
  } catch (error) {
    console.error('Blob signed upload URL error:', error)
    return response.status(500).json({ error: error?.message || 'Could not create upload URL' })
  }
}
