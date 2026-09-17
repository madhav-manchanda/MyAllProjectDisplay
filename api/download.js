import { get } from '@vercel/blob'

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not available in this deployment.')
  return token
}

async function readProjects() {
  const result = await get('data/projects.json', { access: 'public', token: blobToken(), useCache: false })
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
  for (const value of [project.filePath, project.apkPath, project.fileUrl, project.downloadUrl, project.apkUrl]) {
    if (!value) continue
    try { return decodeURIComponent(new URL(String(value)).pathname.replace(/^\//, '')) }
    catch { return String(value).trim() }
  }
  return ''
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  try {
    const id = getProjectId(request)
    if (!id) return response.status(400).json({ error: 'Project id is required' })
    const project = (await readProjects()).find((item) => String(item.id) === id)
    if (!project) return response.status(404).json({ error: 'Project not found' })
    const pathname = getPath(project)
    if (!pathname || !pathname.startsWith('files/')) return response.status(404).json({ error: 'File not found for this project' })

    const result = await get(pathname, { access: 'public', token: blobToken(), useCache: false })
    if (!result?.blob?.url) return response.status(404).json({ error: 'Blob file not found' })

    response.statusCode = 302
    response.setHeader('Location', result.blob.downloadUrl || `${result.blob.url}?download=1`)
    response.setHeader('Cache-Control', 'no-store')
    return response.end()
  } catch (error) {
    console.error('Public Blob download redirect failed:', error)
    return response.status(500).json({ error: String(error?.message || 'Could not download file') })
  }
}
