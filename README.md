# Website Audit Tool

## 1. Overview

An AI-native internal tool for EIGHT25MEDIA that accepts a single URL, extracts factual page metrics via raw HTML scraping (word count, headings, CTAs, links, images, meta tags), then passes those structured metrics to Claude to generate grounded insights and prioritized recommendations. Every audit run produces a full prompt log capturing the system prompt, user prompt, raw model response, and parsed output — so the AI's reasoning is always auditable.

---

## 2. Setup & Running Locally

```bash
npm install
# Add your key to .env.local:
# GEMINI_API_KEY=your_key_here
npm run dev
# Open http://localhost:3000
```

---

## 3. Architecture Overview

The tool is split into three strictly separated layers:

- **Layer 1 (Scraper):** `lib/scraper.ts` — deterministic HTML extraction using `node-fetch` and `cheerio`. Zero AI involvement. Returns a `RawMetrics` object with word count, heading counts, CTA count, internal/external link counts, image alt-text coverage, meta title/description, and a 2000-character page text sample.

- **Layer 2 (AI Analysis):** `lib/ai.ts` — receives the `RawMetrics` struct and the URL; constructs a system prompt and user prompt; calls the Claude API; parses the JSON response into `AIOutput`. Never touches the DOM or HTML.

- **Layer 3 (Orchestration):** `app/api/audit/route.ts` — sequences the scrape call, then the AI call, assembles a full `AuditLog` (including both prompts and raw model output), fire-and-forgets the log write, and returns a lean `AuditResult` to the frontend. The full log never leaves the server.

All shared types live in `lib/types.ts` and are imported everywhere — no inline type definitions in other files.

---

## 4. AI Design Decisions

**Temperature 0.3:** Audit analysis rewards consistency over creativity. A lower temperature means the model produces stable, analytical output that is easier to compare across runs and less likely to fabricate emphatic but ungrounded claims.

**Metric citation enforced in system prompt:** The system prompt explicitly instructs the model to reference specific numbers from the provided metrics in every insight. This eliminates the most common failure mode of AI audit tools: generic advice ("add more CTAs") that ignores what is actually on the page.

**Structured labeled text in user prompt:** Metrics are injected as clearly labeled key-value pairs (`Word Count: 1240`, `CTAs detected: 3`) rather than as a JSON blob. This format is unambiguous, matches how a human analyst would read a brief, and reduces the chance of the model misreading nested structures.

**JSON-only output enforced:** The system prompt specifies "Respond ONLY with valid JSON. No preamble, no explanation, no markdown code fences." This makes response parsing reliable. As a defensive measure, the parser also strips markdown fences in case the model includes them despite the instruction.

**`raw_output` logged separately from `parsed_output`:** Even when JSON parsing succeeds, the raw model response is preserved in the log. If a parse fails, `parse_error` captures the exception message while `raw_output` preserves what the model actually said — so a debugging session always has the full picture.

**Chain of Thought (`thinking` field):** The model is instructed to reason through the metrics explicitly before producing insights. This reasoning is captured in the `thinking` field of the log, making the model's analytical process fully transparent and verifiable. It is intentionally excluded from the UI — it exists for auditability, not presentation.

**Severity scoring:** Each recommendation is assigned a severity level (critical, moderate, minor) by the model based on the metric data. This is enforced in the system prompt rather than computed post-hoc, so the model's severity judgment is grounded in the same reasoning that produced the recommendation.

---

## 5. Prompt Logs

Every audit run writes a complete log to `/logs/{audit_id}.json`. Each log contains:

- `audit_id` and `url`
- `timestamp`
- `scrape.duration_ms` and `scrape.raw_metrics` — everything extracted from the page
- `ai_request.system_prompt` — the exact system prompt sent
- `ai_request.user_prompt` — the exact user prompt sent, with all metrics injected
- `ai_request.model`, `temperature`, `max_tokens`
- `ai_response.duration_ms` — Claude's response latency
- `ai_response.raw_output` — the model's raw response string before any parsing
- `ai_response.parsed_output` — the structured `AIOutput` if parsing succeeded
- `ai_response.parse_error` — the parse exception message if parsing failed, otherwise null

