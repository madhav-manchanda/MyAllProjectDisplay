import { get } from '@vercel/blob'
import { Readable } from 'node:stream'

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not available in this deployment.')
  return token
}

async function readProjects(token) {
  const result = await get('data/projects.json', {
    access: 'private',
    token,
    useCache: false,
  })

  if (!result?.stream) return []
  const text = await new Response(result.stream).text()
  const projects = JSON.parse(text)
  return Array.isArray(projects) ? projects : []
}

function getProjectId(request) {
  const queryId = request.query?.id
  if (queryId) return String(queryId)

  try {
    return new URL(request.url || '', 'https://vercel.local').searchParams.get('id')
  } catch {
    return null
  }
}

function getPath(project) {
  if (project.filePath) return project.filePath
  if (project.apkPath) return project.apkPath

  // Backward compatibility with projects that only stored the old Blob URL.
  if (project.apkUrl) {
    try {
      const url = new URL(project.apkUrl)
      return decodeURIComponent(url.pathname.replace(/^\//, ''))
    } catch {
      return null
    }
  }

  return null
}

function safeFilename(name) {
  return String(name || 'download')
    .split(/[/\\]/)
    .pop()
    .replace(/[^a-z0-9._-]/gi, '_') || 'download'
}

function extensionFor(project) {
  const stored = String(project.fileName || '').split(/[/\\]/).pop()
  if (stored && stored.includes('.')) return safeFilename(stored)

  const base = safeFilename(project.name || 'download')
  if (project.type === 'APK') return `${base}.apk`
  if (project.type === 'EXE') return `${base}.exe`
  return `${base}.zip`
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = blobToken()
    const id = getProjectId(request)
    if (!id) return response.status(400).json({ error: 'Project id is required' })

    const projects = await readProjects(token)
    const project = projects.find((item) => String(item.id) === id)
    if (!project) return response.status(404).json({ error: 'Project not found' })

    const pathname = getPath(project)
    if (!pathname) return response.status(404).json({ error: 'File not found for this project' })

    const result = await get(pathname, {
      access: 'private',
      token,
      useCache: false,
    })

    if (!result?.stream) return response.status(404).json({ error: 'File not found in Blob storage' })

    const filename = extensionFor(project)
    response.statusCode = 200
    response.setHeader('Content-Type', project.fileContentType || result.blob?.contentType || 'application/octet-stream')
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    response.setHeader('Cache-Control', 'private, no-store, max-age=0')

    Readable.fromWeb(result.stream).pipe(response)
  } catch (error) {
    console.error('File download failed:', error)
    return response.status(500).json({ error: error?.message || 'Could not download file' })
  }
}
