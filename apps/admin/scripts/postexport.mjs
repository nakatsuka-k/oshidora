import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const projectRoot = new URL('..', import.meta.url).pathname
const distDir = join(projectRoot, 'dist')
const srcRedirects = join(projectRoot, 'public', '_redirects')
const destRedirects = join(distDir, '_redirects')
const srcRobots = join(projectRoot, 'public', 'robots.txt')
const destRobots = join(distDir, 'robots.txt')

if (!existsSync(distDir)) {
  console.error('[admin postexport] dist/ not found. Run expo export first.')
  process.exit(1)
}

if (existsSync(srcRedirects)) {
  mkdirSync(dirname(destRedirects), { recursive: true })
  cpSync(srcRedirects, destRedirects)
  console.log('[admin postexport] Copied _redirects -> dist/_redirects')
} else {
  console.warn('[admin postexport] public/_redirects not found; skipping')
}

if (existsSync(srcRobots)) {
  mkdirSync(dirname(destRobots), { recursive: true })
  cpSync(srcRobots, destRobots)
  console.log('[admin postexport] Copied robots.txt -> dist/robots.txt')
} else {
  console.warn('[admin postexport] public/robots.txt not found; skipping')
}