The `/logs` directory is gitignored because it can contain scraped page content. The evaluator generates their own logs by running the tool against real URLs.

Prompt logs can also be inspected directly from the UI via the **"View Prompt Logs"** button, which calls `GET /api/logs` and renders the last 10 audit logs as formatted JSON.

---

## 6. Known Trade-offs

- **JavaScript rendering:** The scraper uses raw HTTP fetch. Client-side rendered pages (React SPAs, Vue apps) will return incomplete metrics because the JS has not executed. Playwright integration would resolve this and is the clear next step.
- **Single page only:** No crawling, sitemap analysis, or multi-page comparison. One URL = one audit.
- **CTA detection is heuristic:** Detection is based on link text pattern matching against common marketing phrases. It will miss non-standard CTAs and may over-count buttons that are not actually CTAs.
- **No rate limiting or caching:** Multiple rapid requests to the same URL will hit both the target site and the Claude API each time. A simple in-memory or Redis cache would eliminate redundant calls.

---

## 7. Deployment

This project is deployed on Vercel using a combination of Vercel's native
GitHub integration and a GitHub Actions CI pipeline.

### How It Works

**Vercel Native Integration** handles deployment automatically.
Every push to `main` triggers a production deployment on Vercel.
No manual deployment steps are required after initial setup.

**GitHub Actions CI** (`.github/workflows/ci.yml`) runs on every push to `main`
and on pull requests targeting `main`. It performs:
- TypeScript type checking (`tsc --noEmit`)
- Next.js production build verification (`next build`)

The CI pipeline does not deploy. It acts as a quality gate that surfaces
type errors and build failures visibly in GitHub before Vercel serves the update.

### Deployment Architecture

```
Push to main
     │
     ├──► GitHub Actions CI
     │         Install dependencies (npm ci)
     │         TypeScript type check (tsc --noEmit)
     │         Next.js build verification (next build)
     │         Reports pass/fail in GitHub UI
     │
     └──► Vercel Native Integration
               Builds and deploys automatically
               Serves production at .vercel.app URL
```

### Environment Variables

The Gemini API key must be set in two separate places:

| Variable         | Where                                                           | Purpose                          |
|------------------|-----------------------------------------------------------------|----------------------------------|
| `GEMINI_API_KEY` | Vercel → Project Settings → Environment Variables              | Runtime — AI calls in production |
| `GEMINI_API_KEY` | GitHub → Repository Settings → Secrets and variables → Actions | CI build step                    |

**In Vercel, enable the key for all three environments: Production, Preview,
and Development.** Preview deployments (generated for pull requests and
non-main branches) will fail to make AI calls if the key is only set for
Production.

The key is stored encrypted in both Vercel and GitHub. It is never written
to source code or exposed in build logs. Your code accesses it identically
in all environments via `process.env.GEMINI_API_KEY`.

### Local Development

```bash
# .env.local (gitignored — never committed)
GEMINI_API_KEY=your_key_here

npm run dev
# http://localhost:3000
```

### Known Filesystem Limitation on Vercel

Vercel's serverless functions run on a read-only filesystem. The logger
detects the `VERCEL` environment variable and writes logs to `/tmp/logs`
instead of the project root `logs/` directory.

Logs written to `/tmp` do not persist between function invocations in
production. **Prompt logs are fully functional when running locally**
(`npm run dev`), where they are written to the `logs/` directory and
persist across requests.

For production log persistence, the recommended next step would be to
replace the filesystem logger with a lightweight external store such as
Vercel KV, PlanetScale, or Upstash Redis.

---

## 8. What I Would Improve With More Time

- Headless browser integration (Playwright) for JS-rendered pages — the single biggest accuracy improvement
- Page screenshot capture and visual analysis passed alongside text metrics
- Caching audit results by URL + content hash to avoid redundant Claude calls
- Streaming AI responses to the frontend for faster perceived performance
- Comparative auditing — run two URLs and diff the results side by side
- Export audit report as a formatted PDF
- Multi-page crawl mode with aggregate scoring across a site
