import { get, head, BlobNotFoundError } from '@vercel/blob'

// Kept only for backward compatibility with any old links pointing at
// /api/apk.js?id=... — the app itself now always uses /api/download.
// Re-implemented on head() for the same reason as download.js: streaming the
// whole file through a serverless function response risks hitting Vercel's
// response size limits on larger APK/EXE files, and it can't tell "the blob
// pathname is wrong" apart from "the blob genuinely doesn't exist".

function blobToken() {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not available in this deployment.')
  return token
}

async function readProjects(token) {
  const result = await get('data/projects.json', { access: 'private', token, useCache: false })
  if (!result?.stream) return []
  const text = await new Response(result.stream).text()
  const projects = JSON.parse(text)
  return Array.isArray(projects) ? projects : []
}

function getPathname(project) {
  for (const value of [project.filePath, project.apkPath]) {
    if (value && String(value).startsWith('files/')) return String(value)
  }
  if (project.apkUrl) {
    try {
      const url = new URL(project.apkUrl)
      const pathname = decodeURIComponent(url.pathname.replace(/^\//, ''))
      if (pathname.startsWith('files/')) return pathname
    } catch {
      // not a URL
    }
  }
  return null
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })

  try {
    const id = request.query?.id || new URL(request.url, 'https://vercel.local').searchParams.get('id')
    if (!id) return response.status(400).json({ error: 'Project id is required', code: 'MISSING_ID' })

    const token = blobToken()
    const projects = await readProjects(token)
    const project = projects.find((item) => String(item.id) === String(id))
    if (!project) return response.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' })

    const pathname = getPathname(project)
    if (!pathname) return response.status(404).json({ error: 'APK not found', code: 'NO_FILE' })

    let meta
    try {
      meta = await head(pathname, { token })
    } catch (error) {
      if (error instanceof BlobNotFoundError) return response.status(404).json({ error: 'APK not found in storage', code: 'BLOB_NOT_FOUND' })
      throw error
    }

    response.statusCode = 302
    response.setHeader('Location', meta.downloadUrl)
    response.setHeader('Cache-Control', 'no-store')
    return response.end()
  } catch (error) {
    console.error('[apk] failed:', error?.message || error)
    return response.status(500).json({ error: error?.message || 'Could not download APK', code: 'DOWNLOAD_ERROR' })
  }
}
