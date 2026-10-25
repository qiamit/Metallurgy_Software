// Vision LLM advisory analysis and comparison (port of the old ai_compare.py / ai_settings.py).
// Software result is primary; AI is advisory only.

export const PROVIDER_DEFAULTS = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-v4-flash-vision-exp',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
}

const PROMPTS = {
  grain_size:
    'You are a metallography expert. Estimate apparent grain size per ISO 643. ' +
    'Return JSON with keys: grain_size_number_G (number), mean_intercept_um (number), ' +
    'confidence (0-1), observations (string), caveats (string).',
  inclusion:
    'Estimate non-metallic inclusion rating per ISO 4967 chart method. ' +
    'Return JSON with keys: worst_severity_index (0-5), type_counts (object A/B/C/D/DS), ' +
    'confidence (0-1), observations (string), caveats (string).',
  decarb:
    'Estimate decarburization depth per ISO 3887 from the metallograph. ' +
    'Return JSON with keys: decarb_depth_um (number), confidence (0-1), ' +
    'observations (string), caveats (string).',
  micro:
    'Describe microstructure phase fractions. Return JSON with keys: ' +
    'light_phase_fraction (0-1), dark_phase_fraction (0-1), confidence (0-1), ' +
    'observations (string), caveats (string).',
  macro:
    'Assess macroscopic inclusions per IS 10138. Return JSON with keys: ' +
    'stringer_count (int), total_length_mm (number), confidence (0-1), ' +
    'observations (string), caveats (string).',
  nodularity:
    'You are a cast iron metallographer. Rate this spheroidal graphite iron micrograph per ISO 945 / ASTM A247 / E2567. ' +
    'Return JSON with keys: nodularity_percent (number 0-100), nodule_count_per_mm2 (number), ' +
    'nodule_size_class_a247 (integer 1-8), graphite_form (string, A247 Type I-VII), confidence (0-1), ' +
    'observations (string), caveats (string).',
  graphite_flake:
    'You are a cast iron metallographer. Rate this grey iron micrograph per ASTM A247 / ISO 945-1. ' +
    'Return JSON with keys: flake_size_class (integer 1-8), graphite_type (string, one of A, B, C, D, E), ' +
    'graphite_area_percent (number), confidence (0-1), observations (string), caveats (string).',
}

const DEEPSEEK_VISION_MODEL = 'deepseek-v4-flash-vision-exp'
const DEEPSEEK_TEXT_ONLY_MODELS = new Set([
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-v4-flash',
  'deepseek-v4-pro',
])

/**
 * Lab key first; otherwise the server-wide OPENAI_API_KEY (always provider openai).
 * @param {{ provider?: string, model?: string, api_key?: string | null } | null} orgAi
 * @param {{ openaiApiKey?: string, openaiModel?: string }} env
 */
export function resolveAiConfig(orgAi, env) {
  const orgKey = typeof orgAi?.api_key === 'string' && orgAi.api_key.trim() ? orgAi.api_key.trim() : null
  const apiKey = orgKey || env.openaiApiKey || ''
  if (!apiKey) return null
  const provider = orgKey ? String(orgAi?.provider || 'deepseek').toLowerCase() : 'openai'
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai
  let model = orgKey
    ? String(orgAi?.model || '') || (PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek).model
    : env.openaiModel || ''
  if (!model) model = defaults.model
  return { provider, apiKey, model, baseUrl: defaults.baseUrl }
}

function visionModel(config) {
  const { model } = config
  if (config.provider !== 'deepseek') return model
  if (model.toLowerCase().includes('vision')) return model
  if (DEEPSEEK_TEXT_ONLY_MODELS.has(model) || model.startsWith('deepseek-')) return DEEPSEEK_VISION_MODEL
  return model
}

export function parseJsonContent(raw) {
  let content = String(raw || '').trim()
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()
  }
  if (!content) throw new Error('Empty AI response content')
  try {
    return JSON.parse(content)
  } catch (err) {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw err
  }
}

function messageText(data) {
  const message = data?.choices?.[0]?.message
  if (!message) throw new Error('AI returned no choices')
  const content = String(message.content || '').trim()
  if (content) return content
  const reasoning = String(message.reasoning_content || '').trim()
  if (reasoning) return reasoning
  throw new Error('AI returned an empty response')
}

