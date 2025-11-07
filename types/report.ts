export interface CommitAuthor {
  login: string | null;
  name: string | null;
}

export interface CommitSummary {
  sha: string;
  date: string;
  author: CommitAuthor;
  message: string;
  summary_line: string;
  is_merge: boolean;
}

export interface DeployReportResponse {
  repo: string;
  start: string;
  end: string;
  commits: CommitSummary[];
  summary_html: string;
  meta: {
    commit_count: number;
    model: string;
    generated_at: string;
    source: "github_live";
  };
}
