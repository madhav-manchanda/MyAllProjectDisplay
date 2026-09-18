import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUpRight, Boxes, Check, Download, ExternalLink, Code2, Globe, Menu, Smartphone, Sparkles, UploadCloud, X, Trash2, LockKeyhole, FileArchive, File } from 'lucide-react'
import './styles.css'

const fallbackProjects = [
  { id: 'veya', name: 'Veya', type: 'APK', description: 'A private Android messenger built with Kotlin, Supabase and realtime communication.', version: 'Android app', filePath: '', fileName: '', url: '', github: 'https://github.com/madhav-manchanda/veya', featured: true },
  { id: 'logixchange', name: 'LogixChange', type: 'Live', description: 'A logistics matching platform connecting shipment demand with available transport capacity.', version: 'Web app', filePath: '', fileName: '', url: '', github: '', featured: true },
]

const FILE_TYPES = ['APK', 'EXE', 'Extension', 'File']
const SUPABASE_BUCKET = 'project-files'

function isFileProject(project) {
  return FILE_TYPES.includes(project.type)
}

function fileAccept(type) {
  if (type === 'APK') return '.apk,application/vnd.android.package-archive,application/octet-stream'
  if (type === 'EXE') return '.exe,application/vnd.microsoft.portable-executable,application/x-msdownload,application/octet-stream'
  if (type === 'Extension') return '.zip,.crx,.xpi,application/zip,application/x-chrome-extension,application/x-xpinstall,application/octet-stream'
  return '*/*'
}

function typeLabel(type) {
  if (type === 'APK') return 'Android APK'
  if (type === 'EXE') return 'Windows EXE'
  if (type === 'Extension') return 'Browser extension'
  if (type === 'File') return 'Other file'
  return 'Live website'
}

function fileDescription(type) {
  if (type === 'APK') return 'Android APK'
  if (type === 'EXE') return 'Windows EXE'
  if (type === 'Extension') return 'browser extension'
  return 'file'
}

function App() {
  const [projects, setProjects] = useState(fallbackProjects)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('admin-project-key') || '')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.ok ? r.json() : fallbackProjects)
      .then(setProjects)
      .catch(() => {})
  }, [])

  const visible = useMemo(() => projects.filter((project) => {
    const matchesFilter = filter === 'All' || (filter === 'Apps' ? isFileProject(project) : project.type === 'Live')
    return matchesFilter && `${project.name} ${project.description}`.toLowerCase().includes(query.toLowerCase())
  }), [filter, query, projects])

  const saveKey = (value) => { setAdminKey(value); sessionStorage.setItem('admin-project-key', value) }

  return (
    <div className="site-shell">
      <header className="nav">
        <a className="brand" href="#top"><span className="brand-mark"><Sparkles size={17} /></span><span>madhav<span className="brand-dot">.</span></span></a>
        <nav className={mobileOpen ? 'nav-links open' : 'nav-links'}><a href="#projects" onClick={() => setMobileOpen(false)}>Projects</a><a href="#about" onClick={() => setMobileOpen(false)}>About</a><a href="https://github.com/madhav-manchanda" target="_blank" rel="noreferrer" onClick={() => setMobileOpen(false)}>GitHub</a></nav>
        <div className="nav-actions"><button className="manage-button" onClick={() => setAdminOpen(true)}><LockKeyhole size={14} /> Manage</button><button className="icon-button menu-button" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button></div>
      </header>
      <main id="top">
        <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot" /> Project lab</div><h1>Things I've built,<br /><span>ready to try.</span></h1><p>One place for my deployed web projects, Android apps, desktop builds and browser extensions. Open a live build or download a project.</p><a className="primary-button" href="#projects">Explore projects <ArrowUpRight size={17} /></a></div><div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-one"><div className="orbit-node node-one"><Globe size={18} /></div></div><div className="orbit orbit-two"><div className="orbit-node node-two"><Smartphone size={18} /></div></div><div className="orbit-core"><Boxes size={28} /></div></div></section>
        <section className="project-section" id="projects"><div className="section-head"><div><p className="section-kicker">Selected work</p><h2>Projects</h2></div><div className="project-count">{projects.length.toString().padStart(2, '0')} builds</div></div><div className="toolbar"><div className="filter-group">{['All', 'Live', 'Apps'].map((item) => <button key={item} className={filter === item ? 'filter active' : 'filter'} onClick={() => setFilter(item)}>{item}</button>)}</div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects" /></div><div className="project-grid">{visible.map((project) => <ProjectCard key={project.id} project={project} />)}</div>{visible.length === 0 && <div className="empty-state">No projects match that search.</div>}</section>
        <section className="about" id="about"><div className="about-card"><div><p className="section-kicker">A living showcase</p><h2>Built to be updated.</h2><p>Add live projects or upload APK, EXE, browser extension and other files from the Manage panel. Files are stored in Supabase Storage and delivered as public downloads.</p></div><div className="about-code"><span>project</span><strong>{'{ url | apk | exe | extension | file }'}</strong></div></div></section>
      </main>
      <footer><span>© {new Date().getFullYear()} Madhav Manchanda</span><a href="https://github.com/madhav-manchanda" target="_blank" rel="noreferrer">GitHub <ExternalLink size={14} /></a></footer>
      {adminOpen && <AdminPanel projects={projects} setProjects={setProjects} adminKey={adminKey} setAdminKey={saveKey} message={message} setMessage={setMessage} onClose={() => { setAdminOpen(false); setMessage('') }} />}
    </div>
  )
}

