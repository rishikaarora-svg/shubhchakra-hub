// Gemini Vision waste classifier with a stage guardrail: if the live call hasn't answered within
// TIMEOUT_MS (default 2 s) the coordinator can carry on, and the real result fills in when it arrives.

const ENDPOINT = '/api/analyze-waste' // server function holds the Gemini key; nothing secret ships to the browser
const TIMEOUT_MS = Number(import.meta.env.VITE_GEMINI_TIMEOUT_MS) || 2000

export const geminiTimeout = TIMEOUT_MS

/** Cheap GET (204, no Gemini call) that starts a cold server function before the first real photo. */
let lastWarm = 0
export function warmUpAI() {
  if (Date.now() - lastWarm < 60_000) return
  lastWarm = Date.now()
  fetch(ENDPOINT, { method: 'GET', cache: 'no-store' }).catch(() => {})
}

const HARD_LIMIT_MS = 12000 // stop waiting for a late Gemini answer after this

/**
 * Stage guardrail: if Gemini hasn't answered within TIMEOUT_MS we return the on-device result
 * straight away, but keep the live request running. When Gemini does answer, `onLateResult`
 * receives the real result (e.g. the dishes it identified) so the screen can update.
 * @param {string} base64Image data URL or bare base64 JPEG
 * @param {'food'|'organic'|'dry'|'sanitary'} expectedStream
 * @param {{ onLateResult?: (result: object) => void }} [opts]
 */
export async function analyzeWasteImageWithAI(base64Image, expectedStream, { onLateResult } = {}) {
  const started = performance.now()
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return localAnalysis(expectedStream, started, 'Device offline')
  const controller = new AbortController()
  const hardStop = setTimeout(() => controller.abort(), HARD_LIMIT_MS)
  const live = fetch(ENDPOINT, {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, expectedStream }),
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
    return { ...json, ms: Math.round(performance.now() - started) }
  })
  const guard = new Promise((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS))
  try {
    const first = await Promise.race([live, guard])
    if (first !== 'timeout') { clearTimeout(hardStop); return first }
    live.then((r) => onLateResult?.({ ...r, late: true })).catch(() => {}).finally(() => clearTimeout(hardStop))
    return localAnalysis(expectedStream, started, `Live AI took longer than ${TIMEOUT_MS / 1000} s`, Boolean(onLateResult))
  } catch (err) {
    clearTimeout(hardStop)
    return localAnalysis(expectedStream, started, `Live AI unavailable (${err.message})`)
  }
}

/**
 * Fallback when Gemini can't answer in time. It makes no claims it can't back up: no item boxes,
 * no seal / contamination verdict, no dishes. The coordinator's own stream choice is kept.
 */
function localAnalysis(expectedStream, started, reason, liveStillRunning = false) {
  return new Promise((resolve) =>
    setTimeout(() => resolve({
      source: 'local',
      fallbackReason: reason,
      ms: Math.round(performance.now() - started),
      stream: expectedStream,
      matchesExpected: true,
      unverified: true,
      sealIntact: null,
      contamination: null,
      confidence: null,
      note: '',
      items: [],
      foods: [],
      liveStillRunning,
    }), 300),
  )
}

