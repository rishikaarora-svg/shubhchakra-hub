// Server-only Gemini Vision waste classifier. The API key lives in the server environment
// (GEMINI_API_KEY) and never reaches the browser. Used by the Vercel function in /api and by
// the Vite dev middleware so local dev and production share one code path.

const STREAM_NAMES = { food: 'Food Rescue', organic: 'Organic Compost', dry: 'Dry Recyclables', sanitary: 'Sanitary' }
const NAME_TO_KEY = Object.fromEntries(Object.entries(STREAM_NAMES).map(([k, v]) => [v.toLowerCase(), k]))
const MAX_IMAGE_BASE64 = 2_000_000 // ~1.5 MB JPEG; the client sends ~100 KB
const UPSTREAM_TIMEOUT_MS = 11000 // client shows the on-device result at 2 s but keeps waiting for food identification up to 12 s

const PROMPT = (expected) => `You are a waste-segregation inspector at a Jaipur banquet venue enforcing India's Solid Waste Management Rules 2026 and FSSAI surplus-food guidelines.
Look at the photo of a waste bag/container. The field lead says it should be: "${STREAM_NAMES[expected]}".
1. List up to 5 clearly visible items (e.g. plastic bottle, paper cup, fruit peel, floral scrap, sealed food tray, napkin, diaper) with a bounding box each, as [ymin, xmin, ymax, xmax] normalised to 0-1000.
2. Map the bag to exactly one SWM 2026 stream: "Food Rescue" (edible, sealed/covered surplus food), "Organic Compost" (peels, flowers, kitchen scrap, plate waste), "Dry Recyclables" (plastic, paper, glass, metal, cardboard) or "Sanitary" (napkins, diapers, medical, hazardous).
3. Judge whether the container is sealed/covered and whether there is cross-stream contamination.
4. If any food is visible, identify each dish by its common Indian name, based only on what you can actually see (colour, texture, visible ingredients). Mark each dish "non-veg" if any meat, chicken, mutton, fish, prawn/shrimp or egg is visible or likely; "veg" only if you can see it contains none of these; otherwise "unknown". Never label a dish veg when unsure: food safety and religious dietary needs depend on it. Use the dish name as the item label too. Use an empty list if there is no food.
Return ONLY JSON: {"items":[{"label":string,"box":[number,number,number,number]}],"foods":[{"name":string,"type":"veg"|"non-veg"|"unknown"}],"stream":string,"sealIntact":boolean,"contamination":"none"|"low"|"high","confidence":number (0-1),"note":string (max 15 words)}`

const clamp = (n, a, b) => Math.min(b, Math.max(a, n))

/**
 * Framework-neutral request handler.
 * @returns {Promise<{status:number, body:object}>}
 */
export async function handleAnalyzeRequest({ method, body, origin, host, env }) {
  if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed' } }

  // Only accept browser calls from this same site (blocks other websites from using the proxy).
  if (origin) {
    let originHost = null
    try { originHost = new URL(origin).host } catch { /* malformed */ }
    const extra = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (originHost !== host && !extra.includes(origin)) return { status: 403, body: { error: 'Origin not allowed' } }
  }

  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) return { status: 503, body: { error: 'GEMINI_API_KEY is not configured on the server' } }

  const { image, expectedStream } = body || {}
  if (!STREAM_NAMES[expectedStream]) return { status: 400, body: { error: 'Invalid expectedStream' } }
  if (typeof image !== 'string' || !image) return { status: 400, body: { error: 'Missing image' } }
  const data = image.includes(',') ? image.split(',')[1] : image
  if (data.length > MAX_IMAGE_BASE64) return { status: 413, body: { error: 'Image too large' } }

  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite' // fastest model that reliably answers inside the 2 s guardrail
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const started = Date.now()
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(expectedStream) }, { inline_data: { mime_type: 'image/jpeg', data } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }, // no thinkingConfig: allowed values differ per model
      }),
    })
    if (!res.ok) return { status: 502, body: { error: `Gemini HTTP ${res.status}` } }
    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''
    const parsed = JSON.parse(text.replace(/^```json|```$/g, '').trim())
    const stream = NAME_TO_KEY[String(parsed.stream || '').toLowerCase()] || expectedStream
    return {
      status: 200,
      body: {
        source: 'gemini',
        model,
        upstreamMs: Date.now() - started,
        stream,
        matchesExpected: stream === expectedStream,
        sealIntact: Boolean(parsed.sealIntact),
        contamination: ['none', 'low', 'high'].includes(parsed.contamination) ? parsed.contamination : 'low',
        confidence: clamp(Number(parsed.confidence) || 0.8, 0, 1),
        note: String(parsed.note || '').slice(0, 200),
        items: (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 5)
          .filter((i) => Array.isArray(i?.box) && i.box.length === 4)
          .map((i) => ({ label: String(i.label).slice(0, 60), box: i.box.map((n) => clamp(Number(n) / 1000, 0, 1)) })),
        foods: (Array.isArray(parsed.foods) ? parsed.foods : []).slice(0, 6)
          .filter((f) => f && String(f.name || '').trim())
          .map((f) => { const n = String(f.name).trim().slice(0, 40); return { name: n.charAt(0).toUpperCase() + n.slice(1), type: ['veg', 'non-veg'].includes(f.type) ? f.type : 'unknown' } }),
      },
    }
  } catch (err) {
    return { status: 502, body: { error: err?.name === 'AbortError' ? 'Gemini upstream timeout' : 'Gemini response could not be parsed' } }
  } finally {
    clearTimeout(timer)
  }
}
