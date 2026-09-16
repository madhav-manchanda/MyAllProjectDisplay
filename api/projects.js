import { get, put } from '@vercel/blob'

const defaults = [
  {
    id: 'veya',
    name: 'Veya',
    type: 'APK',
    description: 'A private Android messenger built with Kotlin, Supabase and realtime communication.',
    version: 'Android app',
    apkUrl: '',
    url: '',
    github: 'https://github.com/madhav-manchanda/veya',
    featured: true,
  },
  {
    id: 'logixchange',
    name: 'LogixChange',
    type: 'Live',
    description: 'A logistics matching platform connecting shipment demand with available transport capacity.',
    version: 'Web app',
    apkUrl: '',
    url: '',
    github: '',
    featured: true,
  },
]

async function readProjects() {
  const result = await get('data/projects.json', { access: 'public' })
  if (!result || result.statusCode !== 200 || !result.stream) return defaults
  const text = await new Response(result.stream).text()
  return JSON.parse(text)
}

function authorized(request) {
  const configured = (process.env.ADMIN_UPLOAD_KEY || '').trim()
  const supplied = (request.headers['x-admin-key'] || '').trim()
  return Boolean(configured && supplied && configured === supplied)
}

async function writeProjects(projects) {
  return put('data/projects.json', JSON.stringify(projects), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  })
}

export default async function handler(request, response) {
  if (request.method === 'GET') {
    try {
      return response.status(200).json(await readProjects())
    } catch {
      return response.status(200).json(defaults)
    }
  }

  if (!['POST', 'DELETE'].includes(request.method)) return response.status(405).json({ error: 'Method not allowed' })
  if (!authorized(request)) return response.status(401).json({ error: 'Invalid admin key' })

  try {
    const projects = await readProjects()

    if (request.method === 'DELETE') {
      const id = request.query?.id
      if (!id) return response.status(400).json({ error: 'Project id is required' })
      const next = projects.filter((project) => project.id !== id)
      if (next.length === projects.length) return response.status(404).json({ error: 'Project not found' })
      await writeProjects(next)
      return response.status(200).json({ ok: true, projects: next })
    }

    const incoming = request.body?.projects
    if (!Array.isArray(incoming)) return response.status(400).json({ error: 'projects must be an array' })
    const blob = await writeProjects(incoming)
    return response.status(200).json({ ok: true, url: blob.url })
  } catch (error) {
    return response.status(500).json({ error: error?.message || 'Could not save projects' })
  }
}
