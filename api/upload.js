import { supabase, STORAGE_BUCKET } from './_supabase.js'

const MAX_FILE_SIZE = 1024 * 1024 * 1024

function safeFilename(name) {
  return (String(name || 'file').split(/[/\\]/).pop() || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
}

function parseRequestBody(request) {
  const body = request?.body
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body
  if (typeof body === 'string') {
    try { return JSON.parse(body) } catch { throw new Error('Invalid JSON request body.') }
  }
  if (Buffer.isBuffer(body)) {
    try { return JSON.parse(body.toString('utf8')) } catch { throw new Error('Invalid JSON request body.') }
  }
  throw new Error('Request body is missing.')
}

function authorized(body) {
  const configured = String(process.env.ADMIN_UPLOAD_KEY || '').trim()
  const supplied = String(body.adminKey || '').trim()
  return Boolean(configured && supplied && configured === supplied)
}

async function verifyFile(pathname, expectedSize, expectedContentType) {
  if (!pathname.startsWith('files/')) throw new Error('Invalid file path.')

  const filename = pathname.slice('files/'.length)
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list('files', { limit: 100, search: filename })

  if (error) throw new Error(error.message)

  const file = (data || []).find((item) => item.name === filename)
  if (!file) return { verified: false, reason: 'File was not found in Supabase Storage.' }

  const metadata = file.metadata || {}
  const actualSize = Number(metadata.size ?? 0)
  const actualType = String(metadata.mimetype || metadata.contentType || '')

  if (expectedSize > 0 && actualSize > 0 && actualSize !== expectedSize) {
    return { verified: false, reason: 'Uploaded file size does not match.' }
  }

  if (expectedContentType && actualType && actualType !== expectedContentType) {
    return { verified: false, reason: 'Uploaded file content type does not match.' }
  }

  const { data: publicData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(pathname, { download: true })

  return {
    verified: true,
    pathname,
    size: actualSize || expectedSize,
    contentType: actualType || expectedContentType,
    publicUrl: publicData.publicUrl,
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })

  try {
    const body = parseRequestBody(request)
    if (!authorized(body)) return response.status(401).json({ error: 'Unauthorized' })

    if (body.action === 'verify') {
      const pathname = String(body.pathname || '').trim()
      const result = await verifyFile(
        pathname,
        Number(body.size || 0),
        String(body.contentType || '')
      )

      if (!result.verified) return response.status(400).json({ error: result.reason || 'Upload verification failed.' })
      return response.status(200).json(result)
    }

    const filename = safeFilename(body.filename)
    const contentType = String(body.contentType || 'application/octet-stream')
    const size = Number(body.size || 0)

    if (!filename) return response.status(400).json({ error: 'A filename is required.' })
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
      return response.status(400).json({ error: 'File must be between 1 byte and 1 GB.' })
    }

    const filePath = `files/${Date.now()}-${filename}`
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(filePath, { upsert: false })

    if (error) throw new Error(error.message)
    if (!data?.token || !data?.path) throw new Error('Supabase did not return a signed upload token.')

    const { data: publicData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path, { download: true })

    return response.status(200).json({
      pathname: data.path,
      token: data.token,
      signedUrl: data.signedUrl || '',
      publicUrl: publicData.publicUrl,
    })
  } catch (error) {
    console.error('Supabase upload error:', error)
    return response.status(500).json({ error: error?.message || 'Could not process upload' })
  }
}
