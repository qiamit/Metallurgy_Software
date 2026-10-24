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
 * Limits how many heavy tasks (OpenCV + AI) run at once; extra callers wait in a bounded queue.
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
