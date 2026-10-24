// IS 1786 ring photo -> AI guidance (centre, radii, clean diameter angles, ruler scale).
// The browser sanitises the JSON with parseAiRingGuidance() and refines edges locally.
import { postChat, parseJsonContent } from './ai.mjs'

const RING_PROMPT = `You are analyzing a photo of a metal rebar/ring specimen for dimensional measurement.

Return ONLY JSON matching the schema. Coordinates are NORMALIZED to [0,1] where (0,0) is top-left and (1,1) is bottom-right.
Radii (innerRadiusNorm, outerRadiusNorm) are fractions of min(imageWidth, imageHeight).

Rules:
1. Locate the bright circular HOLE centre precisely (center.x / center.y). This seed is critical — aim for the true centre of the light hole.
2. Estimate innerRadiusNorm tightly to the metal INNER edge of the hole (first light→dark metal edge). Do NOT under-estimate into the hole and do NOT jump to the outer skin.
3. Estimate outerRadiusNorm to the main OUTER metal BODY radius BETWEEN lugs (not lug tips).
4. List lug / protrusion / shadow / glare sectors in excludeSectors (degrees, 0 = east / +X, CCW). These must NOT be used for diameter.
5. Suggest exactly 2 orthogonal diameterAnglesDeg through the centre on CLEAN opposite body edges (between lugs, never through lug tips).
6. thicknessAnglesDeg: return the fixed IS 1786 set [270, 315, 0, 45, 90, 135, 180, 225] (45° steps). Do not shift them.
7. If a ruler/scale is clearly visible with readable major ticks, set scale.present=true with two major tick points and distanceMm. Otherwise present=false and null ticks.
8. confidence is 0–1 for overall ring detection quality.

Do not invent a scale if unsure. Prefer an accurate hole centre and body radii over creative polygons.`

const RING_SCHEMA_HINT = `JSON shape:
{
  "center": {"x": number, "y": number},
  "innerRadiusNorm": number,
  "outerRadiusNorm": number,
  "excludeSectors": [{"startDeg": number, "endDeg": number, "reason": string}],
  "diameterAnglesDeg": [number, number],
  "thicknessAnglesDeg": [270, 315, 0, 45, 90, 135, 180, 225],
  "scale": {"present": boolean, "distanceMm": number|null, "tickA": {"x": number, "y": number}|null,
            "tickB": {"x": number, "y": number}|null, "confidence": number, "label": string|null},
  "confidence": number,
  "notes": string
}`

const DEEPSEEK_VISION_MODEL = 'deepseek-v4-flash-vision-exp'

export async function analyzeRingImage(config, imageBase64, mimeType) {
  const model =
    config.provider === 'deepseek' && !config.model.toLowerCase().includes('vision')
      ? DEEPSEEK_VISION_MODEL
      : config.model
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: `${RING_PROMPT}\n\n${RING_SCHEMA_HINT}\n\nRespond with JSON only.` },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      ],
    },
  ]
  const data = await postChat(config, { model, messages, jsonMode: true, maxTokens: 1500 })
  const message = data?.choices?.[0]?.message
  const text = String(message?.content || message?.reasoning_content || '').trim()
  return parseJsonContent(text)
}