/** Python json.dumps default formatting (", " and ": "), used in the text prompt. */
function pyJsonDumps(value) {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map(pyJsonDumps).join(', ')}]`
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)}: ${pyJsonDumps(v)}`)
      .join(', ')}}`
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return JSON.stringify(value)
}

export async function postChat(config, { model, messages, jsonMode = true, maxTokens = 1200 }) {
  const payload = { model, messages, max_tokens: maxTokens }
  if (config.provider === 'deepseek') payload.thinking = { type: 'disabled' }
  if (jsonMode && config.provider === 'openai') payload.response_format = { type: 'json_object' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const text = await res.text()
    if (res.status >= 400) throw new Error(`AI API error (${res.status}): ${text.slice(0, 500)}`)
    if (!text) throw new Error('AI API returned an empty response body')
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`AI API returned invalid JSON: ${text.slice(0, 200)}`)
    }
  } finally {
    clearTimeout(timer)
  }
}

async function visionAnalysis(config, analysisType, jpegBase64) {
  const prompt = PROMPTS[analysisType] || PROMPTS.grain_size
  const model = visionModel(config)
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: `${prompt} Respond with JSON only.` },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } },
      ],
    },
  ]
  const data = await postChat(config, { model, messages, jsonMode: true })
  const parsed = parseJsonContent(messageText(data))
  return { ...parsed, provider: config.provider, model, advisory: true }
}

async function textAdvisory(config, analysisType, softwareContext, reason) {
  const prompt = PROMPTS[analysisType] || PROMPTS.grain_size
  let { model } = config
  if (config.provider === 'deepseek' && model === DEEPSEEK_VISION_MODEL) model = 'deepseek-v4-flash'
  const textPrompt =
    `${prompt}\n\n` +
    'You cannot see the image directly. Use the software analysis below as reference ' +
    'and provide an independent advisory opinion with reasonable numeric estimates.\n' +
    `Software analysis JSON:\n${pyJsonDumps(softwareContext)}\n\n` +
    'Respond with JSON only.'
  const data = await postChat(config, { model, messages: [{ role: 'user', content: textPrompt }], jsonMode: false })
  const parsed = parseJsonContent(messageText(data))
  return {
    ...parsed,
    provider: config.provider,
    model,
    advisory: true,
    caveats: `${parsed.caveats ?? ''} Vision call unavailable; text advisory used. ${reason}`.trim(),
  }
}

/** Vision first, then a text advisory from the software JSON, then a static "unavailable". */
export async function runAiAnalysis(config, analysisType, jpegBase64, softwareContext) {
  if (!config) {
    return {
      provider: 'heuristic_fallback',
      advisory: true,
      confidence: 0.35,
      observations: 'AI API Key Not Configured. AI Advisory Skipped; Use Software Result as Primary.',
      caveats: 'Add a DeepSeek or OpenAI API Key in Admin → AI Settings.',
    }
  }
  try {
    return await visionAnalysis(config, analysisType, jpegBase64)
  } catch (visionErr) {
    const reason = visionErr instanceof Error ? visionErr.message : String(visionErr)
    if (softwareContext && Object.keys(softwareContext).length) {
      try {
        return await textAdvisory(config, analysisType, softwareContext, reason)
      } catch {
        // fall through to the static advisory
      }
    }
    return {
      provider: config.provider,
      model: config.model,
      advisory: true,
      confidence: 0.2,
      observations: 'AI Advisory Unavailable. Use Software Result as Primary.',
      caveats: reason,
    }
  }
}

const COMPARE_KEYS = {
  grain_size: ['grain_size_number_G', 'mean_intercept_um'],
  inclusion: ['worst_severity_index'],
  decarb: ['decarb_depth_um'],
  micro: ['light_phase_fraction', 'dark_phase_fraction'],
  macro: ['stringer_count', 'total_length_mm'],
  nodularity: ['nodularity_percent', 'nodule_count_per_mm2', 'nodule_size_class_a247'],
  graphite_flake: ['flake_size_class', 'graphite_area_percent'],
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

export function compareResults(analysisType, software, ai) {
  const deltas = {}
  for (const key of COMPARE_KEYS[analysisType] || []) {
    const s = software?.[key]
    const a = ai?.[key]
    if (isNum(s) && isNum(a)) {
      deltas[key] = { software: s, ai: a, absolute_diff: Math.round((a - s) * 10000) / 10000 }
    }
  }
  let agreement = 'unknown'
  const values = Object.values(deltas)
  if (values.length) {
    const rel = values.map((d) => Math.abs(d.absolute_diff) / (d.software ? Math.abs(d.software) : 1))
    const meanRel = rel.reduce((s, v) => s + v, 0) / rel.length
    agreement = meanRel < 0.15 ? 'high' : meanRel < 0.4 ? 'medium' : 'low'
  }
  return {
    primary: 'software',
    ai_role: 'advisory',
    agreement,
    deltas,
    summary: `Software is primary (standards-oriented). AI agreement: ${agreement}.`,
  }
}
