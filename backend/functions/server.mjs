import http from 'node:http'
import {
  loadCv,
  decodeToBgr,
  encodeBgrToPng,
  encodeBgrToJpeg,
  ANALYZERS,
} from './lib/analysis.mjs'
import { resolveAiConfig, runAiAnalysis, compareResults } from './lib/ai.mjs'
import { analyzeRingImage } from './lib/ringAi.mjs'

const PORT = Number(process.env.PORT || 8080)
const REST_URL = (process.env.REST_URL || 'http://rest.railway.internal:3000').replace(/\/$/, '')
const AUTH_URL = (process.env.AUTH_URL || 'http://auth.railway.internal:9999').replace(/\/$/, '')
const STORAGE_URL = (process.env.STORAGE_URL || 'http://storage-api.railway.internal:8080').replace(/\/$/, '')
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

const ROLE_RANK = { viewer: 1, analyst: 2, reviewer: 3, admin: 4, owner: 5 }
const ROLES = Object.keys(ROLE_RANK)

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function httpError(statusCode, message) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

const MAX_BODY_BYTES = 15 * 1024 * 1024

function readBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0)
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      reject(httpError(413, 'Request body is too large'))
      req.resume()
      return
    }
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(httpError(413, 'Request body is too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(httpError(400, 'Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function callerJwt(req) {
  const userJwt = String(req.headers['x-user-jwt'] || '').trim()
  if (userJwt) return userJwt
  const auth = String(req.headers.authorization || '')
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return ''
}

async function rest(path, init = {}) {
  const res = await fetch(`${REST_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data ? String(data.message) : `REST ${res.status}`
    throw new Error(message)
  }
  return data
}

async function restOne(path) {
  const rows = await rest(path)
  return Array.isArray(rows) ? rows[0] ?? null : null
}

async function authAdmin(path, init = {}) {
  const res = await fetch(`${AUTH_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: res.ok, status: res.status, data }
}

function authErrorMessage(payload, fallback) {
  if (payload && typeof payload === 'object') {
    if ('msg' in payload && payload.msg) return String(payload.msg)
    if ('message' in payload && payload.message) return String(payload.message)
    if ('error_description' in payload && payload.error_description) {
      return String(payload.error_description)
    }
    if ('error' in payload && payload.error) return String(payload.error)
  }
  return fallback
}

// ---------------------------------------------------------------------------
// Storage (storage-api, service role)
// ---------------------------------------------------------------------------
function objectUrl(bucket, path) {
  return `${STORAGE_URL}/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`
}

async function downloadObject(bucket, path) {
  const res = await fetch(objectUrl(bucket, path), {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  })
  if (!res.ok) throw new Error(`Could not read ${bucket}/${path} (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

async function uploadObject(bucket, path, body, contentType) {
  const res = await fetch(objectUrl(bucket, path), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body,
  })
  if (!res.ok) throw new Error(`Could not save ${bucket}/${path} (${res.status}): ${(await res.text()).slice(0, 200)}`)
}

// ---------------------------------------------------------------------------
// Caller + lab role
// ---------------------------------------------------------------------------
async function requireUser(req) {
  const token = callerJwt(req)
  if (!token) throw httpError(401, 'Missing caller session')
  const res = await fetch(`${AUTH_URL}/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_ROLE_KEY },
  })
  if (!res.ok) throw httpError(401, 'Invalid caller session')
  const user = await res.json()
  const profile = await restOne(`/user_profiles?id=eq.${encodeURIComponent(user.id)}&select=status`)
  if (String(profile?.status ?? '').trim().toLowerCase() === 'inactive') {
    throw httpError(403, 'Account is inactive')
  }
  return user
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''))
}

async function orgRole(orgId, userId) {
  const row = await restOne(
    `/memberships?organization_id=eq.${encodeURIComponent(orgId)}&user_id=eq.${encodeURIComponent(userId)}&select=role`,
  )
  return row?.role ?? null
}

async function requireOrgRole(req, orgId, minimum) {
  if (!isUuid(orgId)) throw httpError(400, 'organization_id is required')
  const user = await requireUser(req)
  const role = await orgRole(orgId, user.id)
  if (!role) throw httpError(403, 'Not a member of this organization')
  if (ROLE_RANK[role] < ROLE_RANK[minimum]) throw httpError(403, `Requires role ${minimum} or higher`)
  return { user, role }
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 8
}