function ProjectCard({ project }) {
  const isFile = isFileProject(project)
  const actionUrl = isFile ? ((project.filePath || project.apkPath || project.apkUrl) ? `/api/download?id=${encodeURIComponent(project.id)}` : '') : project.url
  const icon = project.type === 'APK' ? <Smartphone size={25} /> : project.type === 'Live' ? <Globe size={25} /> : project.type === 'File' ? <File size={25} /> : <FileArchive size={25} />
  const actionLabel = isFile ? `Download ${project.type === 'APK' ? 'APK' : project.type === 'EXE' ? 'EXE' : project.type === 'Extension' ? 'extension' : 'file'}` : 'Open project'
  return <article className={project.featured ? 'project-card featured' : 'project-card'}><div className="card-topline"><span className={isFile ? 'type-badge apk' : 'type-badge live'}>{project.type === 'APK' ? <Smartphone size={13} /> : project.type === 'Live' ? <Globe size={13} /> : project.type === 'File' ? <File size={13} /> : <FileArchive size={13} />}{typeLabel(project.type)}</span>{project.featured && <span className="featured-label">Featured</span>}</div><div className="card-icon">{icon}</div><h3>{project.name}</h3><p>{project.description}</p><div className="card-meta">{project.version || (project.fileName ? project.fileName : '')}</div><div className="card-actions">{actionUrl ? <a className="card-primary" href={actionUrl} target={isFile ? undefined : '_blank'} rel={isFile ? undefined : 'noreferrer'} download={isFile ? true : undefined}>{isFile ? <><Download size={16} /> {actionLabel}</> : <><ExternalLink size={16} /> {actionLabel}</>}</a> : <span className="card-primary disabled">Add {isFile ? 'file' : 'live URL'}<ArrowUpRight size={16} /></span>}{project.github && <a className="github-link" href={project.github} target="_blank" rel="noreferrer" aria-label={`${project.name} source code`}><Code2 size={18} /></a>}</div></article>
}

