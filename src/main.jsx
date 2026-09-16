import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { upload } from '@vercel/blob/client'
import {
  ArrowUpRight, Boxes, Check, Download, ExternalLink, Code2, Globe, Menu,
  Smartphone, Sparkles, UploadCloud, X, Trash2, LockKeyhole,
} from 'lucide-react'
import './styles.css'

const fallbackProjects = [
  { id: 'veya', name: 'Veya', type: 'APK', description: 'A private Android messenger built with Kotlin, Supabase and realtime communication.', version: 'Android app', apkUrl: '', url: '', github: 'https://github.com/madhav-manchanda/veya', featured: true },
  { id: 'logixchange', name: 'LogixChange', type: 'Live', description: 'A logistics matching platform connecting shipment demand with available transport capacity.', version: 'Web app', apkUrl: '', url: '', github: '', featured: true },
]

function App() {
  const [projects, setProjects] = useState(fallbackProjects)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/projects').then((r) => r.ok ? r.json() : fallbackProjects).then(setProjects).catch(() => {})
  }, [])

  const visible = useMemo(() => projects.filter((project) => {
    const matchesFilter = filter === 'All' || (filter === 'Apps' ? project.type === 'APK' : project.type === 'Live')
    return matchesFilter && `${project.name} ${project.description}`.toLowerCase().includes(query.toLowerCase())
  }), [filter, query, projects])

  return (
    <div className="site-shell">
      <header className="nav">
        <a className="brand" href="#top"><span className="brand-mark"><Sparkles size={17} /></span><span>madhav<span className="brand-dot">.</span></span></a>
        <nav className={mobileOpen ? 'nav-links open' : 'nav-links'}>
          <a href="#projects" onClick={() => setMobileOpen(false)}>Projects</a>
          <a href="#about" onClick={() => setMobileOpen(false)}>About</a>
          <a href="https://github.com/madhav-manchanda" target="_blank" rel="noreferrer" onClick={() => setMobileOpen(false)}>GitHub</a>
        </nav>
        <div className="nav-actions">
          <button className="manage-button" onClick={() => setAdminOpen(true)}><LockKeyhole size={14} /> Manage</button>
          <button className="icon-button menu-button" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse-dot" /> Project lab</div>
            <h1>Things I've built,<br /><span>ready to try.</span></h1>
            <p>One place for my deployed web projects and Android apps. Open a live build or download an APK and explore.</p>
            <a className="primary-button" href="#projects">Explore projects <ArrowUpRight size={17} /></a>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit orbit-one"><div className="orbit-node node-one"><Globe size={18} /></div></div>
            <div className="orbit orbit-two"><div className="orbit-node node-two"><Smartphone size={18} /></div></div>
            <div className="orbit-core"><Boxes size={28} /></div>
          </div>
        </section>

        <section className="project-section" id="projects">
          <div className="section-head"><div><p className="section-kicker">Selected work</p><h2>Projects</h2></div><div className="project-count">{projects.length.toString().padStart(2, '0')} builds</div></div>
          <div className="toolbar">
            <div className="filter-group">{['All', 'Live', 'Apps'].map((item) => <button key={item} className={filter === item ? 'filter active' : 'filter'} onClick={() => setFilter(item)}>{item}</button>)}</div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects" />
          </div>
          <div className="project-grid">{visible.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
          {visible.length === 0 && <div className="empty-state">No projects match that search.</div>}
        </section>

        <section className="about" id="about"><div className="about-card"><div><p className="section-kicker">A living showcase</p><h2>Built to be updated.</h2><p>Add live projects by URL or upload Android APKs from the Manage panel. APK files are stored separately from the React deployment and served directly to visitors.</p></div><div className="about-code"><span>project</span><strong>{'{ url | apk }'}</strong></div></div></section>
      </main>
      <footer><span>© {new Date().getFullYear()} Madhav Manchanda</span><a href="https://github.com/madhav-manchanda" target="_blank" rel="noreferrer">GitHub <ExternalLink size={14} /></a></footer>

      {adminOpen && <AdminPanel projects={projects} setProjects={setProjects} adminKey={adminKey} setAdminKey={setAdminKey} message={message} setMessage={setMessage} onClose={() => { setAdminOpen(false); setMessage('') }} />}
    </div>
  )
}

