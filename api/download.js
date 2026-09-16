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

function addPath(paths, value) {
  if (!value) return
  const path = String(value).trim()
  if (!path) return
  if (!paths.includes(path)) paths.push(path)
}

function getPathCandidates(project) {
  const paths = []
  addPath(paths, project.filePath)
  addPath(paths, project.apkPath)

  for (const value of [project.apkUrl, project.fileUrl, project.downloadUrl]) {
    if (!value) continue
    try {
      const url = new URL(String(value))
      addPath(paths, decodeURIComponent(url.pathname.replace(/^\//, '')))
    } catch {
      addPath(paths, value)
    }
  }

  return paths
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

async function getBlob(token, candidates) {
  let lastError = null

  for (const pathname of candidates) {
    try {
      const result = await get(pathname, {
        access: 'private',
        token,
        useCache: false,
      })

      if (result?.stream && result.statusCode !== 404) {
        return { result, pathname }
      }
    } catch (error) {
      lastError = error
    }
  }

  // Extra fallback for deployments where the SDK read path has a transient
  // issue. Vercel documents direct authenticated access to private Blob URLs.
  const storeId = process.env.BLOB_STORE_ID?.trim()
  if (storeId) {
    for (const pathname of candidates) {
      try {
        const encodedPath = pathname.split('/').map(encodeURIComponent).join('/')
        const blobResponse = await fetch(`https://${storeId}.private.blob.vercel-storage.com/${encodedPath}?cache=0`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        if (blobResponse.ok && blobResponse.body) {
          return {
            result: {
              stream: blobResponse.body,
              blob: {
                size: blobResponse.headers.get('content-length') ? Number(blobResponse.headers.get('content-length')) : undefined,
                contentType: blobResponse.headers.get('content-type') || undefined,
              },
            },
            pathname,
          }
        }
      } catch (error) {
        lastError = error
      }
    }
  }

  return { result: null, pathname: candidates[0] || null, lastError }
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

    const candidates = getPathCandidates(project)
    if (!candidates.length) return response.status(404).json({ error: 'File not found for this project' })

    // Stream the private object through this endpoint. The browser never gets
    // a Blob URL and the endpoint never redirects.
    const { result, pathname } = await getBlob(token, candidates)

    if (!result?.stream) {
      return response.status(404).json({
        error: 'The uploaded file is not present in the configured Vercel Blob store.',
        pathsChecked: candidates,
      })
    }

    const blob = result.blob || {}
    const filename = getFilename(project, pathname)
    response.setHeader('Content-Type', blob.contentType || project.fileContentType || 'application/octet-stream')
    response.setHeader('Content-Disposition', contentDisposition(filename))
    response.setHeader('Cache-Control', 'private, no-store, max-age=0')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    if (blob.size != null && Number.isFinite(Number(blob.size))) {
      response.setHeader('Content-Length', String(blob.size))
    }

    Readable.fromWeb(result.stream).pipe(response)
    return undefined
  } catch (error) {
    console.error('Private Blob download failed:', error)
    return response.status(500).json({ error: String(error?.message || 'Could not download file') })
  }
}
