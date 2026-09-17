import { get, put, head, del, BlobNotFoundError } from '@vercel/blob'

const PROJECTS_KEY = 'data/projects.json'

const defaults = [
  {
    id: 'veya',
    name: 'Veya',
    type: 'APK',
    description: 'A private Android messenger built with Kotlin, Supabase and realtime communication.',
    version: 'Android app',
    apkUrl: '',
    apkPath: '',
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
    apkPath: '',
    url: '',
    github: '',
    featured: true,
  },
]

function blobToken() {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not available in this deployment.')
  return token
}

// Returns { projects, existed }. Throws on a genuine storage error instead of
// ever silently substituting `defaults` for real data — a storage outage must
// never be indistinguishable from "the file doesn't exist yet" (that
// indistinguishability was the root cause of the accidental-data-loss risk:
// a transient read failure could previously look identical to "brand new
// store", and a subsequent save would then persist `defaults` over real data).
async function readProjectsOrThrow() {
  const token = blobToken()
  let result
  try {
    result = await get(PROJECTS_KEY, { access: 'private', token, useCache: false })
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { projects: defaults, existed: false }
    throw error
  }
  if (!result || !result.stream) return { projects: defaults, existed: false }

  const text = await new Response(result.stream).text()
  let projects
  try {
    projects = JSON.parse(text)
  } catch {
    throw new Error('Stored project data is corrupted (invalid JSON).')
  }
  return { projects: Array.isArray(projects) ? projects : defaults, existed: true }
}

async function writeProjects(projects) {
  const token = blobToken()
  return put(PROJECTS_KEY, JSON.stringify(projects), {
    access: 'private',
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}

function authorized(request) {
  const configured = (process.env.ADMIN_UPLOAD_KEY || '').trim()
  const supplied = String(request.headers['x-admin-key'] || '').trim()
  return Boolean(configured && supplied && configured === supplied)
}

function getProjectId(request) {
  if (request.query?.id) return String(request.query.id)
  try {
    return new URL(request.url, 'https://vercel.local').searchParams.get('id')
  } catch {
    return null
  }
}

// Every path a file's Blob pathname could have been stored under, old and new,
// so backward compatibility with pre-existing projects is preserved.
function getBlobPathname(project) {
  for (const value of [project.filePath, project.apkPath]) {
    if (value && String(value).startsWith('files/')) return String(value)
  }
  for (const value of [project.apkUrl, project.fileUrl, project.downloadUrl]) {
    if (!value) continue
    try {
      const parsed = new URL(String(value))
      const pathname = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
      if (pathname.startsWith('files/')) return pathname
    } catch {
      // not a URL, ignore
    }
  }
  return null
}

export default async function handler(request, response) {
  if (request.method === 'GET') {
    try {
      const { projects } = await readProjectsOrThrow()
      return response.status(200).json(projects)
    } catch (error) {
      console.error('[projects] read failed:', error?.message || error)
      // 503, NOT 200-with-defaults: a real storage error must be visible to the
      // frontend so it never mistakes "outage" for "empty store" and goes on
      // to save a defaults+new-project array over the real data.
      return response.status(503).json({ error: 'Could not read project data right now. Please try again.', code: 'STORAGE_UNAVAILABLE' })
    }
  }

  if (!['POST', 'DELETE'].includes(request.method)) {
    return response.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
  }

  if (!authorized(request)) {
    return response.status(401).json({ error: 'Invalid admin key', code: 'UNAUTHORIZED' })
  }

  try {
    const token = blobToken()

    if (request.method === 'DELETE') {
      const id = getProjectId(request)
      if (!id) return response.status(400).json({ error: 'Project id is required', code: 'MISSING_ID' })

      const { projects } = await readProjectsOrThrow()
      const target = projects.find((project) => String(project.id) === id)
      if (!target) return response.status(404).json({ error: 'Project not found', code: 'PROJECT_NOT_FOUND' })

      const next = projects.filter((project) => String(project.id) !== id)
      await writeProjects(next)

      // Best-effort cleanup of the underlying file so deleted uploads don't
      // linger in the store forever. A failure here must not undo the metadata
      // delete that already succeeded.
      const pathname = getBlobPathname(target)
      if (pathname) {
        try {
          await del(pathname, { token })
        } catch (cleanupError) {
          console.error('[projects] blob cleanup failed (metadata delete still applied):', cleanupError?.message || cleanupError)
        }
      }

      return response.status(200).json({ ok: true, projects: next })
    }

    // POST: add exactly one new project. The server re-reads the current list
    // itself and prepends to that, rather than trusting a full array from the
    // client — a stale or fallback-populated client array can never overwrite
    // real remote data this way.
    const incoming = request.body?.project
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return response.status(400).json({ error: 'A single project object is required', code: 'INVALID_BODY' })
    }
    if (!incoming.id || !incoming.name || !incoming.description) {
      return response.status(400).json({ error: 'Project id, name, and description are required', code: 'INVALID_PROJECT' })
    }

    const project = { ...incoming }
    const pathname = getBlobPathname(project)
    if (pathname) {
      // Real verification: ask Vercel Blob's control API whether the object
      // actually exists, and only then trust size/content-type from Blob
      // itself (never from what the browser claimed).
      try {
        const meta = await head(pathname, { token })
        project.fileSize = meta.size
        project.fileContentType = meta.contentType
      } catch (error) {
        if (error instanceof BlobNotFoundError) {
          return response.status(404).json({ error: 'The uploaded file could not be found in storage — the project was not saved.', code: 'BLOB_NOT_FOUND' })
        }
        throw error
      }
    }

    const { projects: current } = await readProjectsOrThrow()
    const next = [project, ...current.filter((p) => String(p.id) !== String(project.id))]
    await writeProjects(next)

    return response.status(200).json({ ok: true, projects: next })
  } catch (error) {
    console.error('[projects] write failed:', error?.message || error)
    return response.status(500).json({ error: error?.message || 'Could not save projects', code: 'STORAGE_ERROR' })
  }
}
