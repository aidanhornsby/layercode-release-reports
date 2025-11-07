import { NextRequest, NextResponse } from "next/server";
import { fetchCommitsFromGitHub } from "@/lib/github";
import { generateSummaryHtml } from "@/lib/openai-summary";
import { HttpError, UpstreamError } from "@/lib/errors";
import type { DeployReportResponse } from "@/types/report";

export const runtime = "nodejs";
export const preferredRegion = "auto";

const MAX_WINDOW_DAYS = 30;
const TOTAL_TIMEOUT_MS = 120_000;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toIsoRange(start: string, end: string) {
  const startIso = `${start}T00:00:00Z`;
  const endIso = `${end}T23:59:59Z`;
  return { startIso, endIso };
}

function buildErrorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return buildErrorResponse("Both start and end dates are required.", 400);
  }

  if (!DATE_ONLY_REGEX.test(start) || !DATE_ONLY_REGEX.test(end)) {
    return buildErrorResponse("Dates must be formatted as YYYY-MM-DD.", 400);
  }

  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return buildErrorResponse("Start and end dates must be valid.", 400);
  }

  if (startDate > endDate) {
    return buildErrorResponse("Start date cannot be after end date.", 400);
  }

  const daySpan = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (daySpan > MAX_WINDOW_DAYS) {
    return buildErrorResponse(`Date span cannot exceed ${MAX_WINDOW_DAYS} days.`, 413);
  }

  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = normalizeModelName(process.env.OPENAI_MODEL ?? process.env.OPENAI_REALTIME_MODEL);
  if (!repo) {
    return buildErrorResponse("GITHUB_REPO is not configured.", 500);
  }

  if (!token) {
    return buildErrorResponse("GITHUB_TOKEN is not configured.", 500);
  }

  const { startIso, endIso } = toIsoRange(start, end);
  const abortController = new AbortController();
  // Hard stop after 120s to comply with the spec's timeout budget.
  const timeout = setTimeout(() => abortController.abort(), TOTAL_TIMEOUT_MS);

  try {
    const commits = await fetchCommitsFromGitHub({
      repo,
      token,
      since: startIso,
      until: endIso,
      signal: abortController.signal,
    });
    let summaryHtml = `<section><p>No commits found between ${start} and ${end}.</p></section>`;
    if (commits.length > 0) {
      summaryHtml = await generateSummaryHtml({
        model: model ?? "",
        apiKey: apiKey ?? "",
        repo,
        start,
        end,
        commits,
        signal: abortController.signal,
      });
    }
    try {
      const responseBody: DeployReportResponse = {
        repo,
        start,
        end,
        commits,
        summary_html: summaryHtml,
        meta: {
          commit_count: commits.length,
          model: model ?? "unknown",
          generated_at: new Date().toISOString(),
          source: "github_live",
        },
      };

      return NextResponse.json(responseBody);
    } catch (error) {
      console.log("=========error=========", error);
    }
  } catch (error) {
    if (abortController.signal.aborted) {
      return buildErrorResponse("Processing exceeded the 120s timeout.", 504);
    }

    if (error instanceof HttpError) {
      return buildErrorResponse(error.message, error.status);
    }

    if (error instanceof UpstreamError) {
      return buildErrorResponse(error.message, error.status >= 400 ? error.status : 502);
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return buildErrorResponse("Processing exceeded the 120s timeout.", 504);
    }

    return buildErrorResponse(
      error instanceof Error ? error.message : "Unexpected error while generating deploy report.",
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeModelName(input?: string | null): string | undefined {
  if (!input) {
    return undefined;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }
  const segments = trimmed.split("/");
  return segments[segments.length - 1] || trimmed;
}
