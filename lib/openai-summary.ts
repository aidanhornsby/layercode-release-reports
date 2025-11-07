import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { HttpError, UpstreamError } from "./errors";
import type { CommitSummary } from "@/types/report";

interface GenerateSummaryOptions {
  model: string;
  apiKey: string;
  repo: string;
  start: string;
  end: string;
  commits: CommitSummary[];
  signal?: AbortSignal;
}

function extractCommitDetails(message: string) {
  const [title, ...rest] = message.split("\n");
  return {
    title: title?.trim() || "Untitled commit",
    description: rest.join("\n").trim(),
  };
}

function buildBulletList(commits: CommitSummary[]): string {
  return commits
    .map((commit) => {
      const { title, description } = extractCommitDetails(commit.message);
      const date = commit.date ? new Date(commit.date).toISOString().slice(0, 10) : "????-??-??";
      const detail = description || "No additional description provided.";
      return `${date} • ${title}\nDescription: ${detail}`;
    })
    .join("\n");
}

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return match;
    }
  });
}

function buildFallbackSummary(repo: string, start: string, end: string, commits: CommitSummary[]) {
  const grouped = commits.reduce<Record<string, CommitSummary[]>>((acc, commit) => {
    const date = commit.date ? new Date(commit.date).toISOString().slice(0, 10) : "Unknown date";
    acc[date] = acc[date] || [];
    acc[date].push(commit);
    return acc;
  }, {});

  const sections = Object.entries(grouped)
    .sort(([a], [b]) => (a <= b ? -1 : 1))
    .map(
      ([date, items]) => `
        <article>
          <h3>${date}</h3>
          <ul>
            ${items
              .map((commit) => {
                const summary = commit.summary_line || commit.message.split("\n")[0] || commit.sha;
                return `<li><strong>${escapeHtml(summary)}</strong></li>`;
              })
              .join("")}
          </ul>
        </article>
      `
    )
    .join("");

  const startDate = new Date(start).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const endDate = new Date(end).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
    <section>
      <p>Activity covering ${escapeHtml(startDate)} to ${escapeHtml(endDate)}.</p>
      ${sections || "<p>No non-merge commits were available.</p>"}
    </section>
  `;
}

export async function generateSummaryHtml(options: GenerateSummaryOptions): Promise<string> {
  const { model, apiKey, repo, start, end, commits, signal } = options;

  if (!apiKey) {
    throw new HttpError(500, "OPENAI_API_KEY is not configured.");
  }

  if (!model) {
    throw new HttpError(500, "OpenAI model is not configured.");
  }

  if (commits.length === 0) {
    return `<section><p>No commits found between ${start} and ${end} for ${repo}.</p></section>`;
  }

  const systemPrompt = [
    `You are an internal release reporter for the GitHub repository ${repo}.`,
    "For each commit bullet you receive, render an <article> with:",
    "- An <h3> showing the commit title.",
    "- A paragraph or short list immediately below that explains what shipped, using both the title and the description text (but do not repeat the full description verbatim).",
    "Feel free to group related commits under shared sections if it improves readability, but keep the per-commit headings intact.",
    "Highlight impact, avoid assumptions, and never invent work that is not grounded in the provided bullet.",
    "Respond with semantic HTML only (section, article, h2-h4, p, ul, li). No inline styles, scripts, or markdown.",
  ].join(" ");

  const bulletList = buildBulletList(commits);
  const userPrompt = [`Date range: ${start} to ${end}.`, "Commits (chronological):", bulletList].join("\n");

  const openai = createOpenAI({ apiKey });

  try {
    const languageModel = openai(model);

    const { text } = await generateText({
      model: languageModel,
      system: systemPrompt,
      prompt: userPrompt,
      abortSignal: signal,
    });

    const raw = text.trim();
    if (!raw) {
      return buildFallbackSummary(repo, start, end, commits);
    }

    return raw.startsWith("<") ? raw : `<section><p>${escapeHtml(raw)}</p></section>`;
  } catch (error) {
    if (error instanceof HttpError || (error instanceof Error && error.name === "AbortError")) {
      throw error;
    }

    const status =
      typeof (error as { status?: number }).status === "number" ? (error as { status?: number }).status! : 502;

    throw new UpstreamError(
      "openai",
      status,
      error instanceof Error ? error.message : "OpenAI text completion failed."
    );
  }
}
