import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanText,
  isValidEmail,
  passwordProblem,
  redactSecrets,
  safeRequestId,
} from '../lib/guards.mjs'

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

