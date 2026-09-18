import { supabase, STORAGE_BUCKET } from './_supabase.js'

const DEFAULTS = [
  { id: 'veya', name: 'Veya', type: 'APK', description: 'A private Android messenger built with Kotlin, Supabase and realtime communication.', version: 'Android app', url: '', github: 'https://github.com/madhav-manchanda/veya', featured: true, file_path: '', file_name: '', file_content_type: '', file_size: 0 },
  { id: 'logixchange', name: 'LogixChange', type: 'Live', description: 'A logistics matching platform connecting shipment demand with available transport capacity.', version: 'Web app', url: '', github: '', featured: true, file_path: '', file_name: '', file_content_type: '', file_size: 0 },
]

function header(request, name) {
  if (request?.headers?.get) return request.headers.get(name) || ''
  return request?.headers?.[name] || request?.headers?.[name.toLowerCase()] || ''
}

function authorized(request) {
  const configured = String(process.env.ADMIN_UPLOAD_KEY || '').trim()
  const supplied = String(header(request, 'x-admin-key')).trim()
  return Boolean(configured && supplied && configured === supplied)
}

function parseBody(request) {
  const body = request?.body
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body
  if (typeof body === 'string') {
    try { return JSON.parse(body) } catch { throw new Error('Invalid JSON request body.') }
  }
  if (Buffer.isBuffer(body)) {
    try { return JSON.parse(body.toString('utf8')) } catch { throw new Error('Invalid JSON request body.') }
  }
  throw new Error('Request body is missing.')
}

function getProjectId(request) {
  if (request.query?.id) return String(request.query.id)
  try { return new URL(request.url || '', 'https://vercel.local').searchParams.get('id') } catch { return null }
}

function toClientProject(row) {
  return {
    ...row,
    filePath: row.file_path || '',
    fileName: row.file_name || '',
    fileContentType: row.file_content_type || '',
    fileSize: Number(row.file_size || 0),
  }
}

function toRow(project) {
  return {
    id: String(project.id),
    name: String(project.name || '').trim(),
    type: String(project.type || '').trim(),
    description: String(project.description || '').trim(),
    version: String(project.version || ''),
    url: String(project.url || ''),
    github: String(project.github || ''),
    featured: Boolean(project.featured),
    file_path: String(project.filePath || ''),
    file_name: String(project.fileName || ''),
    file_content_type: String(project.fileContentType || ''),
    file_size: Number(project.fileSize || 0),
  }
}

async function fileExists(pathname) {
  if (!pathname) return true
  if (!pathname.startsWith('files/')) return false
  const filename = pathname.slice('files/'.length)
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list('files', {
    limit: 100,
    search: filename,
  })
  if (error) throw new Error(error.message)
  return (data || []).some((item) => item.name === filename)
}

export default async function handler(request, response) {
  if (request.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return response.status(200).json((data || []).map(toClientProject))
    } catch (error) {
      console.error('Could not read Supabase projects:', error)
      return response.status(200).json(DEFAULTS)
    }
  }

  if (!['POST', 'DELETE'].includes(request.method)) return response.status(405).json({ error: 'Method not allowed' })
  if (!authorized(request)) return response.status(401).json({ error: 'Invalid admin key' })

  try {
    if (request.method === 'DELETE') {
      const id = getProjectId(request)
      if (!id) return response.status(400).json({ error: 'Project id is required' })

      const { data: project, error: findError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (findError) throw findError
      if (!project) return response.status(404).json({ error: 'Project not found' })

      const { error: deleteError } = await supabase.from('projects').delete().eq('id', id)
      if (deleteError) throw deleteError

      if (project.file_path) {
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([project.file_path])
        if (storageError) console.error('Project row deleted but file cleanup failed:', storageError)
      }

      const { data: remaining, error: remainingError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (remainingError) throw remainingError
      return response.status(200).json({ ok: true, projects: (remaining || []).map(toClientProject) })
    }

    const body = parseBody(request)
    const project = body.project || (Array.isArray(body.projects) ? body.projects[0] : null)
    if (!project) return response.status(400).json({ error: 'project is required' })

    const row = toRow(project)
    const allowedTypes = ['Live', 'APK', 'EXE', 'Extension', 'File']
    if (!row.id || !row.name || !row.description) return response.status(400).json({ error: 'Name, description and id are required.' })
    if (!allowedTypes.includes(row.type)) return response.status(400).json({ error: 'Invalid project type.' })

    if (row.type === 'Live' && !row.url) return response.status(400).json({ error: 'Live projects require a URL.' })
    if (row.type !== 'Live' && !row.file_path) return response.status(400).json({ error: 'File projects require an uploaded file.' })
    if (row.file_path && !(await fileExists(row.file_path))) return response.status(400).json({ error: 'The uploaded file could not be verified in Supabase Storage.' })

    const { data, error } = await supabase
      .from('projects')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw error
    return response.status(200).json({ ok: true, project: toClientProject(data) })
  } catch (error) {
    console.error('Could not save Supabase project:', error)
    return response.status(500).json({ error: error?.message || 'Could not save project' })
  }
}