function cleanEmail(email) {
  return String(email || '').trim().toLowerCase()
}

async function findAuthUserByEmail(email) {
  // GoTrue admin list has no email filter in every version; page through.
  for (let page = 1; page <= 50; page += 1) {
    const result = await authAdmin(`/admin/users?page=${page}&per_page=200`)
    if (!result.ok) throw new Error(authErrorMessage(result.data, 'Could not list users'))
    const users = Array.isArray(result.data?.users) ? result.data.users : []
    const hit = users.find((u) => cleanEmail(u.email) === email)
    if (hit) return hit
    if (users.length < 200) return null
  }
  return null
}

async function createAuthUser({ email, password, fullName }) {
  const result = await authAdmin('/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  })
  if (!result.ok) {
    const message = authErrorMessage(result.data, 'Could not create user')
    const status = /already|registered|exists/i.test(message) ? 400 : 500
    throw httpError(status, /already|registered|exists/i.test(message) ? 'Email already registered' : message)
  }
  return result.data
}

// ---------------------------------------------------------------------------
// Handlers: workspace + members
// ---------------------------------------------------------------------------
async function handleRegister(req, res) {
  const body = await readBody(req)
  const email = cleanEmail(body.email)
  const fullName = String(body.full_name || '').trim()
  const orgName = String(body.organization_name || '').trim()
  if (!email || !fullName || !orgName) throw httpError(400, 'Email, full name and lab name are required')
  if (!validPassword(body.password)) throw httpError(400, 'Password must be at least 8 characters')

  const user = await createAuthUser({ email, password: body.password, fullName })
  try {
    const orgId = await rest('/rpc/create_organization_with_owner', {
      method: 'POST',
      body: JSON.stringify({ p_name: orgName, p_owner: user.id }),
    })
    json(res, 200, { ok: true, user_id: user.id, organization_id: orgId })
  } catch (err) {
    // Do not leave a login with no lab behind.
    await authAdmin(`/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
    throw err
  }
}

function assertCanGrant(callerRole, targetRole) {
  if (!ROLES.includes(targetRole)) throw httpError(400, 'Invalid role')
  if (ROLE_RANK[targetRole] > ROLE_RANK[callerRole]) {
    throw httpError(403, 'You cannot grant a role higher than your own')
  }
}

async function ownerCount(orgId) {
  const rows = await rest(`/memberships?organization_id=eq.${encodeURIComponent(orgId)}&role=eq.owner&select=id`)
  return Array.isArray(rows) ? rows.length : 0
}

async function handleCreateUser(req, res) {
  const body = await readBody(req)
  const orgId = body.organization_id
  const { role: callerRole } = await requireOrgRole(req, orgId, 'admin')
  const email = cleanEmail(body.email)
  const fullName = String(body.full_name || '').trim()
  const role = String(body.role || 'analyst')
  if (!email || !fullName) throw httpError(400, 'Email and full name are required')
  assertCanGrant(callerRole, role)

  let user = await findAuthUserByEmail(email)
  if (!user) {
    if (!validPassword(body.password)) throw httpError(400, 'Temp password must be at least 8 characters')
    user = await createAuthUser({ email, password: body.password, fullName })
  }
  if (await orgRole(orgId, user.id)) throw httpError(400, 'Already a member')
  const rows = await rest('/memberships', {
    method: 'POST',
    body: JSON.stringify({ organization_id: orgId, user_id: user.id, role }),
  })
  json(res, 200, { ok: true, membership: Array.isArray(rows) ? rows[0] : rows })
}

async function loadMembership(orgId, membershipId) {
  if (!isUuid(membershipId)) throw httpError(400, 'membership_id is required')
  const row = await restOne(
    `/memberships?id=eq.${encodeURIComponent(membershipId)}&organization_id=eq.${encodeURIComponent(orgId)}&select=id,user_id,role`,
  )
  if (!row) throw httpError(404, 'Member not found')
  return row
}

async function handleUpdateMember(req, res) {
  const body = await readBody(req)
  const orgId = body.organization_id
  const { role: callerRole } = await requireOrgRole(req, orgId, 'admin')
  const target = await loadMembership(orgId, body.membership_id)
  const nextRole = String(body.role || '')
  assertCanGrant(callerRole, nextRole)
  if (ROLE_RANK[target.role] > ROLE_RANK[callerRole]) throw httpError(403, 'You cannot change this member')
  if (target.role === 'owner' && nextRole !== 'owner' && (await ownerCount(orgId)) <= 1) {
    throw httpError(400, 'A lab must keep at least one owner')
  }
  await rest(`/memberships?id=eq.${encodeURIComponent(target.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: nextRole }),
  })
  json(res, 200, { ok: true })
}

async function handleRemoveMember(req, res) {
  const body = await readBody(req)
  const orgId = body.organization_id
  const { role: callerRole } = await requireOrgRole(req, orgId, 'admin')
  const target = await loadMembership(orgId, body.membership_id)
  if (ROLE_RANK[target.role] > ROLE_RANK[callerRole]) throw httpError(403, 'You cannot remove this member')
  if (target.role === 'owner' && (await ownerCount(orgId)) <= 1) {
    throw httpError(400, 'A lab must keep at least one owner')
  }
  await rest(`/memberships?id=eq.${encodeURIComponent(target.id)}`, { method: 'DELETE' })
  json(res, 200, { ok: true })
}

async function handleResetMemberPassword(req, res) {
  const body = await readBody(req)
  const orgId = body.organization_id
  const { role: callerRole } = await requireOrgRole(req, orgId, 'admin')
  const target = await loadMembership(orgId, body.membership_id)
  if (ROLE_RANK[target.role] > ROLE_RANK[callerRole]) throw httpError(403, 'You cannot change this member')
  if (!validPassword(body.password)) throw httpError(400, 'Password must be at least 8 characters')
  const result = await authAdmin(`/admin/users/${encodeURIComponent(target.user_id)}`, {
    method: 'PUT',
    body: JSON.stringify({ password: body.password }),
  })
  if (!result.ok) throw httpError(400, authErrorMessage(result.data, 'Could not reset password'))
  json(res, 200, { ok: true })
}

// ---------------------------------------------------------------------------
// Handlers: analysis
// ---------------------------------------------------------------------------
async function loadJob(jobId) {
  if (!isUuid(jobId)) throw httpError(400, 'job_id is required')
  const job = await restOne(`/analysis_jobs?id=eq.${encodeURIComponent(jobId)}&select=*`)
  if (!job) throw httpError(404, 'Job not found')
  return job
}

async function patchJob(jobId, fields) {
  const rows = await rest(`/analysis_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
  return Array.isArray(rows) ? rows[0] : rows
}

async function labAiConfig(orgId) {
  const row = await restOne(
    `/ai_settings?organization_id=eq.${encodeURIComponent(orgId)}&select=provider,model,api_key,ring_ai_enabled`,
  )
  return { row, config: resolveAiConfig(row, { openaiApiKey: OPENAI_API_KEY, openaiModel: OPENAI_MODEL }) }
}

async function runAiFor(job, cv, image, softwareResult) {
  const { config } = await labAiConfig(job.organization_id)
  const jpeg = await encodeBgrToJpeg(cv, image, 85)
  const aiResult = await runAiAnalysis(config, job.analysis_type, jpeg.toString('base64'), softwareResult)
  return { aiResult, comparison: compareResults(job.analysis_type, softwareResult, aiResult) }
}

async function processJob(job, { aiOnly = false } = {}) {
  const { cv } = await loadCv()
  await patchJob(job.id, { status: 'processing', error_message: null })
  let image = null
  try {
    if (!job.source_image_path) throw new Error('Job has no source image')
    image = await decodeToBgr(cv, await downloadObject('job-images', job.source_image_path))

    if (aiOnly) {
      const { aiResult, comparison } = await runAiFor(job, cv, image, job.software_result)
      return await patchJob(job.id, {
        ai_result: aiResult,
        comparison,
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: null,
      })
    }

    let umX = 1
    let umY = 1
    if (job.calibration_id) {
      // Composite FK guarantees the calibration belongs to the job's lab.
      const cal = await restOne(
        `/calibrations?id=eq.${encodeURIComponent(job.calibration_id)}&organization_id=eq.${encodeURIComponent(job.organization_id)}&select=um_per_px_x,um_per_px_y`,
      )
      if (cal) {
        umX = Number(cal.um_per_px_x)
        umY = Number(cal.um_per_px_y)
      }
    }

    const analyze = ANALYZERS[job.analysis_type]
    if (!analyze) throw new Error(`Unknown analysis type: ${job.analysis_type}`)
    const { result: softwareResult, overlay } = analyze(cv, image, umX, umY)
    let overlayPath
    try {
      overlayPath = `${job.organization_id}/${job.id}.png`
      await uploadObject('job-overlays', overlayPath, await encodeBgrToPng(cv, overlay), 'image/png')
    } finally {
      overlay.delete()
    }

    const fields = {
      software_result: softwareResult,
      overlay_image_path: overlayPath,
      ai_result: null,
      comparison: null,
      status: 'completed',
      completed_at: new Date().toISOString(),
      error_message: null,
    }
    if (job.run_ai) {
      const { aiResult, comparison } = await runAiFor(job, cv, image, softwareResult)
      fields.ai_result = aiResult
      fields.comparison = comparison
    }
    return await patchJob(job.id, fields)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // AI-only failures keep the software result usable.
    return await patchJob(job.id, {
      status: aiOnly && job.software_result ? 'completed' : 'failed',
      error_message: message,
    })
  } finally {
    if (image) image.delete()
  }
}

async function handleAnalyzeJob(req, res) {
  const body = await readBody(req)
  const job = await loadJob(body.job_id)
  await requireOrgRole(req, job.organization_id, 'analyst')
  json(res, 200, { job: await processJob(job) })
}

async function handleRerunAi(req, res) {
  const body = await readBody(req)
  const job = await loadJob(body.job_id)
  await requireOrgRole(req, job.organization_id, 'analyst')
  const aiOnly = Boolean(job.software_result && job.source_image_path)
  if (!aiOnly) job.run_ai = true
  json(res, 200, { job: await processJob(job, { aiOnly }) })
}

async function handleAnalyzeRing(req, res) {
  const body = await readBody(req)
  const orgId = body.organization_id
  await requireOrgRole(req, orgId, 'analyst')
  const { row, config } = await labAiConfig(orgId)
  if (!row?.ring_ai_enabled) {
    json(res, 403, { ok: false, error: 'AI ring analysis is not enabled for this lab.' })
    return
  }
  if (!config) {
    json(res, 400, { ok: false, error: 'Add a DeepSeek or OpenAI API Key in AI Setting.' })
    return
  }
  const imageBase64 = String(body.imageBase64 || '')
  const mimeType = /^image\/(png|jpeg|webp)$/.test(String(body.mimeType)) ? body.mimeType : 'image/jpeg'
  if (!imageBase64) throw httpError(400, 'imageBase64 is required')
  try {
    const guidance = await analyzeRingImage(config, imageBase64, mimeType)
    json(res, 200, { ok: true, guidance })
  } catch (err) {
    json(res, 502, { ok: false, error: err instanceof Error ? err.message : 'AI analysis failed.' })
  }
}

const routes = {
  'GET /health': async (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
  },
  'POST /register': handleRegister,
  'POST /create-user': handleCreateUser,
  'POST /update-member': handleUpdateMember,
  'POST /remove-member': handleRemoveMember,
  'POST /reset-member-password': handleResetMemberPassword,
  'POST /analyze-job': handleAnalyzeJob,
  'POST /rerun-ai': handleRerunAi,
  'POST /analyze-ring': handleAnalyzeRing,
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://functions.local')
  const key = `${req.method} ${url.pathname.replace(/\/$/, '') || '/'}`
  const handler = routes[key] || (key === 'GET /' ? routes['GET /health'] : null)
  if (!handler) {
    json(res, 404, { error: 'Not Found' })
    return
  }
  try {
    await handler(req, res)
  } catch (err) {
    const status = Number(err?.statusCode) || 500
    if (status >= 500) console.error(err)
    json(res, status, { error: err instanceof Error ? err.message : 'Internal error' })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`functions listening on ${PORT}`)
  // Warm the OpenCV runtime so the first analysis is fast.
  loadCv().catch((err) => console.error('OpenCV failed to load', err))
})
