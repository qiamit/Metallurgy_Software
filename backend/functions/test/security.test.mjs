import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PROVIDER_DEFAULTS, redactSecrets, resolveAiConfig } from '../lib/ai.mjs'
import {
  cleanText,
  decodeImageBase64,
  isValidEmail,
  passwordProblem,
  safeRequestId,
} from '../lib/guards.mjs'

const env = { openaiApiKey: '', openaiModel: '' }
const allowedUrls = new Set(Object.values(PROVIDER_DEFAULTS).map((p) => p.baseUrl))

test('AI endpoint always comes from the fixed provider list (no SSRF via lab settings)', () => {
  const hostile = [
    { provider: 'http://169.254.169.254/latest', model: 'x', api_key: 'sk-lab' },
    { provider: '__proto__', model: 'x', api_key: 'sk-lab' },
    { provider: 'constructor', model: 'x', api_key: 'sk-lab' },
    { provider: 'deepseek', model: 'x', api_key: 'sk-lab', baseUrl: 'http://internal', base_url: 'http://internal' },
  ]
  for (const row of hostile) {
    const cfg = resolveAiConfig(row, env)
    assert.ok(allowedUrls.has(cfg.baseUrl), `${row.provider} -> ${cfg.baseUrl}`)
    assert.ok(cfg.baseUrl.startsWith('https://'))
  }
})

test('AI model id is limited to a safe charset; bad values fall back to the default', () => {
  const ok = resolveAiConfig({ provider: 'openai', model: 'gpt-4o-mini', api_key: 'sk-lab' }, env)
  assert.equal(ok.model, 'gpt-4o-mini')
  for (const model of ['', 'a b', 'x'.repeat(200), 'model\nx', '"><script>']) {
    const cfg = resolveAiConfig({ provider: 'openai', model, api_key: 'sk-lab' }, env)
    assert.equal(cfg.model, PROVIDER_DEFAULTS.openai.model, JSON.stringify(model))
  }
})

test('server-wide key is always provider openai', () => {
  const cfg = resolveAiConfig(null, { openaiApiKey: 'sk-server', openaiModel: 'gpt-4o-mini' })
  assert.equal(cfg.provider, 'openai')
  assert.equal(cfg.baseUrl, PROVIDER_DEFAULTS.openai.baseUrl)
  assert.equal(resolveAiConfig(null, env), null)
})

test('redactSecrets removes keys and bearer tokens', () => {
  // Built at runtime so the secret scanner does not flag test fixtures.
  const key = ['sk', 'x'.repeat(20)].join('-')
  const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'sig'].join('.')
  const out = redactSecrets(`Incorrect API key provided: ${key}. Bearer abc.def.ghi-123456 ${jwt}`, key)
  assert.ok(!out.includes(key))
  assert.ok(!out.includes('abc.def.ghi-123456'))
  assert.ok(!out.includes('eyJhbGciOiJIUzI1NiJ9'))
  assert.equal(redactSecrets('plain message'), 'plain message')
})

test('password rule: 10-72 characters, not the email, not one repeated character', () => {
  assert.notEqual(passwordProblem('short'), null)
  assert.notEqual(passwordProblem(123456789012), null)
  assert.notEqual(passwordProblem('a'.repeat(73)), null)
  assert.notEqual(passwordProblem('aaaaaaaaaaaa'), null)
  assert.notEqual(passwordProblem('lab.owner@example.com', 'lab.owner@example.com'), null)
  assert.notEqual(passwordProblem('            '), null)
  assert.equal(passwordProblem('correct-horse-42', 'lab.owner@example.com'), null)
})

test('email and text validation', () => {
  assert.equal(isValidEmail('a@b.co'), true)
  assert.equal(isValidEmail('not-an-email'), false)
  assert.equal(isValidEmail(`${'a'.repeat(250)}@b.co`), false)
  assert.equal(cleanText('  Acme\u0000 Lab  ', 120), 'Acme  Lab')
  assert.throws(() => cleanText('x'.repeat(121), 120), (err) => err.statusCode === 400)
})

test('request id: safe values kept, anything else replaced', () => {
  assert.equal(safeRequestId('abc-123', () => 'new'), 'abc-123')
  assert.equal(safeRequestId('bad id\n{"x":1}', () => 'new'), 'new')
  assert.equal(safeRequestId('x'.repeat(65), () => 'new'), 'new')
  assert.equal(safeRequestId(undefined, () => 'new'), 'new')
})

test('base64 image: size checked before decoding, charset validated', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')
  assert.equal(decodeImageBase64(png, 1024).length, 4)
  assert.equal(decodeImageBase64(`data:image/png;base64,${png}`, 1024).length, 4)
  assert.throws(() => decodeImageBase64('', 1024), (err) => err.statusCode === 400)
  assert.throws(() => decodeImageBase64('A'.repeat(4000), 1024), (err) => err.statusCode === 413)
  assert.throws(() => decodeImageBase64('not base64!', 1024), (err) => err.statusCode === 400)
})
