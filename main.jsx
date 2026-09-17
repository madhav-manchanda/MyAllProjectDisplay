import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { upload } from '@vercel/blob/client'
import { ArrowUpRight, Boxes, Check, Download, ExternalLink, Code2, Globe, Menu, Smartphone, Sparkles, UploadCloud, X, Trash2, LockKeyhole, FileArchive, AlertTriangle } from 'lucide-react'
import './styles.css'

const fallbackProjects = [
  { id: 'veya', name: 'Veya', type: 'APK', description: 'A private Android messenger built with Kotlin, Supabase and realtime communication.', version: 'Android app', apkUrl: '', apkPath: '', url: '', github: 'https://github.com/madhav-manchanda/veya', featured: true },
  { id: 'logixchange', name: 'LogixChange', type: 'Live', description: 'A logistics matching platform connecting shipment demand with available transport capacity.', version: 'Web app', apkUrl: '', apkPath: '', url: '', github: '', featured: true },
]

const FILE_TYPES = ['APK', 'EXE', 'Extension']

function isFileProject(project) {
  return FILE_TYPES.includes(project.type)
}

function fileAccept(type) {
  if (type === 'APK') return '.apk,application/vnd.android.package-archive,application/octet-stream'
  if (type === 'EXE') return '.exe,application/vnd.microsoft.portable-executable,application/x-msdownload,application/octet-stream'
  return '.zip,.crx,.xpi,application/zip,application/x-chrome-extension,application/x-xpinstall,application/octet-stream'
}

function typeLabel(type) {
  if (type === 'APK') return 'Android APK'
  if (type === 'EXE') return 'Windows EXE'
  if (type === 'Extension') return 'Browser extension'
  return 'Live website'
}

function safeFilename(name) {
  const base = String(name || 'file').split(/[/\\]/).pop() || 'file'
  return base.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function App() {
  const [projects, setProjects] = useState(fallbackProjects)
  const [loadError, setLoadError] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('admin-project-key') || '')
  const [message, setMessage] = useState('')

  const loadProjects = () => {
    setLoadError(false)
    return fetch('/api/projects')
      .then((r) => { if (!r.ok) throw new Error('load failed'); return r.json() })
      .then((data) => setProjects(data))
      .catch(() => setLoadError(true))
  }

  useEffect(() => { loadProjects() }, [])

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
        <section className="project-section" id="projects"><div className="section-head"><div><p className="section-kicker">Selected work</p><h2>Projects</h2></div><div className="project-count">{projects.length.toString().padStart(2, '0')} builds</div></div>{loadError && <div className="empty-state" style={{ padding: '14px 0' }}><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Couldn't load the latest projects — showing a cached list. <button className="filter" style={{ marginLeft: 10 }} onClick={loadProjects}>Retry</button></div>}<div className="toolbar"><div className="filter-group">{['All', 'Live', 'Apps'].map((item) => <button key={item} className={filter === item ? 'filter active' : 'filter'} onClick={() => setFilter(item)}>{item}</button>)}</div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects" /></div><div className="project-grid">{visible.map((project) => <ProjectCard key={project.id} project={project} />)}</div>{visible.length === 0 && <div className="empty-state">No projects match that search.</div>}</section>
        <section className="about" id="about"><div className="about-card"><div><p className="section-kicker">A living showcase</p><h2>Built to be updated.</h2><p>Add live projects or upload APK, EXE and browser extension files from the Manage panel. Uploaded files are kept in Blob storage and delivered through a controlled download endpoint.</p></div><div className="about-code"><span>project</span><strong>{'{ url | apk | exe | extension }'}</strong></div></div></section>
      </main>
      <footer><span>© {new Date().getFullYear()} Madhav Manchanda</span><a href="https://github.com/madhav-manchanda" target="_blank" rel="noreferrer">GitHub <ExternalLink size={14} /></a></footer>
      {adminOpen && <AdminPanel projects={projects} setProjects={setProjects} adminKey={adminKey} setAdminKey={saveKey} message={message} setMessage={setMessage} onClose={() => { setAdminOpen(false); setMessage('') }} />}
    </div>
  )
}

