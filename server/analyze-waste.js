// Server-only Gemini Vision waste classifier. The API key lives in the server environment
// (GEMINI_API_KEY) and never reaches the browser. Used by the Vercel function in /api and by
// the Vite dev middleware so local dev and production share one code path.

const STREAM_NAMES = { food: 'Food Rescue', organic: 'Organic Compost', dry: 'Dry Recyclables', sanitary: 'Sanitary' }
const NAME_TO_KEY = Object.fromEntries(Object.entries(STREAM_NAMES).map(([k, v]) => [v.toLowerCase(), k]))
const MAX_IMAGE_BASE64 = 2_000_000 // ~1.5 MB JPEG; the client sends ~100 KB
const UPSTREAM_TIMEOUT_MS = 11000 // client shows the on-device result at 2 s but keeps waiting for food identification up to 12 s

const FOOD_CATEGORIES = ['cooked', 'fruit', 'dry-fruit', 'sweet', 'bakery', 'vegetable', 'other']

const PROMPT = (expected) => `You are a waste-segregation inspector at a Jaipur banquet venue enforcing India's Solid Waste Management Rules 2026 and FSSAI surplus-food guidelines.
Look at the photo of a waste bag/container. The field coordinator says it should be: "${STREAM_NAMES[expected]}".
1. Map the bag to exactly one SWM 2026 stream: "Food Rescue" (clean, uneaten, edible surplus food, including whole or cut fruit, nuts, sweets and cooked dishes), "Organic Compost" (peels, rinds, seeds, cores, flowers, kitchen scrap, half-eaten plate waste), "Dry Recyclables" (plastic, paper, glass, metal, cardboard) or "Sanitary" (napkins, diapers, medical, hazardous).
2. Judge whether the container is sealed/covered and whether there is cross-stream contamination.
3. Identify EVERY distinct food item separately. Never group items under a collective name such as "mixed fruits", "fruit platter", "assorted dry fruits", "mixed nuts" or "thali". For example: a bowl of nuts becomes "Almonds", "Cashews", "Raisins", "Pistachios"; a fruit platter becomes "Watermelon", "Papaya", "Pineapple", "Grapes"; a buffet tray becomes each dish ("Dal makhani", "Jeera rice"). Use common English names (Indian dish names for cooked food). For each item give:
   - category: "cooked" (cooked dish), "fruit", "dry-fruit" (nuts, dried fruit, seeds), "sweet" (mithai, desserts), "bakery" (bread, snacks, namkeen), "vegetable" (raw), or "other"
   - type: "non-veg" if any meat, chicken, mutton, fish, prawn/shrimp or egg is visible or likely; "veg" only if you can see it has none; otherwise "unknown". Never say veg when unsure: food safety and religious dietary needs depend on it.
   - rescuable: true if the item is clean, uneaten, edible surplus fit for an NGO; false if it is peel, rind, seeds, core, scraps, half-eaten or spoiled (that part goes to compost).
   Base names only on what you can actually see. Use an empty list if there is no food.
4. Give bounding boxes for up to 6 of the most visible items (food or not), as [ymin, xmin, ymax, xmax] normalised to 0-1000, labelled with the same names.
Return ONLY JSON: {"stream":string,"foods":[{"name":string,"category":string,"type":"veg"|"non-veg"|"unknown","rescuable":boolean}],"items":[{"label":string,"box":[number,number,number,number]}],"sealIntact":boolean,"contamination":"none"|"low"|"high","confidence":number (0-1),"note":string (max 15 words)}`

const clamp = (n, a, b) => Math.min(b, Math.max(a, n))

/** Parse the model's JSON even if it wraps it in code fences or adds text around it. */
function parseJsonLoose(text) {
  const t = String(text || '').replace(/```(?:json)?/gi, '').trim()
  try { return JSON.parse(t) } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)) } catch { /* fall through */ } }
  return null
}

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

  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  // Light thinking cut typical latency from ~5.8 s to ~2 s in testing with no loss in dish identification. 'off' sends no thinkingConfig.
  const thinking = env.GEMINI_THINKING_LEVEL || 'low'
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
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1, ...(thinking !== 'off' ? { thinkingConfig: { thinkingLevel: thinking } } : {}) },
      }),
    })
    if (!res.ok) return { status: 502, body: { error: `Gemini HTTP ${res.status}` } }
    const json = await res.json()
    const cand = json?.candidates?.[0]
    const text = cand?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('') || ''
    const parsed = parseJsonLoose(text)
    if (!parsed) {
      console.error('analyze-waste: unparseable Gemini reply', { model, finishReason: cand?.finishReason, length: text.length, tail: text.slice(-200) })
      return { status: 502, body: { error: 'Gemini response could not be parsed' } }
    }
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
        items: (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 6)
          .filter((i) => Array.isArray(i?.box) && i.box.length === 4)
          .map((i) => ({ label: String(i.label).slice(0, 60), box: i.box.map((n) => clamp(Number(n) / 1000, 0, 1)) })),
        foods: (Array.isArray(parsed.foods) ? parsed.foods : []).slice(0, 12)
          .filter((f) => f && String(f.name || '').trim())
          .map((f) => {
            const n = String(f.name).trim().slice(0, 40)
            return {
              name: n.charAt(0).toUpperCase() + n.slice(1),
              category: FOOD_CATEGORIES.includes(f.category) ? f.category : 'other',
              type: ['veg', 'non-veg'].includes(f.type) ? f.type : 'unknown',
              rescuable: f.rescuable !== false,
            }
          }),
      },
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.error('analyze-waste: request failed', err?.message)
    return { status: 502, body: { error: err?.name === 'AbortError' ? 'Gemini upstream timeout' : 'Gemini request failed' } }
  } finally {
    clearTimeout(timer)
  }
}
