# Layercode Product Release Reports - Frontend

A modern, responsive web application for viewing and exploring product release reports with voice agent capabilities.

## Features

- **Date Range Picker**: Select any date range (up to 30 days) to view releases
- **Commit List**: Browse detailed commit information with author avatars
- **AI-Generated Summary**: Read plain-English summaries of what was shipped
- **Voice Agent**: Interact with release data through voice commands (backend integration required)
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## File Structure

```
.
├── index.html      # Main HTML structure
├── styles.css      # All styling and responsive design
├── script.js       # JavaScript logic and API integration
└── README.md       # This file
```

## Setup

1. Ensure you have the backend API running with the `/deploy-report` endpoint
2. Open `index.html` in a modern web browser
3. For production, serve via a web server (e.g., `python -m http.server` or `npx serve`)

## Usage

### Generating a Report

1. Select your desired start and end dates using the date pickers
2. Click "Generate Report" to fetch data from the backend
3. View the commit list and AI-generated summary side-by-side

### Using the Voice Agent

1. Click the microphone FAB (floating action button) in the bottom-right corner
2. Grant microphone permissions when prompted
3. Either click example prompts or use the microphone to ask questions
4. View transcripts and responses in the conversation panel

## Backend API Integration

The frontend expects a backend API at `/deploy-report` with the following contract:

### Endpoint: `GET /deploy-report?start=YYYY-MM-DD&end=YYYY-MM-DD`

**Expected Response (200):**
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

**Error Responses:**
- `400` - Missing/invalid dates
- `413` - Date range exceeds 30 days
- `429` - Rate limit exceeded
- `502` - Backend service error
- `504` - Request timeout

## Configuration

Edit the `API_BASE_URL` constant in `script.js` to point to your backend:

```javascript
const API_BASE_URL = '/deploy-report'; // Change to your backend URL
```

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Voice Agent Notes

The voice agent UI is fully implemented with placeholder functions for backend integration. To complete the voice functionality, you'll need to:

1. Implement WebSocket connection to OpenAI Realtime API
2. Add audio capture and processing
3. Handle streaming responses from the voice agent
4. Add proper error handling for audio/microphone issues

See `script.js` for placeholder functions marked with `// TODO:` comments.

## Accessibility

The UI includes:
- Keyboard navigation support
- ARIA labels on interactive elements
- High contrast mode support
- Screen reader compatible structure
- Reduced motion support

## Performance

- Initial load: < 2 seconds
- Smooth 60fps animations
- Optimized rendering for large commit lists
- Lazy loading for conversation history

## License

Internal project - All rights reserved

