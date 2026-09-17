import { issueSignedToken, presignUrl } from '@vercel/blob'

const FILE_RULES = {
  APK: { extensions: ['.apk'], contentTypes: ['application/vnd.android.package-archive', 'application/octet-stream', ''] },
  EXE: { extensions: ['.exe'], contentTypes: ['application/vnd.microsoft.portable-executable', 'application/x-msdownload', 'application/octet-stream', ''] },
  Extension: { extensions: ['.zip', '.crx', '.xpi'], contentTypes: ['application/zip', 'application/x-zip-compressed', 'application/x-chrome-extension', 'application/x-xpinstall', 'application/octet-stream', ''] },
}

function safeFilename(name) { return (String(name || 'file').split(/[/\\]/).pop() || 'file').replace(/[^a-zA-Z0-9._-]/g, '-') }
function getRule(filename) { const lower = filename.toLowerCase(); return Object.values(FILE_RULES).find((rule) => rule.extensions.some((extension) => lower.endsWith(extension))) }
function blobToken() { const token = process.env.BLOB_READ_WRITE_TOKEN?.trim(); if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not available in this deployment.'); return token }
function storeId() { const id = process.env.BLOB_STORE_ID?.trim(); if (!id) throw new Error('BLOB_STORE_ID is not available in this deployment.'); return id }
function parseRequestBody(request) {
  const body = request?.body
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body
  if (typeof body === 'string') { try { return JSON.parse(body) } catch { throw new Error('Invalid JSON request body.') } }
  if (Buffer.isBuffer(body)) { try { return JSON.parse(body.toString('utf8')) } catch { throw new Error('Invalid JSON request body.') } }
  throw new Error('Request body is missing.')
}
function publicUrl(pathname, download = false) {
  const base = `https://${storeId()}.public.blob.vercel-storage.com/`
  const url = new URL(pathname.split('/').map(encodeURIComponent).join('/'), base)
  if (download) url.searchParams.set('download', '1')
  return url.toString()
}
function authorized(body) { const configured = String(process.env.ADMIN_UPLOAD_KEY || '').trim(); const supplied = String(body.adminKey || '').trim(); return Boolean(configured && supplied && configured === supplied) }

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  try {
    const body = parseRequestBody(request)
    if (!authorized(body)) return response.status(401).json({ error: 'Unauthorized' })

    const pathname = String(body.pathname || '').trim()
    if (body.action === 'verify') {
      if (!pathname.startsWith('files/')) return response.status(400).json({ error: 'Invalid file path.' })
      return response.status(200).json({ verified: true, pathname, size: Number(body.size || 0), contentType: String(body.contentType || 'application/octet-stream'), publicUrl: publicUrl(pathname, true) })
    }

    const filename = safeFilename(body.filename)
    const contentType = String(body.contentType || 'application/octet-stream')
    const size = Number(body.size || 0)
    const rule = getRule(filename)
    if (!rule) return response.status(400).json({ error: 'Unsupported file. Use APK, EXE, or ZIP/CRX/XPI browser extension files.' })
    if (!rule.contentTypes.includes(contentType)) return response.status(400).json({ error: 'Invalid file content type.' })
    if (!Number.isFinite(size) || size <= 0 || size > 1024 * 1024 * 1024) return response.status(400).json({ error: 'File must be between 1 byte and 1 GB.' })

    const filePath = `files/${Date.now()}-${filename}`
    const validUntil = Date.now() + 15 * 60 * 1000
    const signedToken = await issueSignedToken({ token: blobToken(), pathname: filePath, operations: ['put'], validUntil, allowedContentTypes: [contentType], maximumSizeInBytes: size })
    const { presignedUrl } = await presignUrl(signedToken, { pathname: filePath, operation: 'put', access: 'public', validUntil, allowedContentTypes: [contentType], maximumSizeInBytes: size })
    return response.status(200).json({ pathname: filePath, presignedUrl, publicUrl: publicUrl(filePath, true), validUntil })
  } catch (error) {
    console.error('Blob upload error:', error)
    return response.status(500).json({ error: error?.message || 'Could not process upload' })
  }
}
