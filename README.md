# Layercode Product Release Reports

Full-stack Next.js app that generates internal release notes by pulling live commit data from GitHub and summarising it with the OpenAI GPT-5 model via the Vercel AI SDK.

## Features

- **Single endpoint (`GET /deploy-report`)** that validates the requested date window and enforces a 30-day cap.
- **Live GitHub fetch** using the provided access token; merge commits are automatically filtered out.
- **LLM summary generation** via Vercel AI SDK + `openai/gpt-5`, returning semantic HTML without background jobs.
- **Responsive React UI** that matches the original colour palette while upgrading to the Next.js app router.
- **Spec-compliant error handling** for validation, rate limits, upstream failures, and the 120 s timeout budget.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   # then edit .env.local with real values
   ```

   Required keys:
   - `GITHUB_TOKEN` – token with read access to the target repo
   - `GITHUB_REPO` – `OWNER/REPO`
   - `OPENAI_API_KEY` – OpenAI API key with access to GPT-5 (Responses API)
   - `OPENAI_MODEL` – e.g. `gpt-5` (falls back to `OPENAI_REALTIME_MODEL` for backwards compatibility).  
     Use the bare model name—any provider prefix like `openai/` is stripped automatically.

3. **Run locally**
   ```bash
   npm run dev
   ```

   The app serves both the UI and the `/deploy-report` route at `http://localhost:3000`.

## API Contract

`GET /deploy-report?start=YYYY-MM-DD&end=YYYY-MM-DD`

- Validates input format, enforces `start <= end`, and rejects ranges > 30 days (`413`).
- Queries GitHub commits in `[startT00:00:00Z, endT23:59:59Z]`, paginating `per_page=100`.
- Drops merge commits (multiple parents or messages that begin with “Merge”).
- Builds compact bullets and requests a semantic HTML report from OpenAI GPT-5 via Vercel AI SDK.

### 200 Response

```json
{
  "repo": "OWNER/REPO",
  "start": "YYYY-MM-DD",
  "end": "YYYY-MM-DD",
  "commits": [
    {
      "sha": "string",
      "date": "ISO-8601",
      "author": { "login": "string|null", "name": "string|null" },
      "message": "full commit message",
      "summary_line": "first line of message",
      "is_merge": false
    }
  ],
  "summary_html": "<section>...</section>",
  "meta": {
    "commit_count": 0,
    "model": "string",
    "generated_at": "ISO-8601",
    "source": "github_live"
  }
}
```

### Error Responses

- `400` – Missing or invalid dates, `start > end`
- `413` – Date span over 30 days
- `429` – GitHub secondary rate limit surfaced
- `502` – Upstream provider failure (GitHub/OpenAI)
- `504` – Total processing time exceeded 120 s

## Frontend Notes

- Retains the original layout, palettes, and interaction patterns.
- Uses React state to handle validation, loaders, error surfaces, and empty states.
- Inserts the `summary_html` block with `dangerouslySetInnerHTML`; keep upstream prompt constrained to semantic HTML.

## Testing & Deployment Tips

- **Local smoke test:** `npm run dev`, hit `http://localhost:3000/deploy-report?start=YYYY-MM-DD&end=YYYY-MM-DD`.
- **Timeout budget:** ensure repos with large commit history stay under 120 s; adjust the GitHub token’s rate limit if needed.
- **Vercel deploy:** the project is App Router–ready. Add the four environment variables in the project settings before deploying.

## License

Internal project – all rights reserved.
