import { issueSignedToken, presignUrl } from '@vercel/blob'

const FILE_RULES = {
  APK: { extensions: ['.apk'], contentTypes: ['application/vnd.android.package-archive', 'application/octet-stream', ''] },
  EXE: { extensions: ['.exe'], contentTypes: ['application/vnd.microsoft.portable-executable', 'application/x-msdownload', 'application/octet-stream', ''] },
  Extension: { extensions: ['.zip', '.crx', '.xpi'], contentTypes: ['application/zip', 'application/x-zip-compressed', 'application/x-chrome-extension', 'application/x-xpinstall', 'application/octet-stream', ''] },
}

function safeFilename(name) {
  const base = String(name || 'file').split(/[/\\]/).pop() || 'file'
  return base.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function getRule(filename) {
  const lower = filename.toLowerCase()
  return Object.values(FILE_RULES).find((rule) => rule.extensions.some((extension) => lower.endsWith(extension)))
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not available in this deployment.')
  return token
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

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })

  try {
    const body = parseRequestBody(request)
    const configuredKey = (process.env.ADMIN_UPLOAD_KEY || '').trim()
    const suppliedKey = String(body.adminKey || '').trim()
    if (!configuredKey || !suppliedKey || configuredKey !== suppliedKey) return response.status(401).json({ error: 'Unauthorized' })

    const filename = safeFilename(body.filename)
    const contentType = String(body.contentType || 'application/octet-stream')
    const size = Number(body.size || 0)
    const rule = getRule(filename)

    if (!rule) return response.status(400).json({ error: 'Unsupported file. Use APK, EXE, or ZIP/CRX/XPI browser extension files.' })
    if (!rule.contentTypes.includes(contentType)) return response.status(400).json({ error: 'Invalid file content type.' })
    if (!Number.isFinite(size) || size <= 0 || size > 1024 * 1024 * 1024) return response.status(400).json({ error: 'File must be between 1 byte and 1 GB.' })

    const pathname = `files/${Date.now()}-${filename}`
    const validUntil = Date.now() + 15 * 60 * 1000
    const signedToken = await issueSignedToken({ token: blobToken(), pathname, operations: ['put'], validUntil, allowedContentTypes: [contentType], maximumSizeInBytes: size })
    const { presignedUrl } = await presignUrl(signedToken, { pathname, operation: 'put', access: 'private', validUntil, allowedContentTypes: [contentType], maximumSizeInBytes: size })

    return response.status(200).json({ pathname, presignedUrl, validUntil })
  } catch (error) {
    console.error('Blob signed upload URL error:', error)
    return response.status(500).json({ error: error?.message || 'Could not create upload URL' })
  }
}
