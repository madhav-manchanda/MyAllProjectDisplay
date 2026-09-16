import { get, issueSignedToken, presignUrl } from '@vercel/blob'

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

    // Do not proxy the APK/EXE/extension through the Vercel Function.
    // Instead create a short-lived, single-file private Blob GET URL and
    // redirect the browser to it. This also avoids serverless stream issues.
    const validUntil = Date.now() + 10 * 60 * 1000
    const signedToken = await issueSignedToken({
      token,
      pathname,
      operations: ['get'],
      validUntil,
    })

    const { presignedUrl } = await presignUrl(signedToken, {
      pathname,
      operation: 'get',
      access: 'private',
      validUntil,
    })

    return response.redirect(302, presignedUrl)
  } catch (error) {
    console.error('File download URL creation failed:', error)
    return response.status(500).json({ error: error?.message || 'Could not create download URL' })
  }
}
