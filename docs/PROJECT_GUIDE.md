# Project guide

## Current architecture

This project has a static browser interface and an optional Node.js request receiver.

- The static interface can be deployed to GitHub Pages.
- Manual import supports character-card JSON, copied definition text, HTML, and local JSON/text/HTML files.
- Parsed definitions can be edited in the browser and exported as TXT, JSON, or Character Card V2-shaped JSON.
- Imported asset links and lorebook objects can be reviewed and downloaded. Asset ZIP export includes resources the browser can fetch; cross-origin restrictions may prevent some images from being bundled.
- Card HTML and CSS can be pasted/imported, previewed in a sandboxed iframe, and downloaded separately.
- The Node receiver accepts OpenAI-compatible chat-completion POST requests, stores only the latest request in process memory, and returns a mock assistant response.

## Normal extraction

The URL action only validates and opens a Janitor AI character page. It does not read the signed-in page. Until the separate Brave extension is developed, use the manual import panel and provide content that the signed-in user is authorized to access.

The parser does not bypass page visibility controls, creator privacy settings, authentication, or server-side access controls. Fields that are not present in the supplied source remain unavailable.

## Prompt capture

Run the receiver with Node.js 18+:

```bash
npm start
```

Default local endpoint: `http://127.0.0.1:8787`

Endpoints:
- `GET /health` — receiver health
- `GET /api/latest` — latest captured request
- `POST /api/clear` — clear latest capture
- `POST /v1/chat/completions` — receive a compatible request and return a mock completion

The receiver does not call an AI provider and does not save request data to disk. It clears its memory when the process stops. It binds to localhost by default.

For a remote chat service to reach a local receiver, a secure tunnel or hosted service is required. Do not expose the receiver publicly without setting `API_KEY` and configuring the same bearer key in the client where supported. A public tunnel can expose sensitive prompt content; use only with content you are authorized to inspect.

## Data handling

No character database or browser localStorage is used. Parsed data stays in page memory until the page is refreshed or closed. Prompt capture is held in receiver memory until cleared or the receiver stops. Downloads are user-initiated.

## Development stages

1. Static responsive interface — implemented.
2. Manual source import, parser, editor and exports — implemented.
3. Local temporary compatible request receiver — implemented.
4. Automated signed-in page inspection via Brave extension — intentionally deferred.
5. More robust format compatibility and end-to-end testing — ongoing.
