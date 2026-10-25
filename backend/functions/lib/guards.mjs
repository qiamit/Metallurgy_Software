// Small in-process guards for the functions service: rate limits and a concurrency gate.
// One Railway replica keeps these in memory; with several replicas each one limits on its own.

/**
 * Fixed-window rate limiter.
 * @param {{ limit: number, windowMs: number, now?: () => number }} opts
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map()
  let lastSweep = now()

  function sweep(t) {
    if (t - lastSweep < windowMs) return
    lastSweep = t
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key)
  }

  return {
    /** @returns {{ ok: boolean, retryAfterSec: number }} */
    take(key) {
      const t = now()
      sweep(t)
      const entry = hits.get(key)
      if (!entry || entry.resetAt <= t) {
        hits.set(key, { count: 1, resetAt: t + windowMs })
        return { ok: true, retryAfterSec: 0 }
      }
      if (entry.count >= limit) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - t) / 1000)) }
      }
      entry.count += 1
      return { ok: true, retryAfterSec: 0 }
    },
    size() {
      return hits.size
    },
  }
}

/**
 * Limits how many heavy tasks (OpenCV) run at once; extra callers wait in a bounded queue.
 * @param {{ max: number, maxQueue: number }} opts
 */
export function createGate({ max, maxQueue }) {
  let active = 0
  /** @type {Array<() => void>} */
  const queue = []

  function release() {
    active -= 1
    const next = queue.shift()
    if (next) {
      active += 1
      next()
    }
  }

  return {
    /**
     * @template T
     * @param {() => Promise<T>} task
     * @returns {Promise<T>}
     */
    async run(task) {
      if (active >= max) {
        if (queue.length >= maxQueue) {
          const err = new Error('Server is busy with other analyses. Please try again in a minute.')
          // @ts-ignore
          err.statusCode = 503
          throw err
        }
        await new Promise((resolve) => queue.push(() => resolve(undefined)))
      } else {
        active += 1
      }
      try {
        return await task()
      } finally {
        release()
      }
    },
    stats() {
      return { active, queued: queue.length }
    },
  }
}

/** Client IP behind Railway / Caddy (first X-Forwarded-For hop). */
export function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket?.remoteAddress || 'unknown'
}

/**
 * Retry a fetch-like call when the network fails (service waking from sleep, redeploy, DNS blip).
 * HTTP error responses are returned as-is; only thrown network errors are retried.
 * @template T
 * @param {() => Promise<T>} call
 * @param {{ attempts?: number, baseMs?: number, sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<T>}
 */
export async function retryOnNetworkError(call, { attempts = 5, baseMs = 500, sleep } = {}) {
  const wait = sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  let lastErr
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await call()
    } catch (err) {
      // fetch() rejects with TypeError on network failure; timeouts are AbortError/TimeoutError — not retried.
      if (!(err instanceof TypeError)) throw err
      lastErr = err
      if (i < attempts - 1) await wait(baseMs * 2 ** i)
    }
  }
  throw lastErr
}

// ---------------------------------------------------------------------------
// Input validation (pure helpers, unit-tested in test/security.test.mjs)
// ---------------------------------------------------------------------------

/** Same rule as GoTrue (`GOTRUE_PASSWORD_MIN_LENGTH=10`) and the browser forms. */
export const PASSWORD_MIN_LENGTH = 10
// bcrypt ignores bytes after 72; refuse longer passwords instead of silently truncating them.
export const PASSWORD_MAX_BYTES = 72
export const PASSWORD_RULE = `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_BYTES} characters`

/** @returns {string | null} an error message, or null when the password is acceptable */
export function passwordProblem(password, email = '') {
  if (typeof password !== 'string') return PASSWORD_RULE
  if (password.length < PASSWORD_MIN_LENGTH || Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return PASSWORD_RULE
  }
  if (!password.trim()) return PASSWORD_RULE
  const lower = password.toLowerCase()
  if (email && (lower === email || lower === email.split('@')[0])) return 'Password must not be your email address'
  if (/^(.)\1+$/.test(password)) return 'Password is too easy to guess'
  return null
}

export function cleanEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(email)
}

/** Trimmed text, or an error when it is longer than `max`. Control characters are removed. */
export function cleanText(value, max) {
  // eslint-disable-next-line no-control-regex
  const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  if (text.length > max) {
    const err = new Error(`Text is too long (max ${max} characters)`)
    // @ts-ignore
    err.statusCode = 400
    throw err
  }
  return text
}

/** Client-supplied X-Request-Id is echoed and logged: keep it short and boring. */
export function safeRequestId(value, fallback) {
  const v = String(value || '')
  return /^[A-Za-z0-9._:-]{1,64}$/.test(v) ? v : fallback()
}

/** Strip API keys, JWTs and bearer tokens (plus one known secret) from text shown to users or logged. */
export function redactSecrets(text, secret) {
  let out = String(text ?? '')
  if (secret && secret.length >= 6) out = out.split(secret).join('[redacted]')
  return out
    .replace(/\b(sk|pk|rk)-[A-Za-z0-9_*-]{8,}/g, '[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g, '[redacted]')
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1[redacted]')
}
