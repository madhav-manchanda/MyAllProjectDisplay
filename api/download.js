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

function getFilename(project, pathname) {
  const storedName = String(project.fileName || '').trim()
  if (storedName) return storedName.split(/[/\\]/).pop()
  return pathname.split('/').pop() || 'download'
}

function contentDisposition(filename) {
  const fallback = filename.replace(/[^a-zA-Z0-9._-]/g, '-') || 'download'
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
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

    // Fetch the private Blob inside this API route and stream it directly to
    // the browser. There is deliberately no redirect to a Blob URL.
    const blob = await get(pathname, {
      access: 'private',
      token,
      useCache: false,
    })

    if (!blob?.stream) {
      return response.status(404).json({ error: 'The uploaded file is missing from Blob storage. Re-upload this project file.' })
    }

    const filename = getFilename(project, pathname)
    response.setHeader('Content-Type', blob.contentType || project.fileContentType || 'application/octet-stream')
    if (blob.size != null) response.setHeader('Content-Length', String(blob.size))
    response.setHeader('Content-Disposition', contentDisposition(filename))
    response.setHeader('Cache-Control', 'private, no-store, max-age=0')
    response.setHeader('X-Content-Type-Options', 'nosniff')

    Readable.fromWeb(blob.stream).on('error', (error) => {
      console.error('Blob download stream error:', error)
      if (!response.headersSent) response.status(500).json({ error: 'Download stream failed' })
      else response.destroy(error)
    }).pipe(response)
  } catch (error) {
    console.error('File download failed:', error)
    return response.status(500).json({ error: error?.message || 'Could not download file' })
  }
}
