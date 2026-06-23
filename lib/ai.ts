import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RawMetrics, AIOutput } from "./types";

const MODEL = "gemini-2.5-flash";
const TEMPERATURE = 0.3;
const MAX_TOKENS = 8192;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

const SYSTEM_PROMPT = `You are a senior web marketing analyst specializing in SEO, conversion optimization, and UX for marketing websites. You will receive structured metrics extracted from a webpage along with a sample of the page's visible text content.

Your job is to produce a structured audit with two parts:
1. Insights across five categories
2. Three to five prioritized recommendations

Rules you must follow:
- Every insight must reference specific numbers from the provided metrics. Do not write generic advice.
- If a metric is strong, acknowledge it. If it is weak, explain why it matters.
- Recommendations must be ranked by impact, with the highest-impact item first.
- Each recommendation must include a clear reasoning sentence that cites the relevant metric.
- Do not hallucinate metrics. Only reference what is provided.
- Respond ONLY with valid JSON. No preamble, no explanation, no markdown code fences.

Response format:
{
  "insights": {
    "seo_structure": "string",
    "messaging_clarity": "string",
    "cta_usage": "string",
    "content_depth": "string",
    "ux_concerns": "string"
  },
  "recommendations": [
    {
      "priority": 1,
      "action": "string",
      "reasoning": "string"
    }
  ]
}`;

export function buildUserPrompt(metrics: RawMetrics, url: string): string {
  const { word_count, headings, cta_count, links, images, meta, page_text_sample } =
    metrics;

  return `Audit the following webpage and return your analysis as JSON.

URL: ${url}

--- EXTRACTED METRICS ---
Word Count: ${word_count}
Headings: H1=${headings.h1}, H2=${headings.h2}, H3=${headings.h3}
CTAs detected: ${cta_count}
Links: ${links.internal} internal, ${links.external} external
Images: ${images.total} total, ${images.missing_alt} missing alt text (${images.missing_alt_pct}%)
Meta Title: ${meta.title ?? "MISSING"}
Meta Description: ${meta.description ?? "MISSING"}

--- PAGE TEXT SAMPLE (first 2000 characters of visible body content) ---
${page_text_sample}

--- END OF INPUT ---

Respond only with the JSON object as specified. Do not include any text outside the JSON.`;
}

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("503") ||
    msg.includes("Service Unavailable") ||
    msg.includes("high demand")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAuditAnalysis(
  metrics: RawMetrics,
  url: string
): Promise<{
  raw_output: string;
  parsed_output: AIOutput | null;
  parse_error: string | null;
  duration_ms: number;
  system_prompt: string;
  user_prompt: string;
}> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  const user_prompt = buildUserPrompt(metrics, url);
  const start = Date.now();

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: user_prompt }] }],
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_TOKENS,
          // Gemini native JSON mode — guarantees valid JSON output
          responseMimeType: "application/json",
        },
      });

      const duration_ms = Date.now() - start;
      const raw_output = result.response.text();

      let parsed_output: AIOutput | null = null;
      let parse_error: string | null = null;

      try {
        parsed_output = JSON.parse(raw_output) as AIOutput;
      } catch (err: unknown) {
        parse_error = err instanceof Error ? err.message : String(err);
      }

      return {
        raw_output,
        parsed_output,
        parse_error,
        duration_ms,
        system_prompt: SYSTEM_PROMPT,
        user_prompt,
      };
    } catch (err: unknown) {
      lastError = err;
      if (isRetryable(err) && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.warn(
          `[ai] Gemini 503 on attempt ${attempt}/${MAX_RETRIES}, retrying in ${delay}ms…`
        );
        await sleep(delay);
        continue;
      }
      break;
    }
  }

  throw lastError;
}
