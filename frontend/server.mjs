import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT || 8080)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
const INDEX = path.join(ROOT, 'index.html')

const APP_PREFIXES = [
  '/login',
  '/register',
  '/reset-password',
  '/app',
]

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

/** Origin of a URL from the environment, or '' when unset / invalid. */
function originOf(value) {
  try {
    const u = new URL(String(value || '').trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : ''
  } catch {
    return ''
  }
}

// The browser only talks to the API gateway (auth / rest / storage / functions) and the PDF service.
// Railway exposes service variables at runtime too, so the same VITE_* values used by the build work here.
// CSP_CONNECT_SRC adds extra origins (space- or comma-separated) without a code change.
const API_ORIGIN = originOf(process.env.VITE_SUPABASE_URL)
const PDF_ORIGIN = originOf(process.env.VITE_PDF_SERVICE_URL)
const EXTRA_CONNECT = String(process.env.CSP_CONNECT_SRC || '')
  .split(/[\s,]+/)
  .map(originOf)
  .filter(Boolean)
const CONNECT_ORIGINS = [...new Set([API_ORIGIN, PDF_ORIGIN, ...EXTRA_CONNECT].filter(Boolean))]
if (!API_ORIGIN) {
  console.warn('[frontend] VITE_SUPABASE_URL is not set at runtime: CSP falls back to any https origin.')
}
// Without a known API origin keep the old, looser policy rather than break the app.
const connectSrc = API_ORIGIN ? CONNECT_ORIGINS.join(' ') : 'https: wss:'
// Signed storage URLs are served by the gateway; data:/blob: are local previews and captures.
const imgSrc = API_ORIGIN ? `data: blob: ${API_ORIGIN}` : 'data: blob: https:'

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' ${imgSrc}`,
  `connect-src 'self' ${connectSrc}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(API_ORIGIN.startsWith('https:') ? ['upgrade-insecure-requests'] : []),
].join('; ')

// Camera stays on for this origin (capture studio, ring test); everything else is off.
const PERMISSIONS_POLICY = [
  'camera=(self)',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'serial=()',
  'bluetooth=()',
  'hid=()',
  'midi=()',
  'magnetometer=()',
  'gyroscope=()',
  'accelerometer=()',
  'display-capture=()',
  'browsing-topics=()',
  'fullscreen=(self)',
].join(', ')

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': CSP,
    'Permissions-Policy': PERMISSIONS_POLICY,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
  }
}

function isAppPath(pathname) {
  if (pathname === '/') return true
  return APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function sendFile(res, filePath, status) {
  const ext = path.extname(filePath).toLowerCase()
  const body = fs.readFileSync(filePath)
  res.writeHead(status, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Content-Length': body.length,
    // Only hashed build assets are immutable; the shell, service worker, manifest and icons are revalidated.
    'Cache-Control': filePath.startsWith(path.join(ROOT, 'assets') + path.sep) ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...securityHeaders(),
  })
  res.end(body)
}

if (!fs.existsSync(INDEX)) {
  console.error('[frontend] dist/index.html is missing. The Vite build did not run.')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://frontend.local')
  const pathname = decodeURIComponent(url.pathname)
  if (pathname.includes('..')) {
    res.writeHead(400, securityHeaders())
    res.end('Bad request')
    return
  }

  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...securityHeaders() })
    res.end('ok')
    return
  }

  const relative = pathname.replace(/^\/+/, '')
  const filePath = path.resolve(ROOT, relative)
  const insideRoot = filePath === ROOT || filePath.startsWith(`${ROOT}${path.sep}`)
  if (insideRoot && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath, 200)
    return
  }

  const ext = path.extname(pathname)
  if (ext) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders() })
    res.end('Not found')
    return
  }

  if (!fs.existsSync(INDEX)) {
    res.writeHead(500, { 'Content-Type': 'text/plain', ...securityHeaders() })
    res.end('Frontend build is missing')
    return
  }

  sendFile(res, INDEX, isAppPath(pathname) ? 200 : 404)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[frontend] listening on ${PORT}`)
})