function ProjectCard({ project }) {
  const isApk = project.type === 'APK'
  const actionUrl = isApk ? project.apkUrl : project.url
  return <article className={project.featured ? 'project-card featured' : 'project-card'}>
    <div className="card-topline"><span className={isApk ? 'type-badge apk' : 'type-badge live'}>{isApk ? <Smartphone size={13} /> : <Globe size={13} />}{isApk ? 'Android APK' : 'Live website'}</span>{project.featured && <span className="featured-label">Featured</span>}</div>
    <div className="card-icon">{isApk ? <Smartphone size={25} /> : <Globe size={25} />}</div>
    <h3>{project.name}</h3><p>{project.description}</p><div className="card-meta">{project.version}</div>
    <div className="card-actions">
      {actionUrl ? <a className="card-primary" href={actionUrl} target={isApk ? undefined : '_blank'} rel={isApk ? undefined : 'noreferrer'} download={isApk ? true : undefined}>{isApk ? <><Download size={16} /> Download APK</> : <><ExternalLink size={16} /> Open project</>}</a> : <span className="card-primary disabled">Add {isApk ? 'APK' : 'live URL'}<ArrowUpRight size={16} /></span>}
      {project.github && <a className="github-link" href={project.github} target="_blank" rel="noreferrer" aria-label={`${project.name} source code`}><Code2 size={18} /></a>}
    </div>
  </article>
}

function AdminPanel({ projects, setProjects, adminKey, setAdminKey, message, setMessage, onClose }) {
  const fileRef = useRef(null)
  const [form, setForm] = useState({ name: '', type: 'Live', description: '', version: '', url: '', github: '', featured: false })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function saveProject(event) {
    event.preventDefault()
    if (!adminKey) return setMessage('Enter your admin key first.')
    if (!form.name.trim() || !form.description.trim()) return setMessage('Name and description are required.')
    if (form.type === 'Live' && !form.url.trim()) return setMessage('Add the deployed website URL.')
    if (form.type === 'APK' && !file) return setMessage('Choose an APK file to upload.')

    setBusy(true); setMessage('')
    try {
      let apkUrl = ''
      if (form.type === 'APK') {
        setMessage('Uploading APK directly from your browser…')
        const blob = await upload(`apks/${file.name}`, file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          clientPayload: JSON.stringify({ adminKey }),
          multipart: true,
          onUploadProgress: (event) => setMessage(`Uploading APK… ${Math.round(event.percentage)}%`),
        })
        apkUrl = blob.downloadUrl || blob.url
      }

      const project = { id: `${Date.now()}-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`, ...form, apkUrl }
      const next = [project, ...projects]
      const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ projects: next }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save project')
      setProjects(next)
      setForm({ name: '', type: 'Live', description: '', version: '', url: '', github: '', featured: false })
      setFile(null); if (fileRef.current) fileRef.current.value = ''
      setMessage('Project added successfully.')
    } catch (error) { setMessage(error.message || 'Something went wrong.') } finally { setBusy(false) }
  }

  async function removeProject(id) {
    if (!adminKey) return setMessage('Enter your admin key first.')
    const next = projects.filter((project) => project.id !== id)
    const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey }, body: JSON.stringify({ projects: next }) })
    if (response.ok) { setProjects(next); setMessage('Project removed.') } else setMessage('Could not remove project.')
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="admin-panel">
      <div className="admin-head"><div><p className="section-kicker">Private controls</p><h2>Manage projects</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
      <p className="admin-note">Your admin key is sent only to the Vercel API to authorize uploads and project changes. It is never saved in the project files.</p>
      <label className="field"><span>Admin key</span><input type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Vercel ADMIN_UPLOAD_KEY" /></label>
      <form onSubmit={saveProject} className="admin-form">
        <div className="form-row"><label className="field"><span>Project name</span><input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="My Project" /></label><label className="field"><span>Type</span><select value={form.type} onChange={(e) => update('type', e.target.value)}><option>Live</option><option>APK</option></select></label></div>
        <label className="field"><span>Short description</span><textarea value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="What does this project do?" rows="3" /></label>
        <div className="form-row"><label className="field"><span>Version / platform</span><input value={form.version} onChange={(e) => update('version', e.target.value)} placeholder="Web app / Android app" /></label><label className="field"><span>GitHub URL <em>optional</em></span><input value={form.github} onChange={(e) => update('github', e.target.value)} placeholder="https://github.com/..." /></label></div>
        {form.type === 'Live' ? <label className="field"><span>Deployed URL</span><input value={form.url} onChange={(e) => update('url', e.target.value)} placeholder="https://my-project.vercel.app" /></label> : <label className="upload-box"><UploadCloud size={25} /><strong>{file ? file.name : 'Choose APK'}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB selected` : 'The file uploads directly from your browser'}</span><input ref={fileRef} type="file" accept=".apk,application/vnd.android.package-archive" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>}
        <label className="check-row"><input type="checkbox" checked={form.featured} onChange={(e) => update('featured', e.target.checked)} /><span>Mark as featured</span></label>
        <button className="save-button" disabled={busy}>{busy ? 'Working…' : <><Check size={16} /> Add project</>}</button>
      </form>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-list"><p className="section-kicker">Current projects</p>{projects.map((project) => <div className="admin-project" key={project.id}><div><strong>{project.name}</strong><span>{project.type}</span></div><button onClick={() => removeProject(project.id)} title={`Delete ${project.name}`}><Trash2 size={15} /></button></div>)}</div>
    </aside>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
