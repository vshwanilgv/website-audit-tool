import * as cheerio from "cheerio";
import type { RawMetrics } from "./types";

const CTA_PATTERNS =
  /get started|contact|sign up|book|schedule|request|learn more|try|start|buy|shop|demo|free|download/i;

const NAV_SELECTORS = "nav a, header a, [role='navigation'] a";

export async function scrapeUrl(
  url: string
): Promise<{ metrics: RawMetrics; duration_ms: number }> {
  const start = Date.now();

  let html: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    // Next.js 14 exposes native fetch globally; node-fetch is not needed at runtime
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WebAuditBot/1.0; +https://github.com/website-audit-tool)",
      },
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    html = await response.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch URL: ${msg}`);
  }

  const $ = cheerio.load(html);

  // Remove script/style nodes so they don't pollute text extraction
  $("script, style, noscript").remove();

  // --- Word count ---
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const word_count = bodyText
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  // --- Headings ---
  const headings = {
    h1: $("h1").length,
    h2: $("h2").length,
    h3: $("h3").length,
  };

  // --- CTAs ---
  // Collect nav link hrefs to exclude them
  const navHrefs = new Set<string>();
  $(NAV_SELECTORS).each((_, el) => {
    const href = $(el).attr("href");
    if (href) navHrefs.add(href);
  });

  let cta_count = $("button").length;

  $("a").each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href") ?? "";
    if (navHrefs.has(href)) return;
    if (CTA_PATTERNS.test(text)) cta_count++;
  });

  // --- Links ---
  let parsedHostname: string;
  try {
    parsedHostname = new URL(url).hostname;
  } catch {
    parsedHostname = "";
  }

  let internal = 0;
  let external = 0;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (href.startsWith("/") || href.startsWith("#")) {
      internal++;
      return;
    }
    try {
      const linkHostname = new URL(href).hostname;
      if (linkHostname === parsedHostname) {
        internal++;
      } else {
        external++;
      }
    } catch {
      // Relative URL without leading slash — treat as internal
      internal++;
    }
  });

  // --- Images ---
  const imgEls = $("img");
  const total = imgEls.length;
  let missing_alt = 0;
  imgEls.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined || alt === null || alt.trim() === "") missing_alt++;
  });
  const missing_alt_pct =
    total === 0 ? 0 : Math.round((missing_alt / total) * 100);

  // --- Meta ---
  const title = $("title").first().text().trim() || null;
  const descriptionEl = $('meta[name="description"]');
  const description =
    descriptionEl.length > 0
      ? (descriptionEl.attr("content")?.trim() ?? null)
      : null;

  // --- Page text sample ---
  const page_text_sample = bodyText.slice(0, 2000);

  const duration_ms = Date.now() - start;

  return {
    metrics: {
      word_count,
      headings,
      cta_count,
      links: { internal, external },
      images: { total, missing_alt, missing_alt_pct },
      meta: { title, description },
      page_text_sample,
    },
    duration_ms,
  };
}
