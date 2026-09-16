import { Readable } from 'node:stream'
import { get } from '@vercel/blob'

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
  const safe = String(filename || 'download').replace(/[\r\n"]/g, '')
  const fallback = safe.replace(/[^a-zA-Z0-9._-]/g, '_')
  const encoded = encodeURIComponent(safe)
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

    // Fetch the private object itself and stream it through this endpoint.
    // The browser never receives a Blob URL and this endpoint never redirects.
    const result = await get(pathname, {
      access: 'private',
      token,
      useCache: false,
    })

    if (!result?.stream) {
      return response.status(404).json({ error: 'The uploaded file does not exist in Blob storage. Re-upload this project file.' })
    }

    const blob = result.blob || {}
    const filename = getFilename(project, pathname)
    response.setHeader('Content-Type', blob.contentType || project.fileContentType || 'application/octet-stream')
    response.setHeader('Content-Disposition', contentDisposition(filename))
    response.setHeader('Cache-Control', 'private, no-store, max-age=0')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    if (blob.size != null) response.setHeader('Content-Length', String(blob.size))

    Readable.fromWeb(result.stream).pipe(response)
    return undefined
  } catch (error) {
    console.error('Private Blob download failed:', error)
    const message = String(error?.message || '')
    if (/does not exist|not found|404/i.test(message)) {
      return response.status(404).json({ error: 'The uploaded file does not exist in the configured Vercel Blob store. Re-upload this project file.' })
    }
    return response.status(500).json({ error: message || 'Could not download file' })
  }
}
