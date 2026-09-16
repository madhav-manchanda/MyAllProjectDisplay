import { get } from '@vercel/blob'
import { Readable } from 'node:stream'

async function readProjects() {
  const result = await get('data/projects.json', { access: 'private', useCache: false })
  if (!result?.stream) return []
  const text = await new Response(result.stream).text()
  const projects = JSON.parse(text)
  return Array.isArray(projects) ? projects : []
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

function extensionFor(project, blob) {
  const stored = String(project.fileName || '').split(/[/\\]/).pop()
  if (stored && stored.includes('.')) return stored
  if (project.type === 'APK') return `${project.name}.apk`
  if (project.type === 'EXE') return `${project.name}.exe`
  return `${project.name}.zip`
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })

  try {
    const id = request.query?.id || new URL(request.url, 'https://vercel.local').searchParams.get('id')
    if (!id) return response.status(400).json({ error: 'Project id is required' })

    const projects = await readProjects()
    const project = projects.find((item) => item.id === id)
    if (!project) return response.status(404).json({ error: 'Project not found' })

    const pathname = getPath(project)
    if (!pathname) return response.status(404).json({ error: 'File not found' })

    const result = await get(pathname, { access: 'private', useCache: false })
    if (!result?.stream) return response.status(404).json({ error: 'File not found' })

    const filename = extensionFor(project, result.blob)
    response.statusCode = 200
    response.setHeader('Content-Type', project.fileContentType || result.blob?.contentType || 'application/octet-stream')
    response.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^a-z0-9._-]/gi, '_')}"`)
    Readable.fromWeb(result.stream).pipe(response)
  } catch (error) {
    console.error('File download failed:', error)
    return response.status(500).json({ error: error?.message || 'Could not download file' })
  }
}
