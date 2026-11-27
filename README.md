# ShubhChakra Hub

Event waste orchestration and SWM Rules 2026 / FSSAI compliance middleware for Jaipur bulk waste generators.
React + Vite + Tailwind CSS v4 + Lucide, with Gemini Vision for live bag classification. Installable PWA.

## Run

```bash
npm install
cp .env.example .env.local   # then set GEMINI_API_KEY (server-only)
npm run dev                  # http://localhost:5173 (also exposed on your LAN for phone testing)
npm run build && npm run preview
```

Camera capture and live QR scanning require **HTTPS or localhost**. To test on a phone, deploy (e.g. Vercel: root directory `shubhchakra-hub`) or use an HTTPS tunnel.

## Views (`?role=`)

| Role | View |
|---|---|
| `venue` | Venue Admin: registration + AI estimator, live diversion counters, EBWGR/CPCB certificate, JSON/CSV export, Green Certificate |
| `field` | Field Lead: guided 3-step flow, live camera + Gemini Vision, bin tap-cards, 4-step food safety check, colour QR tag |
| `ngo` | NGO Partner: transit tracker, SLA timer, Google Maps route, photo-proof requests, Red QR scan, accept/reject, WhatsApp receipt |
| `recycler` | Recycler Gate: QR scan, arrival photo, weighbridge mass with ±5% variance check |
| `tower` | Control Tower: Jaipur ward & MRF radar, transit audit, proof requests, SLA fallback, stage fast-forward |
| `business` | Unit economics, partner revenue share, municipal scaling |

Deep links: `?role=ngo&bagId=SC-FR-0007` highlights a bag. `?role=recycler&bagId=…` opens its intake panel. Every QR tag encodes such a link, plus enough data to rebuild the bag on a device that has never seen it.

## Notes

- **AI calls go through a server function:** the browser posts the photo to `/api/analyze-waste` ([api/analyze-waste.js](api/analyze-waste.js) → [server/analyze-waste.js](server/analyze-waste.js)), which calls Gemini with `GEMINI_API_KEY` from the server environment. The key never ships to the browser. In `npm run dev` the same handler runs as Vite middleware. The endpoint only accepts same-site browser calls, validates the stream, and caps image size.
- **AI guardrail:** `analyzeWasteImageWithAI` (src/lib/gemini.js) aborts after `VITE_GEMINI_TIMEOUT_MS` (1500 ms) and finishes an on-device analysis 600 ms later. The result card shows which path ran.
- **Model:** `gemini-1.5-flash` from the spec (and `2.5-flash`) are retired for new keys. The default is `gemini-3.5-flash-lite`, which answered in ~1.1 s in testing. Bigger models such as `gemini-3.8-flash` usually miss the 1.5 s guardrail. Set with `GEMINI_MODEL`.
- **Vercel env vars:** set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) for Production and Preview in the project settings.
- **State:** all state lives in `localStorage` and syncs live across tabs on the same device (e.g. a projector tab + a phone-sized tab). There is no backend. "Reset demo" in Control Tower restores the opening 225/240 kg state.
- The certificate, partners and business figures are demo/illustrative, not official filings.
