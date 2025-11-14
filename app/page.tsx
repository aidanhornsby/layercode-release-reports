"use client";

import { useCallback, useMemo, useState } from "react";
import type { DeployReportResponse } from "@/types/report";

const MAX_DATE_RANGE_DAYS = 30;

type FetchStatus = "idle" | "loading" | "success" | "error";

interface ValidationErrors {
  start?: string;
  end?: string;
  range?: string;
}

interface FetchError {
  message: string;
  status?: number;
}

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const initializeDateRange = () => {
  const today = new Date();
  const prior = new Date(today);
  prior.setDate(today.getDate() - 7);
  return {
    start: formatDate(prior),
    end: formatDate(today),
  };
};

export default function HomePage() {
  const [{ start, end }, setDates] = useState(() => initializeDateRange());
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [fetchError, setFetchError] = useState<FetchError | null>(null);
  const [data, setData] = useState<DeployReportResponse | null>(null);

  const validate = useCallback((nextStart: string, nextEnd: string): ValidationErrors => {
    const validation: ValidationErrors = {};
    if (!nextStart) {
      validation.start = "Start date is required";
    }
    if (!nextEnd) {
      validation.end = "End date is required";
    }

    const startDate = nextStart ? new Date(`${nextStart}T00:00:00`) : null;
    const endDate = nextEnd ? new Date(`${nextEnd}T00:00:00`) : null;

    if (startDate && nextStart !== formatDate(startDate)) {
      validation.start = "Invalid start date";
    }
    if (endDate && nextEnd !== formatDate(endDate)) {
      validation.end = "Invalid end date";
    }

    if (startDate && endDate) {
      if (startDate > endDate) {
        validation.end = "End date must be after the start date";
      }
      const daySpan = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (daySpan > MAX_DATE_RANGE_DAYS) {
        validation.range = `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days.`;
      }
    }

    return validation;
  }, []);

  const handleInputChange = useCallback((key: "start" | "end", value: string) => {
    setDates((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, range: undefined }));
  }, []);

  const handleSubmit = async () => {
    const validation = validate(start, end);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setStatus("loading");
    setErrors({});
    setFetchError(null);

    try {
      const params = new URLSearchParams({ start, end });
      const response = await fetch(`/deploy-report?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = errorBody?.message || `Request failed with status ${response.status}.`;
        setFetchError({ message, status: response.status });
        setStatus("error");
        setData(null);
        return;
      }

      const payload = (await response.json()) as DeployReportResponse;
      setData(payload);
      setStatus("success");
    } catch (error) {
      setFetchError({
        message: error instanceof Error ? error.message : "Unexpected error while fetching the deploy report.",
      });
      setStatus("error");
      setData(null);
    }
  };

  const hasCommits = data?.commits?.length ? data.commits.length > 0 : false;

  const summaryHtml = useMemo(() => {
    if (!data?.summary_html) {
      return "";
    }
    return data.summary_html;
  }, [data]);

  return (
    <>
      <main className="main-container">
        <div className="window-title-bar">
          <div className="traffic-lights">
            <div className="traffic-light red"></div>
            <div className="traffic-light yellow"></div>
            <div className="traffic-light green"></div>
          </div>
          <h2 className="window-title">Layercode Product Release Reports</h2>
        </div>
        <div className="window-content">
        <section className="date-picker-section">
          <div className="date-picker-container">
            <div className="date-inputs-wrapper">
              <div className="date-input-group">
                <label htmlFor="start-date">Start Date</label>
                <input
                  id="start-date"
                  className="date-input"
                  type="date"
                  value={start}
                  onChange={(event) => handleInputChange("start", event.target.value)}
                  max={formatDate(new Date())}
                />
                {errors.start && <span className="error-message">{errors.start}</span>}
              </div>

              <div className="date-separator" aria-hidden="true">
                →
              </div>

              <div className="date-input-group">
                <label htmlFor="end-date">End Date</label>
                <input
                  id="end-date"
                  className="date-input"
                  type="date"
                  value={end}
                  onChange={(event) => handleInputChange("end", event.target.value)}
                  max={formatDate(new Date())}
                />
                {errors.end && <span className="error-message">{errors.end}</span>}
              </div>
            </div>

            <div className="button-wrapper">
              <button type="button" className="generate-btn" onClick={handleSubmit} disabled={status === "loading"}>
                <span className="btn-text">{status === "loading" ? "Generating..." : "Generate Report"}</span>
                {status === "loading" && (
                  <span className="btn-loader">
                    <svg className="spinner" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                      <path
                        fill="currentColor"
                        opacity="0.75"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </div>
          {errors.range && <div className="range-error">{errors.range}</div>}
        </section>

        {status === "error" && fetchError && (
          <div className="error-display">
            <div className="error-icon" role="img" aria-label="Error">
              ⚠️
            </div>
            <div className="error-content">
              <h3>Request failed</h3>
              <p>{fetchError.message}</p>
              <button
                type="button"
                className="retry-btn"
                onClick={() => {
                  setStatus("idle");
                  setFetchError(null);
                }}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {status === "success" && data && (
          <>
            <div className="content-grid">
              <div className="column-wrap">
                <section className="commits-panel">
                  <div className="panel-header">
                    <h2>Commits</h2>
                    <span className="commit-count">
                      {data.meta.commit_count} commit
                      {data.meta.commit_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="commits-container">
                    {hasCommits ? (
                      data.commits.map((commit) => (
                        <article className="commit-card" key={commit.sha}>
                          <div className="commit-meta">
                            <span className="commit-sha" title={commit.sha}>
                              {commit.sha.slice(0, 7)}
                            </span>
                            <time dateTime={commit.date}>
                              {new Date(commit.date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </time>
                          </div>
                          <div className="commit-summary">{commit.summary_line || "No subject line provided."}</div>
                          <div className="commit-author">
                            {commit.author.login || commit.author.name || "Unknown author"}
                          </div>
                          <pre className="commit-message">{commit.message}</pre>
                        </article>
                      ))
                    ) : (
                      <div className="commits-empty">No commits found for this range.</div>
                    )}
                  </div>
                </section>

                <section className="summary-panel">
                  <div className="panel-header">
                    <h2>What We Shipped</h2>
                  </div>
                  <div className="summary-container" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                  <div className="summary-footer">
                    <div>Model: {data.meta.model}</div>
                    <div>Generated: {new Date(data.meta.generated_at).toLocaleString()}</div>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}

        {status === "success" && data && !hasCommits && (
          <div className="empty-state">
            <div className="empty-icon" role="img" aria-label="Empty state">
              📦
            </div>
            <h3>No Releases Found</h3>
            <p>There are no commits in the selected date range. Try adjusting your dates.</p>
          </div>
        )}

        {status === "loading" && (
          <div className="content-grid">
            <section className="commits-panel">
              <div className="panel-header">
                <h2>Commits</h2>
                <span className="commit-count">Loading…</span>
              </div>
              <div className="commits-container">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="commit-card skeleton" key={`skeleton-${index}`}>
                    <div className="skeleton-line" style={{ width: "60%" }} />
                    <div className="skeleton-line" style={{ width: "80%" }} />
                    <div className="skeleton-line" style={{ width: "90%" }} />
                  </div>
                ))}
              </div>
            </section>

            <section className="summary-panel">
              <div className="panel-header">
                <h2>What We Shipped</h2>
              </div>
              <div className="summary-container">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="skeleton-line skeleton" key={`summary-${index}`} />
                ))}
              </div>
            </section>
          </div>
        )}
        </div>
      </main>
    </>
  );
}
