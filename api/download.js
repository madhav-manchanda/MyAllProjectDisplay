import { get, issueSignedToken, presignUrl } from '@vercel/blob'

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
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
  try { return new URL(request.url || '', 'https://vercel.local').searchParams.get('id') } catch { return null }
}

function getPath(project) {
  for (const value of [project.filePath, project.apkPath, project.apkUrl, project.fileUrl, project.downloadUrl]) {
    if (!value) continue
    try {
      const url = new URL(String(value))
      return decodeURIComponent(url.pathname.replace(/^\//, ''))
    } catch {
      return String(value).trim()
    }
  }
  return ''
}

function publicUrlFromPresignedUrl(presignedUrl) {
  const url = new URL(presignedUrl)
  url.hostname = url.hostname.replace('.private.blob.vercel-storage.com', '.public.blob.vercel-storage.com')
  url.search = ''
  return url.toString()
}

async function getPublicUrl(pathname) {
  const validUntil = Date.now() + 5 * 60 * 1000
  const signedToken = await issueSignedToken({ token: blobToken(), pathname, operations: ['get'], validUntil })
  const { presignedUrl } = await presignUrl(signedToken, { pathname, operation: 'get', access: 'public', validUntil, useCache: false })
  return publicUrlFromPresignedUrl(presignedUrl)
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })

  try {
    const id = getProjectId(request)
    if (!id) return response.status(400).json({ error: 'Project id is required' })

    const token = blobToken()
    const projects = await readProjects(token)
    const project = projects.find((item) => String(item.id) === id)
    if (!project) return response.status(404).json({ error: 'Project not found' })

    const pathname = getPath(project)
    if (!pathname || !pathname.startsWith('files/')) return response.status(404).json({ error: 'File not found for this project' })

    const publicUrl = await getPublicUrl(pathname)
    response.statusCode = 302
    response.setHeader('Location', publicUrl)
    response.setHeader('Cache-Control', 'no-store')
    return response.end()
  } catch (error) {
    console.error('Public Blob download redirect failed:', error)
    return response.status(500).json({ error: String(error?.message || 'Could not download file') })
  }
}