function ProjectCard({ project }) {
  const isFile = isFileProject(project)
  const actionUrl = isFile ? ((project.filePath || project.apkPath || project.apkUrl) ? `/api/download?id=${encodeURIComponent(project.id)}` : '') : project.url
  const icon = project.type === 'APK' ? <Smartphone size={25} /> : project.type === 'Live' ? <Globe size={25} /> : <FileArchive size={25} />
  const actionLabel = isFile ? `Download ${project.type === 'APK' ? 'APK' : project.type === 'EXE' ? 'EXE' : 'extension'}` : 'Open project'
  return <article className={project.featured ? 'project-card featured' : 'project-card'}><div className="card-topline"><span className={isFile ? 'type-badge apk' : 'type-badge live'}>{project.type === 'APK' ? <Smartphone size={13} /> : project.type === 'Live' ? <Globe size={13} /> : <FileArchive size={13} />}{typeLabel(project.type)}</span>{project.featured && <span className="featured-label">Featured</span>}</div><div className="card-icon">{icon}</div><h3>{project.name}</h3><p>{project.description}</p><div className="card-meta">{project.version}</div><div className="card-actions">{actionUrl ? <a className="card-primary" href={actionUrl} target={isFile ? undefined : '_blank'} rel={isFile ? undefined : 'noreferrer'} download={isFile ? true : undefined}>{isFile ? <><Download size={16} /> {actionLabel}</> : <><ExternalLink size={16} /> {actionLabel}</>}</a> : <span className="card-primary disabled">Add {isFile ? 'file' : 'live URL'}<ArrowUpRight size={16} /></span>}{project.github && <a className="github-link" href={project.github} target="_blank" rel="noreferrer" aria-label={`${project.name} source code`}><Code2 size={18} /></a>}</div></article>
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
    if (isUploadType && !file) return setMessage(`Choose a ${form.type === 'APK' ? 'APK' : form.type === 'EXE' ? 'EXE' : 'browser extension'} file to upload.`)

    setBusy(true); setMessage('')
    try {
      let filePath = ''; let fileName = ''; let fileContentType = ''
      if (isUploadType) {
        const label = form.type === 'APK' ? 'APK' : form.type === 'EXE' ? 'EXE' : 'extension'
        const pathname = `files/${Date.now()}-${safeFilename(file.name)}`

        setMessage(`Uploading ${label}… 0%`)
        // upload() implements the documented Vercel Blob client-upload protocol:
        // it requests a scoped token from /api/upload, PUTs the file straight to
        // Blob storage, and only resolves once Vercel Blob has actually accepted
        // and stored the object. A resolved promise here is real confirmation,
        // not a guess.
        const blob = await upload(pathname, file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          headers: { 'x-admin-key': key },
          contentType: file.type || 'application/octet-stream',
          onUploadProgress: ({ percentage }) => setMessage(`Uploading ${label}… ${Math.round(percentage)}%`),
        })

        filePath = blob.pathname
        fileName = file.name
        fileContentType = blob.contentType
        setMessage(`Verifying ${label}…`)
      }

      const project = {
        id: `${Date.now()}-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
        ...form,
        filePath,
        fileName,
        fileContentType,
      }

      // The server re-reads the current project list itself, verifies the file
      // (via head()) if there is one, and prepends — it never trusts a full
      // array from us, so a stale or fallback client list can't clobber real
      // remote data.
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ project }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save project')

      setProjects(data.projects || [project, ...projects])
      setForm({ name: '', type: 'Live', description: '', version: '', url: '', github: '', featured: false })
      setFile(null); if (fileRef.current) fileRef.current.value = ''
      setMessage('Project added successfully.')
    } catch (error) { setMessage(error.message || 'Something went wrong.') } finally { setBusy(false) }
  }

  async function removeProject(id) {
    const key = adminKey.trim(); if (!key) return setMessage('Enter your admin key first.')
    setBusy(true); setMessage('Removing project…')
    try {
      const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-admin-key': key } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Remove failed (${response.status})`)
      setProjects(data.projects || projects.filter((project) => project.id !== id)); setMessage('Project removed successfully.')
    } catch (error) { setMessage(error.message || 'Could not remove project.') } finally { setBusy(false) }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="admin-panel"><div className="admin-head"><div><p className="section-kicker">Private controls</p><h2>Manage projects</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><p className="admin-note">Your admin key is sent only to the Vercel API to authorize uploads and project changes. Files are stored in Blob storage.</p><label className="field"><span>Admin key</span><input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Vercel ADMIN_UPLOAD_KEY" /></label><form onSubmit={saveProject} className="admin-form"><div className="form-row"><label className="field"><span>Project name</span><input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="My Project" /></label><label className="field"><span>Type</span><select value={form.type} onChange={(e) => { update('type', e.target.value); setFile(null); if (fileRef.current) fileRef.current.value = '' }}><option>Live</option><option>APK</option><option>EXE</option><option>Extension</option></select></label></div><label className="field"><span>Short description</span><textarea value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What does this project do?" rows="3" /></label><div className="form-row"><label className="field"><span>Version / platform</span><input value={form.version} onChange={(e) => update('version', e.target.value)} placeholder="Web app / Android / Windows / Chrome" /></label><label className="field"><span>GitHub URL <em>optional</em></span><input value={form.github} onChange={(e) => update('github', e.target.value)} placeholder="https://github.com/..." /></label></div>{form.type === 'Live' ? <label className="field"><span>Deployed URL</span><input value={form.url} onChange={(e) => update('url', e.target.value)} placeholder="https://my-project.vercel.app" /></label> : <label className="upload-box" htmlFor="project-file-upload"><UploadCloud size={30} /><strong>{file ? file.name : `Upload ${form.type === 'APK' ? 'Android APK' : form.type === 'EXE' ? 'Windows EXE' : 'Browser extension'}`}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB selected` : form.type === 'Extension' ? 'ZIP, CRX or XPI file' : `Choose a .${form.type.toLowerCase()} file`}</span><input id="project-file-upload" ref={fileRef} type="file" accept={fileAccept(form.type)} onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>}<label className="check-row"><input type="checkbox" checked={form.featured} onChange={(e) => update('featured', e.target.checked)} /><span>Mark as featured</span></label><button className="save-button" disabled={busy}>{busy ? 'Working…' : <><Check size={16} /> Add project</>}</button></form>{message && <div className="admin-message">{message}</div>}<div className="admin-list"><p className="section-kicker">Current projects</p>{projects.map((project) => <div className="admin-project" key={project.id}><div><strong>{project.name}</strong><span>{typeLabel(project.type)}</span></div><button disabled={busy} onClick={() => removeProject(project.id)} title={`Delete ${project.name}`}><Trash2 size={15} /></button></div>)}</div></aside></div>
}

createRoot(document.getElementById('root')).render(<App />)
