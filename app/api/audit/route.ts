import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { scrapeUrl } from "@/lib/scraper";
import { runAuditAnalysis } from "@/lib/ai";
import { writeAuditLog } from "@/lib/logger";
import type { AuditLog, AuditResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("url" in body) ||
    typeof (body as { url: unknown }).url !== "string" ||
    !(body as { url: string }).url.trim()
  ) {
    return NextResponse.json(
      { error: "Missing or invalid 'url' field" },
      { status: 400 }
    );
  }

  const rawUrl = (body as { url: string }).url.trim();

  try {
    new URL(rawUrl);
  } catch {
    return NextResponse.json(
      { error: "Provided URL is not valid. Include the protocol (https://)" },
      { status: 400 }
    );
  }

  const audit_id = uuidv4();
  const timestamp = new Date().toISOString();

  try {
    const { metrics, duration_ms: scrape_duration } = await scrapeUrl(rawUrl);

    const {
      raw_output,
      parsed_output,
      parse_error,
      duration_ms: ai_duration,
      system_prompt,
      user_prompt,
    } = await runAuditAnalysis(metrics, rawUrl);

    const log: AuditLog = {
      audit_id,
      url: rawUrl,
      timestamp,
      scrape: {
        duration_ms: scrape_duration,
        raw_metrics: metrics,
      },
      ai_request: {
        model: "gemini-2.5-flash",
        system_prompt,
        user_prompt,
        temperature: 0.3,
        max_tokens: 8192,
      },
      ai_response: {
        duration_ms: ai_duration,
        raw_output,
        parsed_output,
        parse_error,
      },
    };

    // Fire-and-forget — do not block the response on disk I/O
    writeAuditLog(log);

    const result: AuditResult = {
      audit_id,
      url: rawUrl,
      timestamp,
      metrics,
      ai_output: parsed_output,
      error: parse_error
        ? `AI response could not be parsed: ${parse_error}`
        : null,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    let message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("429") || message.includes("Too Many Requests") || message.includes("quota")) {
      message =
        "Gemini API quota exceeded or billing not enabled. Ensure your GEMINI_API_KEY is a valid API key (starts with 'AIza') from aistudio.google.com/apikey, and that your project has quota available.";
    } else if (message.includes("503") || message.includes("Service Unavailable") || message.includes("high demand")) {
      message =
        "Gemini API is currently experiencing high demand. The request was retried 3 times. Please wait a moment and try again.";
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
