import { get, head, BlobNotFoundError } from '@vercel/blob'

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

function getProjectId(request) {
  if (request.query?.id) return String(request.query.id)
  try {
    return new URL(request.url || '', 'https://vercel.local').searchParams.get('id')
  } catch {
    return null
  }
}

// Understands every field name a project's file has ever been stored under,
// old and new, so previously-uploaded projects keep working.
function getPathname(project) {
  for (const value of [project.filePath, project.apkPath]) {
    if (value && String(value).startsWith('files/')) return String(value)
  }
  for (const value of [project.apkUrl, project.fileUrl, project.downloadUrl]) {
    if (!value) continue
    try {
      const parsed = new URL(String(value))
      const pathname = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
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
    const id = getProjectId(request)
    if (!id) return response.status(400).json({ error: 'Project id is required', code: 'MISSING_ID' })

    const token = blobToken()
    const projects = await readProjects(token)
    const project = projects.find((item) => String(item.id) === id)
    if (!project) return response.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' })

    const pathname = getPathname(project)
    if (!pathname) return response.status(404).json({ error: 'No file is attached to this project', code: 'NO_FILE' })

    // head() is the control API talking to Vercel Blob directly with the
    // read-write token — it either returns real, current metadata for an
    // object that exists, or throws BlobNotFoundError. No guessed hostnames,
    // no manually-rewritten URLs: `downloadUrl` is exactly what Blob itself says.
    let meta
    try {
      meta = await head(pathname, { token })
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return response.status(404).json({ error: 'File not found in storage', code: 'BLOB_NOT_FOUND' })
      }
      throw error
    }

    response.statusCode = 302
    response.setHeader('Location', meta.downloadUrl)
    response.setHeader('Cache-Control', 'no-store')
    return response.end()
  } catch (error) {
    console.error('[download] failed:', error?.message || error)
    return response.status(500).json({ error: error?.message || 'Could not download file', code: 'DOWNLOAD_ERROR' })
  }
}
