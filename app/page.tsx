"use client";

import { useState } from "react";
import type { AuditResult } from "@/lib/types";

// ---------- sub-components ----------

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-xl font-bold text-blue-900">{value}</p>
    </div>
  );
}

function InsightRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="border-b border-gray-100 last:border-0 py-3">
      <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}

function MetricsPanel({ result }: { result: AuditResult }) {
  const m = result.metrics;
  return (
    <div className="bg-white border border-blue-300 rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
        Factual Metrics
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <MetricCard label="Word Count" value={m.word_count.toLocaleString()} />
        <MetricCard label="CTAs Detected" value={m.cta_count} />
        <MetricCard
          label="H1 / H2 / H3"
          value={`${m.headings.h1} / ${m.headings.h2} / ${m.headings.h3}`}
        />
        <MetricCard label="Internal Links" value={m.links.internal} />
        <MetricCard label="External Links" value={m.links.external} />
        <MetricCard
          label="Images (total)"
          value={m.images.total}
        />
        <MetricCard
          label="Missing Alt Text"
          value={`${m.images.missing_alt} (${m.images.missing_alt_pct}%)`}
        />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">
            Meta Title
          </span>
          <span className="text-sm text-gray-800 break-all">
            {m.meta.title ?? (
              <span className="text-red-500 font-semibold">MISSING</span>
            )}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">
            Meta Desc.
          </span>
          <span className="text-sm text-gray-800 break-all">
            {m.meta.description ?? (
              <span className="text-red-500 font-semibold">MISSING</span>
            )}
          </span>
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">
          Show page text sample
        </summary>
        <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {m.page_text_sample || "(empty)"}
        </pre>
      </details>
    </div>
  );
}