function AdminPanel({ projects, setProjects, adminKey, setAdminKey, message, setMessage, onClose }) {
  const fileRef = useRef(null)
  const [form, setForm] = useState({ name: '', type: 'Live', description: '', version: '', url: '', github: '', featured: false })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const isUploadType = isFileProject(form)

  async function saveProject(event) {
    event.preventDefault()
    const key = adminKey.trim()
    if (!key) return setMessage('Enter your admin key first.')
    if (!form.name.trim() || !form.description.trim()) return setMessage('Name and description are required.')
    if (form.type === 'Live' && !form.url.trim()) return setMessage('Add the deployed website URL.')
    if (isUploadType && !file) return setMessage(`Choose a ${fileDescription(form.type)} file to upload.`)

    setBusy(true); setMessage('')
    try {
      let filePath = ''; let fileName = ''; let fileContentType = ''; let fileSize = 0

      if (isUploadType) {
        const uploadContentType = file.type || 'application/octet-stream'
        const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
        if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is required for browser uploads.')

        setMessage(`Preparing secure ${fileDescription(form.type)} upload…`)
        const tokenResponse = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminKey: key, filename: file.name, contentType: uploadContentType, size: file.size }),
        })
        const tokenData = await tokenResponse.json().catch(() => ({}))
        if (!tokenResponse.ok) throw new Error(tokenData.error || `Could not prepare upload (${tokenResponse.status})`)

        if (!tokenData.signedUrl || !tokenData.token || !tokenData.pathname) {
          throw new Error('Supabase did not return a usable signed upload URL.')
        }

        setMessage(`Uploading ${fileDescription(form.type)}… 0%`)
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', tokenData.signedUrl, true)
          xhr.setRequestHeader('Content-Type', uploadContentType)
          xhr.setRequestHeader('Cache-Control', 'max-age=3600')

          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return
            const percent = Math.round((event.loaded / event.total) * 100)
            setMessage(`Uploading ${fileDescription(form.type)}… ${percent}%`)
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
              return
            }

            let details = ''
            try {
              const body = JSON.parse(xhr.responseText)
              details = body.message || body.error || ''
            } catch {
              details = xhr.responseText || ''
            }

            reject(new Error(details || `Supabase upload failed (${xhr.status}).`))
          }

          xhr.onerror = () => reject(new Error('Network error while uploading the file to Supabase Storage.'))
          xhr.onabort = () => reject(new Error('Upload was cancelled.'))
          xhr.send(file)
        })

        filePath = tokenData.pathname
        fileName = file.name
        fileContentType = uploadContentType
        fileSize = file.size

        setMessage(`Verifying ${fileDescription(form.type)} upload…`)
        const verifyResponse = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', adminKey: key, pathname: filePath, size: file.size, contentType: fileContentType }),
        })
        const verifyData = await verifyResponse.json().catch(() => ({}))
        if (!verifyResponse.ok || !verifyData.verified) {
          throw new Error(verifyData.error || 'Upload finished, but Supabase Storage verification failed. The project was not saved.')
        }
      }

      const project = {
        id: `${Date.now()}-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
        ...form,
        filePath,
        fileName,
        fileContentType,
        fileSize,
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ project }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save project')

      const savedProject = data.project || project
      setProjects([savedProject, ...projects.filter((item) => item.id !== savedProject.id)])
      setForm({ name: '', type: 'Live', description: '', version: '', url: '', github: '', featured: false })
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setMessage('Project added successfully.')
    } catch (error) {
      setMessage(error.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function removeProject(id) {
    const key = adminKey.trim()
    if (!key) return setMessage('Enter your admin key first.')
    setBusy(true); setMessage('Removing project…')
    try {
      const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-admin-key': key } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Remove failed (${response.status})`)
      setProjects(data.projects || projects.filter((project) => project.id !== id))
      setMessage('Project removed successfully.')
    } catch (error) {
      setMessage(error.message || 'Could not remove project.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="admin-panel"><div className="admin-head"><div><p className="section-kicker">Private controls</p><h2>Manage projects</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><p className="admin-note">Your admin key is sent only to the Vercel API to authorize uploads and project changes. Files are stored in Supabase Storage.</p><label className="field"><span>Admin key</span><input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Vercel ADMIN_UPLOAD_KEY" /></label><form onSubmit={saveProject} className="admin-form"><div className="form-row"><label className="field"><span>Project name</span><input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="My Project" /></label><label className="field"><span>Type</span><select value={form.type} onChange={(e) => { update('type', e.target.value); setFile(null); if (fileRef.current) fileRef.current.value = '' }}><option>Live</option><option>APK</option><option>EXE</option><option>Extension</option><option>File</option></select></label></div><label className="field"><span>Short description</span><textarea value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What does this project do?" rows="3" /></label><div className="form-row"><label className="field"><span>Version / platform</span><input value={form.version} onChange={(e) => update('version', e.target.value)} placeholder="Web app / Android / Windows / Chrome" /></label><label className="field"><span>GitHub URL <em>optional</em></span><input value={form.github} onChange={(e) => update('github', e.target.value)} placeholder="https://github.com/..." /></label></div>{form.type === 'Live' ? <label className="field"><span>Deployed URL</span><input value={form.url} onChange={(e) => update('url', e.target.value)} placeholder="https://my-project.vercel.app" /></label> : <label className="upload-box" htmlFor="project-file-upload"><UploadCloud size={30} /><strong>{file ? file.name : `Upload ${fileDescription(form.type)}`}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB selected` : form.type === 'APK' ? 'Choose an .apk file' : form.type === 'EXE' ? 'Choose an .exe file' : form.type === 'Extension' ? 'ZIP, CRX or XPI file' : 'Any file type is allowed'}</span><input id="project-file-upload" ref={fileRef} type="file" accept={fileAccept(form.type)} onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>}<label className="check-row"><input type="checkbox" checked={form.featured} onChange={(e) => update('featured', e.target.checked)} /><span>Mark as featured</span></label><button className="save-button" disabled={busy}>{busy ? 'Working…' : <><Check size={16} /> Add project</>}</button></form>{message && <div className="admin-message">{message}</div>}<div className="admin-list"><p className="section-kicker">Current projects</p>{projects.map((project) => <div className="admin-project" key={project.id}><div><strong>{project.name}</strong><span>{typeLabel(project.type)}</span></div><button disabled={busy} onClick={() => removeProject(project.id)} title={`Delete ${project.name}`}><Trash2 size={15} /></button></div>)}</div></aside></div>
}

createRoot(document.getElementById('root')).render(<App />)
