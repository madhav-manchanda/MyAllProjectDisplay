import { get, put } from '@vercel/blob'

const defaults = [
  { id: 'veya', name: 'Veya', type: 'APK', description: 'A private Android messenger built with Kotlin, Supabase and realtime communication.', version: 'Android app', apkUrl: '', apkPath: '', url: '', github: 'https://github.com/madhav-manchanda/veya', featured: true },
  { id: 'logixchange', name: 'LogixChange', type: 'Live', description: 'A logistics matching platform connecting shipment demand with available transport capacity.', version: 'Web app', apkUrl: '', apkPath: '', url: '', github: '', featured: true },
]

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not available in this deployment.')
  return token
}

async function readProjects() {
  try {
    const result = await get('data/projects.json', { access: 'public', token: blobToken(), useCache: false })
    if (!result?.stream) return defaults
    const text = await new Response(result.stream).text()
    const projects = JSON.parse(text)
    return Array.isArray(projects) ? projects : defaults
  } catch (error) {
    if (error?.statusCode === 404 || error?.code === 'BLOB_NOT_FOUND') return defaults
    throw error
  }
}

function header(request, name) {
  if (request?.headers?.get) return request.headers.get(name) || ''
  return request?.headers?.[name] || request?.headers?.[name.toLowerCase()] || ''
}

function authorized(request) {
  const configured = String(process.env.ADMIN_UPLOAD_KEY || '').trim()
  const supplied = String(header(request, 'x-admin-key')).trim()
  return Boolean(configured && supplied && configured === supplied)
}

async function writeProjects(projects) {
  return put('data/projects.json', JSON.stringify(projects), {
    access: 'public',
    token: blobToken(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}

function getProjectId(request) {
  if (request.query?.id) return String(request.query.id)
  try { return new URL(request.url || '', 'https://vercel.local').searchParams.get('id') } catch { return null }
}

export default async function handler(request, response) {
  if (request.method === 'GET') {
    try { return response.status(200).json(await readProjects()) }
    catch (error) { console.error('Could not read projects:', error); return response.status(200).json(defaults) }
  }

  if (!['POST', 'DELETE'].includes(request.method)) return response.status(405).json({ error: 'Method not allowed' })
  if (!authorized(request)) return response.status(401).json({ error: 'Invalid admin key' })

  try {
    const projects = await readProjects()

    if (request.method === 'DELETE') {
      const id = getProjectId(request)
      if (!id) return response.status(400).json({ error: 'Project id is required' })
      const next = projects.filter((project) => String(project.id) !== String(id))
      if (next.length === projects.length) return response.status(404).json({ error: 'Project not found' })
      await writeProjects(next)
      return response.status(200).json({ ok: true, projects: next })
    }

    const incoming = request.body?.projects
    if (!Array.isArray(incoming)) return response.status(400).json({ error: 'projects must be an array' })
    await writeProjects(incoming)
    return response.status(200).json({ ok: true, projects: incoming })
  } catch (error) {
    console.error('Could not save projects:', error)
    return response.status(500).json({ error: error?.message || 'Could not save projects' })
  }
}