function AIPanel({ result }: { result: AuditResult }) {
  if (!result.ai_output) {
    return (
      <div className="bg-white border border-indigo-200 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-indigo-800 mb-2">
          AI Insights &amp; Recommendations
        </h2>
        <p className="text-sm text-red-500">
          {result.error ?? "AI output could not be parsed."}
        </p>
      </div>
    );
  }

  const { insights, recommendations } = result.ai_output;

  const insightLabels: Record<keyof typeof insights, string> = {
    seo_structure: "SEO Structure",
    messaging_clarity: "Messaging Clarity",
    cta_usage: "CTA Usage",
    content_depth: "Content Depth",
    ux_concerns: "UX Concerns",
  };

  return (
    <div className="bg-white border border-indigo-300 rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-bold text-indigo-800 mb-4 flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />
        AI Insights &amp; Recommendations
      </h2>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">
          Insights
        </h3>
        {(Object.keys(insightLabels) as (keyof typeof insights)[]).map(
          (key) => (
            <InsightRow
              key={key}
              label={insightLabels[key]}
              text={insights[key]}
            />
          )
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">
          Recommendations (by priority)
        </h3>
        <ol className="space-y-3">
          {recommendations
            .sort((a, b) => a.priority - b.priority)
            .map((rec) => {
              const badge = rec.severity ?? "minor";
              const severityStyles = {
                critical: "bg-red-100 text-red-700 border border-red-300",
                moderate: "bg-amber-100 text-amber-700 border border-amber-300",
                minor: "bg-green-100 text-green-700 border border-green-300",
              };
              const badgeStyle = severityStyles[badge] ?? severityStyles.minor;
              return (
                <li
                  key={rec.priority}
                  className="flex gap-3 bg-indigo-50 border border-indigo-100 rounded-lg p-3"
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                    {rec.priority}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStyle}`}>
                        {badge.toUpperCase()}
                      </span>
                      <p className="text-sm font-semibold text-indigo-900">
                        {rec.action}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {rec.reasoning}
                    </p>
                  </div>
                </li>
              );
            })}
        </ol>
      </div>
    </div>
  );
}

interface ParsedOutput {
  thinking?: string;
  insights?: { [key: string]: string };
  recommendations?: Array<{
    priority: number;
    severity: string;
    action: string;
    reasoning: string;
  }>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function LogsModal({
  promptLog,
  onClose,
}: {
  promptLog: AuditResult["prompt_log"];
  onClose: () => void;
}) {
  if (!promptLog) return null;

  let parsedOutput: ParsedOutput | null = null;
  try {
    parsedOutput = JSON.parse(promptLog.raw_output) as ParsedOutput;
  } catch {
    parsedOutput = null;
  }

  const insightLabels: { key: string; label: string }[] = [
    { key: "seo_structure", label: "SEO Structure" },
    { key: "messaging_clarity", label: "Messaging Clarity" },
    { key: "cta_usage", label: "CTA Usage" },
    { key: "content_depth", label: "Content Depth" },
    { key: "ux_concerns", label: "UX Concerns" },
  ];

  const severityStyles: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border border-red-300",
    moderate: "bg-amber-100 text-amber-700 border border-amber-300",
    minor: "bg-green-100 text-green-700 border border-green-300",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-10 px-4 pb-10">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="font-bold text-gray-800">Prompt Log</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">

          {/* Section 1 — System Prompt */}
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
              System Prompt
            </p>
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-4 pr-16 rounded-lg whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {promptLog.system_prompt}
              </pre>
              <CopyButton text={promptLog.system_prompt} />
            </div>
          </div>

          {/* Section 2 — User Prompt */}
          <div className="border-t border-gray-100 pt-6">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
              User Prompt
            </p>
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 text-xs font-mono p-4 pr-16 rounded-lg whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {promptLog.user_prompt}
              </pre>
              <CopyButton text={promptLog.user_prompt} />
            </div>
          </div>

          {/* Section 3 — Model Response */}
          <div className="border-t border-gray-100 pt-6">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-4">
              Model Response
            </p>

            {parsedOutput ? (
              <div className="space-y-5">
                {parsedOutput.thinking && (
                  <div>
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                      Thinking
                    </p>
                    <div className="bg-indigo-950 text-indigo-100 text-sm p-4 rounded-lg leading-relaxed">
                      {parsedOutput.thinking}
                    </div>
                  </div>
                )}

                {parsedOutput.insights && (
                  <div>
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                      Insights
                    </p>
                    <div className="space-y-2">
                      {insightLabels.map(({ key, label }) =>
                        parsedOutput?.insights?.[key] ? (
                          <div
                            key={key}
                            className="flex gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3"
                          >
                            <span className="text-xs font-bold text-gray-500 w-36 shrink-0 pt-0.5">
                              {label}
                            </span>
                            <span className="text-sm text-gray-700">
                              {parsedOutput.insights[key]}
                            </span>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                {parsedOutput.recommendations && parsedOutput.recommendations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                      Recommendations
                    </p>
                    <ol className="space-y-3">
                      {[...parsedOutput.recommendations]
                        .sort((a, b) => a.priority - b.priority)
                        .map((rec) => {
                          const badge = rec.severity ?? "minor";
                          const badgeStyle =
                            severityStyles[badge] ?? severityStyles.minor;
                          return (
                            <li
                              key={rec.priority}
                              className="flex gap-3 bg-indigo-50 border border-indigo-100 rounded-lg p-3"
                            >
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                                {rec.priority}
                              </span>
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span
                                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeStyle}`}
                                  >
                                    {badge.toUpperCase()}
                                  </span>
                                  <p className="text-sm font-semibold text-indigo-900">
                                    {rec.action}
                                  </p>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                  {rec.reasoning}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all bg-gray-50 border border-gray-200 rounded p-4">
                {promptLog.raw_output}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- main page ----------

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [logsOpen, setLogsOpen] = useState(false);
  const [promptLog, setPromptLog] = useState<AuditResult["prompt_log"]>(null);
  const [quotaError, setQuotaError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setQuotaError(false);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json()) as AuditResult & { error?: string };
      if (!res.ok) {
        if (data.error === "quota_exceeded") {
          setQuotaError(true);
        } else {
          setError(data.error ?? "Audit failed.");
        }
      } else {
        setResult(data);
        setPromptLog(data.prompt_log ?? null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error — please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen py-10 px-4">
      {logsOpen && (
        <LogsModal promptLog={promptLog} onClose={() => setLogsOpen(false)} />
      )}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Website Audit Tool
          </h1>
          <p className="mt-2 text-gray-500 text-sm max-w-lg mx-auto">
            Enter any URL to extract factual page metrics and receive
            AI-generated insights grounded in those exact numbers.
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading && <Spinner />}
            {loading ? "Analyzing..." : "Run Audit"}
          </button>
          <button
            type="button"
            onClick={() => setLogsOpen(true)}
            disabled={!promptLog}
            className="inline-flex items-center gap-1 border border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-800 font-medium px-4 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            View Prompt Logs
          </button>
        </form>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-3">
            <Spinner />
            <span>Analyzing page ...</span>
          </div>
        )}

        {/* Quota error */}
        {quotaError && !loading && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-800">
            <span className="text-xl">⏳</span>
            <div>
              <p className="font-semibold text-sm">Oh! that was too fast.</p>
              <p className="text-sm mt-0.5">
                Shall we wait another 2 minutes before the next free scan?
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400">
                Audit ID:{" "}
                <code className="font-mono bg-gray-100 px-1 rounded">
                  {result.audit_id}
                </code>
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-gray-400">
                {new Date(result.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MetricsPanel result={result} />
              <AIPanel result={result} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
