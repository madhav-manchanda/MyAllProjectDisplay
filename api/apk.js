import { get } from '@vercel/blob'
import { Readable } from 'node:stream'

async function readProjects() {
  const result = await get('data/projects.json', {
    access: 'private',
    useCache: false,
  })

  if (!result?.stream) return []
  const text = await new Response(result.stream).text()
  const projects = JSON.parse(text)
  return Array.isArray(projects) ? projects : []
}

function getPath(project) {
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
    const id = request.query?.id || new URL(request.url, 'https://vercel.local').searchParams.get('id')
    if (!id) return response.status(400).json({ error: 'Project id is required' })

    const projects = await readProjects()
    const project = projects.find((item) => item.id === id)
    if (!project) return response.status(404).json({ error: 'Project not found' })

    const pathname = getPath(project)
    if (!pathname) return response.status(404).json({ error: 'APK not found' })

    const result = await get(pathname, {
      access: 'private',
      useCache: false,
    })

    if (!result?.stream) return response.status(404).json({ error: 'APK not found' })

    const filename = `${project.name.replace(/[^a-z0-9._-]/gi, '_')}.apk`
    response.statusCode = 200
    response.setHeader('Content-Type', result.blob?.contentType || 'application/vnd.android.package-archive')
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    Readable.fromWeb(result.stream).pipe(response)
  } catch (error) {
    console.error('APK download failed:', error)
    return response.status(500).json({ error: error?.message || 'Could not download APK' })
  }
}
