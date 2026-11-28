// Vercel Function: POST /api/analyze-waste  { image: <base64 JPEG>, expectedStream }
import { handleAnalyzeRequest } from '../server/analyze-waste.js'

export const config = { maxDuration: 15 }

export async function POST(request) {
  let body = null
  try { body = await request.json() } catch { /* handled as missing image */ }
  const { status, body: out } = await handleAnalyzeRequest({
    method: 'POST',
    body,
    origin: request.headers.get('origin'),
    host: request.headers.get('x-forwarded-host') || request.headers.get('host'),
    env: process.env,
  })
  return Response.json(out, { status, headers: { 'Cache-Control': 'no-store' } })
}

// Warm-up ping from the Field Coordinator page: starts the function without calling Gemini.
export function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
