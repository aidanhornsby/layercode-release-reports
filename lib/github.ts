import { HttpError, UpstreamError } from "./errors";
import type { CommitSummary } from "@/types/report";

interface FetchGitHubCommitsOptions {
  repo: string;
  token: string;
  since: string;
  until: string;
  signal?: AbortSignal;
}

interface GitHubCommit {
  sha: string;
  commit: {
    author?: {
      name?: string | null;
      email?: string | null;
      date?: string | null;
    };
    committer?: {
      name?: string | null;
      email?: string | null;
      date?: string | null;
    };
    message?: string | null;
  };
  author?: {
    login?: string | null;
  } | null;
  parents?: Array<Record<string, unknown>>;
}

const PER_PAGE = 100;

/**
 * Fetches commit data from GitHub with pagination and normalizes it
 * for downstream usage.
 */
export async function fetchCommitsFromGitHub(
  options: FetchGitHubCommitsOptions
): Promise<CommitSummary[]> {
  const { repo, token, since, until, signal } = options;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "layercode-release-reports"
  };

  let page = 1;
  const normalized: CommitSummary[] = [];

  while (true) {
    const url = new URL(`https://api.github.com/repos/${repo}/commits`);
    url.searchParams.set("since", since);
    url.searchParams.set("until", until);
    url.searchParams.set("per_page", String(PER_PAGE));
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers,
      signal
    });

    if (response.status === 403 || response.status === 429) {
      const body = await response.json().catch(() => ({}));
      const message =
        typeof body?.message === "string"
          ? body.message
          : "GitHub API rate limit or permission error.";

      if (message.toLowerCase().includes("secondary rate limit")) {
        throw new HttpError(429, message);
      }

      throw new UpstreamError("github", response.status, message);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message =
        typeof body?.message === "string"
          ? body.message
          : `GitHub API request failed with status ${response.status}.`;
      throw new UpstreamError("github", response.status, message);
    }

    const pageCommits = (await response.json()) as GitHubCommit[];

    for (const commit of pageCommits) {
      const message = commit.commit?.message ?? "";
      const summaryLine = message.split("\n")[0]?.trim() ?? "";

      const isMerge =
        (Array.isArray(commit.parents) && commit.parents.length > 1) ||
        summaryLine.toLowerCase().startsWith("merge");

      if (isMerge) {
        continue;
      }

      const date =
        commit.commit?.author?.date ??
        commit.commit?.committer?.date ??
        new Date().toISOString();

      normalized.push({
        sha: commit.sha,
        date,
        author: {
          login: commit.author?.login ?? null,
          name:
            commit.commit?.author?.name ??
            commit.commit?.committer?.name ??
            null
        },
        message,
        summary_line: summaryLine,
        is_merge: false
      });
    }

    if (pageCommits.length < PER_PAGE) {
      break;
    }

    page += 1;
  }

  return normalized;
}
