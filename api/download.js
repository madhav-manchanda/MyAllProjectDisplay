import { supabase, STORAGE_BUCKET } from './_supabase.js'

function getProjectId(request) {
  if (request.query?.id) return String(request.query.id)
  try { return new URL(request.url || '', 'https://vercel.local').searchParams.get('id') } catch { return null }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })

  try {
    const id = getProjectId(request)
    if (!id) return response.status(400).json({ error: 'Project id is required' })

    const { data: project, error } = await supabase
      .from('projects')
      .select('file_path, file_name')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!project?.file_path) return response.status(404).json({ error: 'File not found for this project' })

    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(project.file_path, { download: project.file_name || true })

    response.statusCode = 302
    response.setHeader('Location', data.publicUrl)
    response.setHeader('Cache-Control', 'public, max-age=3600')
    return response.end()
  } catch (error) {
    console.error('Supabase download redirect failed:', error)
    return response.status(500).json({ error: error?.message || 'Could not download file' })
  }
}
