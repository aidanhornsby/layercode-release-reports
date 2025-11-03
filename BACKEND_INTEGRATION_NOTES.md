# Backend Integration Guide

This document outlines what your colleague needs to implement on the backend.

## Quick Start for Backend Developer

The frontend is complete and ready to integrate. You just need to implement the backend API endpoint.

## API Endpoint Required

**Endpoint:** `GET /deploy-report?start=YYYY-MM-DD&end=YYYY-MM-DD`

### Request Parameters
- `start` (required): Start date in YYYY-MM-DD format
- `end` (required): End date in YYYY-MM-DD format

### Response Format (200 OK)

```json
{
  "repo": "OWNER/REPO",
  "start": "2025-01-01",
  "end": "2025-01-07",
  "commits": [
    {
      "sha": "abc123def456",
      "date": "2025-01-05T10:30:00Z",
      "author": {
        "login": "githubusername",
        "name": "GitHub User"
      },
      "message": "Full commit message here\n\nWith multiple lines if needed",
      "summary_line": "First line of commit message",
      "is_merge": false
    }
  ],
  "summary_html": "<section><h2>Product Updates</h2><p>We shipped several important features...</p><ul><li>Feature A</li><li>Feature B</li></ul></section>",
  "meta": {
    "commit_count": 15,
    "model": "gpt-4o-realtime-preview-2024-12-17",
    "generated_at": "2025-01-07T14:30:00Z",
    "source": "github_live"
  }
}
```

### Field Requirements

#### `commits` array
- **sha**: Full commit SHA
- **date**: ISO 8601 UTC timestamp of commit
- **author**: Object with optional `login` and `name` fields
- **message**: Full commit message (preserve line breaks)
- **summary_line**: First line of commit message only
- **is_merge**: Boolean (should always be false after filtering)

#### `summary_html`
- **Semantic HTML only** - no inline styles or scripts
- Valid container tags: `<section>`, `<article>`, `<div>`
- Supported elements: `<h1>`, `<h2>`, `<h3>`, `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>`
- Should be human-readable, concise, engineer-facing

#### `meta` object
- **commit_count**: Total number of commits returned
- **model**: OpenAI model identifier used
- **generated_at**: ISO 8601 UTC timestamp of generation
- **source**: Should be "github_live" for live data

## Error Responses

### 400 Bad Request
```json
{
  "message": "Invalid date range. Start date must be before end date."
}
```
Use when:
- Missing `start` or `end` parameters
- Invalid date format
- Start date after end date

### 413 Payload Too Large
```json
{
  "message": "Date range cannot exceed 30 days"
}
```
Use when:
- Date range spans more than 30 days

### 429 Too Many Requests
```json
{
  "message": "Rate limit exceeded. Please try again in 60 seconds."
}
```
Use when:
- GitHub API rate limit hit
- Secondary rate limit triggered

### 502 Bad Gateway
```json
{
  "message": "Backend service temporarily unavailable"
}
```
Use when:
- GitHub API returns unexpected error
- OpenAI API returns error

### 504 Gateway Timeout
```json
{
  "message": "Request exceeded 120 second timeout"
}
```
Use when:
- Total processing time > 120 seconds (GitHub + OpenAI)

## Implementation Checklist

- [ ] Set up GitHub API integration with authentication
- [ ] Implement commit fetching with pagination
- [ ] Filter out merge commits (message starts with "Merge" or has multiple parents)
- [ ] Implement OpenAI integration for generating summaries
- [ ] Return semantic HTML (no inline styles)
- [ ] Handle all error cases appropriately
- [ ] Add CORS headers if serving on different domain
- [ ] Test with various date ranges
- [ ] Verify 30-day limit enforcement
- [ ] Test error scenarios

## Testing the Integration

1. Start your backend server
2. Open `index.html` in a browser
3. Select dates and click "Generate Report"
4. Verify commits appear in the left panel
5. Verify summary renders correctly in the right panel
6. Test error cases (invalid dates, 30+ day range, etc.)

## Optional: Voice Agent Backend

The voice agent UI is implemented but needs backend WebSocket connection. If implementing:

1. Set up WebSocket endpoint for real-time voice
2. Connect to OpenAI Realtime API
3. Handle audio streaming
4. Pass current commit data as context to the agent

See `script.js` lines 599-607 for placeholder functions.

## Environment Variables Needed

```bash
GITHUB_TOKEN=your_github_token
GITHUB_REPO=OWNER/REPO
OPENAI_API_KEY=your_openai_key
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
```

## Notes

- The frontend pre-fills dates: end = today, start = 7 days ago
- Frontend validates 30-day limit client-side but will show error if backend returns 413
- All dates should be in UTC for consistency
- Summary generation should be deterministic and factual (no hallucinations)

## Questions?

If you need clarification on any part of the API contract, check the main README.md or the original project spec.

