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

export default async function handler(request, response) {
  if (request.method === 'GET') {
    try {
      return response.status(200).json(await readProjects())
    } catch {
      return response.status(200).json(defaults)
    }
  }

  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  if (!process.env.ADMIN_UPLOAD_KEY || request.headers['x-admin-key'] !== process.env.ADMIN_UPLOAD_KEY) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const projects = request.body?.projects
    if (!Array.isArray(projects)) return response.status(400).json({ error: 'projects must be an array' })
    const blob = await put('data/projects.json', JSON.stringify(projects), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    })
    return response.status(200).json({ ok: true, url: blob.url })
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Could not save projects' })
  }
}
