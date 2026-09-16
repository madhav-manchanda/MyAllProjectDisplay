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
  const safe = filename.replace(/[\r\n"]/g, '_')
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape)
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`
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

    // Fetch the private Blob on the server and stream it straight to the
    // browser. There is deliberately NO redirect and NO Blob URL exposed.
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
    response.setHeader('Content-Length', String(blob.size))
    response.setHeader('Content-Disposition', contentDisposition(filename))
    response.setHeader('Cache-Control', 'private, no-store, max-age=0')

    // @vercel/blob returns a Web ReadableStream. Vercel's Node response can
    // consume it through a reader without buffering the whole APK in memory.
    const reader = blob.stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        response.write(Buffer.from(value))
      }
    } finally {
      reader.releaseLock()
    }

    return response.end()
  } catch (error) {
    console.error('File download failed:', error)
    if (!response.headersSent) {
      return response.status(500).json({ error: error?.message || 'Could not download file' })
    }
    return response.end()
  }
}
