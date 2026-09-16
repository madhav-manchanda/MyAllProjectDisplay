import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowUpRight,
  Boxes,
  Download,
  ExternalLink,
  Github,
  Globe,
  Menu,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react'
import './styles.css'

const projects = [
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

function App() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [mobileOpen, setMobileOpen] = useState(false)

  const visible = useMemo(() => {
    return projects.filter((project) => {
      const matchesFilter = filter === 'All' || (filter === 'Apps' ? project.type === 'APK' : project.type === 'Live')
      const haystack = `${project.name} ${project.description}`.toLowerCase()
      return matchesFilter && haystack.includes(query.toLowerCase())
    })
  }, [filter, query])

  return (
    <div className="site-shell">
      <header className="nav">
        <a className="brand" href="#top" aria-label="Madhav projects home">
          <span className="brand-mark"><Sparkles size={17} /></span>
          <span>madhav<span className="brand-dot">.</span></span>
        </a>
        <nav className={mobileOpen ? 'nav-links open' : 'nav-links'}>
          <a href="#projects" onClick={() => setMobileOpen(false)}>Projects</a>
          <a href="#about" onClick={() => setMobileOpen(false)}>About</a>
          <a href="https://github.com/madhav-manchanda" target="_blank" rel="noreferrer" onClick={() => setMobileOpen(false)}>GitHub</a>
        </nav>
        <button className="icon-button menu-button" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
          {mobileOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
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
          <div className="section-head">
            <div>
              <p className="section-kicker">Selected work</p>
              <h2>Projects</h2>
            </div>
            <div className="project-count">{projects.length.toString().padStart(2, '0')} builds</div>
          </div>

          <div className="toolbar">
            <div className="filter-group">
              {['All', 'Live', 'Apps'].map((item) => (
                <button key={item} className={filter === item ? 'filter active' : 'filter'} onClick={() => setFilter(item)}>{item}</button>
              ))}
            </div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects" />
          </div>

          <div className="project-grid">
            {visible.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
          {visible.length === 0 && <div className="empty-state">No projects match that search.</div>}
        </section>

        <section className="about" id="about">
          <div className="about-card">
            <div>
              <p className="section-kicker">A living showcase</p>
              <h2>Built to be updated.</h2>
              <p>Add a project by editing one entry in the project list: name, short description, then either a deployed URL or an APK download URL. The site stays intentionally simple so the projects stay the focus.</p>
            </div>
            <div className="about-code">
              <span>project</span>
              <strong>{'{ url | apk }'}</strong>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <span>© {new Date().getFullYear()} Madhav Manchanda</span>
        <a href="https://github.com/madhav-manchanda" target="_blank" rel="noreferrer">GitHub <ExternalLink size={14} /></a>
      </footer>
    </div>
  )
}

function ProjectCard({ project }) {
  const isApk = project.type === 'APK'
  const actionUrl = isApk ? project.apkUrl : project.url
  const hasAction = Boolean(actionUrl)

  return (
    <article className={project.featured ? 'project-card featured' : 'project-card'}>
      <div className="card-topline">
        <span className={isApk ? 'type-badge apk' : 'type-badge live'}>{isApk ? <Smartphone size={13} /> : <Globe size={13} />}{isApk ? 'Android APK' : 'Live website'}</span>
        {project.featured && <span className="featured-label">Featured</span>}
      </div>
      <div className="card-icon">{isApk ? <Smartphone size={25} /> : <Globe size={25} />}</div>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      <div className="card-meta">{project.version}</div>
      <div className="card-actions">
        {hasAction ? (
          <a className="card-primary" href={actionUrl} target={isApk ? undefined : '_blank'} rel={isApk ? undefined : 'noreferrer'} download={isApk ? true : undefined}>
            {isApk ? <><Download size={16} /> Download APK</> : <><ExternalLink size={16} /> Open project</>}
          </a>
        ) : (
          <span className="card-primary disabled">Add {isApk ? 'APK URL' : 'live URL'}<ArrowUpRight size={16} /></span>
        )}
        {project.github && <a className="github-link" href={project.github} target="_blank" rel="noreferrer" aria-label={`${project.name} source code`}><Github size={18} /></a>}
      </div>
    </article>
  )
}

createRoot(document.getElementById('root')).render(<App />)
