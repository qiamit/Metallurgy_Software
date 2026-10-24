import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGate, createRateLimiter, clientIp } from '../lib/guards.mjs'

test('rate limiter allows `limit` hits per window, then resets', () => {
  let t = 0
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t })
  assert.equal(rl.take('a').ok, true)
  assert.equal(rl.take('a').ok, true)
  const blocked = rl.take('a')
  assert.equal(blocked.ok, false)
  assert.equal(blocked.retryAfterSec, 1)
  assert.equal(rl.take('b').ok, true, 'keys are independent')
  t = 1001
  assert.equal(rl.take('a').ok, true, 'window reset')
})

test('rate limiter sweeps expired keys', () => {
  let t = 0
  const rl = createRateLimiter({ limit: 1, windowMs: 100, now: () => t })
  for (let i = 0; i < 50; i += 1) rl.take(`k${i}`)
  assert.equal(rl.size(), 50)
  t = 500
  rl.take('fresh')
  assert.equal(rl.size(), 1)
})

test('gate runs at most `max` tasks at once and queues the rest', async () => {
  const gate = createGate({ max: 2, maxQueue: 5 })
  let running = 0
  let peak = 0
  const task = () =>
    gate.run(async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 10))
      running -= 1
      return 'done'
    })
  const results = await Promise.all([task(), task(), task(), task(), task()])
  assert.equal(peak, 2)
  assert.deepEqual(results, Array(5).fill('done'))
  assert.deepEqual(gate.stats(), { active: 0, queued: 0 })
})

test('gate rejects with 503 when the queue is full', async () => {
  const gate = createGate({ max: 1, maxQueue: 1 })
  let unblock
  const blocker = gate.run(() => new Promise((r) => (unblock = r)))
  const queued = gate.run(async () => 'queued')
  await assert.rejects(gate.run(async () => 'overflow'), (err) => err.statusCode === 503)
  unblock()
  await blocker
  assert.equal(await queued, 'queued')
})

test('gate releases its slot when a task throws', async () => {
  const gate = createGate({ max: 1, maxQueue: 0 })
  await assert.rejects(gate.run(async () => Promise.reject(new Error('boom'))))
  assert.equal(await gate.run(async () => 'ok'), 'ok')
})

test('clientIp prefers the first X-Forwarded-For hop', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: {} }), '1.2.3.4')
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '9.9.9.9' } }), '9.9.9.9')
})

test('retryOnNetworkError retries network failures, then succeeds', async () => {
  const { retryOnNetworkError } = await import('../lib/guards.mjs')
  let calls = 0
  const waits = []
  const result = await retryOnNetworkError(
    async () => {
      calls += 1
      if (calls < 3) throw new TypeError('fetch failed')
      return 'ok'
    },
    { sleep: async (ms) => waits.push(ms) },
  )
  assert.equal(result, 'ok')
  assert.equal(calls, 3)
  assert.deepEqual(waits, [500, 1000])
})

test('retryOnNetworkError does not retry other errors and gives up after attempts', async () => {
  const { retryOnNetworkError } = await import('../lib/guards.mjs')
  let calls = 0
  await assert.rejects(
    retryOnNetworkError(async () => {
      calls += 1
      throw new Error('HTTP-level problem')
    }),
    /HTTP-level/,
  )
  assert.equal(calls, 1)
  calls = 0
  await assert.rejects(
    retryOnNetworkError(
      async () => {
        calls += 1
        throw new TypeError('fetch failed')
      },
      { attempts: 3, sleep: async () => {} },
    ),
    TypeError,
  )
  assert.equal(calls, 3)
})
