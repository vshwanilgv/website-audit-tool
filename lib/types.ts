export interface RawMetrics {
  word_count: number;
  headings: {
    h1: number;
    h2: number;
    h3: number;
  };
  cta_count: number;
  links: {
    internal: number;
    external: number;
  };
  images: {
    total: number;
    missing_alt: number;
    missing_alt_pct: number;
  };
  meta: {
    title: string | null;
    description: string | null;
  };
  page_text_sample: string;
}

export interface AIInsights {
  seo_structure: string;
  messaging_clarity: string;
  cta_usage: string;
  content_depth: string;
  ux_concerns: string;
}

export interface Recommendation {
  priority: number;
  severity: "critical" | "moderate" | "minor";
  action: string;
  reasoning: string;
}

export interface AIOutput {
  thinking: string;           // Internal reasoning — logged only, not shown in UI
  insights: AIInsights;
  recommendations: Recommendation[];
}

export interface AuditLog {
  audit_id: string;
  url: string;
  timestamp: string;
  scrape: {
    duration_ms: number;
    raw_metrics: RawMetrics;
  };
  ai_request: {
    model: string;
    system_prompt: string;
    user_prompt: string;
    temperature: number;
    max_tokens: number;
  };
  ai_response: {
    duration_ms: number;
    raw_output: string;
    parsed_output: AIOutput | null;
    parse_error: string | null;
  };
}

export interface AuditResult {
  audit_id: string;
  url: string;
  timestamp: string;
  metrics: RawMetrics;
  ai_output: AIOutput | null;
  error: string | null;
}
