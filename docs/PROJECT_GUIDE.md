# Project guide

## Current architecture

The project contains two separate parts:

- A static HTML/CSS/JavaScript workspace. It can be hosted on GitHub Pages.
- A Node.js HTTP receiver for prompt-request inspection. GitHub Pages cannot host this receiver; run it locally or deploy it separately.

The browser workspace has no database and does not use localStorage. Imported data remains in page memory until refresh/close. The receiver holds only the latest request in process memory and clears it on request or process shutdown.

## Normal extraction workspace

Until the separate Brave extension exists, the normal workflow is manual:

1. Open the character page in the signed-in Brave browser.
2. Import a character-card JSON, copied accessible details, saved HTML, or a local text/JSON/HTML file.
3. Review/edit detected definition fields.
4. Review image and lorebook resources.
5. Paste/import HTML and CSS in the Card Design tab, preview in the sandbox, and export the markup/styles.

The URL button validates and opens a Janitor AI character URL. It does not read the signed-in page. Browser same-origin rules prevent a static page on GitHub Pages from freely reading another site's authenticated page. The extension is the intended future bridge.

Supported common definition keys include name, description, personality, scenario, first_mes, alternate_greetings, mes_example, creator_notes, system_prompt, post_history_instructions, creator, character_version and tags. Character Card V2-shaped JSON is supported; other nested schemas may need manual adjustment.

PNG character-card metadata is parsed from supported embedded text chunks where available. Standalone images can also be imported as assets. Assets are found only in supplied data. HTTP image downloads may be blocked by the remote host's CORS policy. Lorebook/world-info objects are exported as JSON. ZIP export includes image resources that the browser can fetch and all imported lorebook objects.

The HTML preview uses a sandboxed iframe without script execution. HTML and CSS are exported separately. It does not claim to extract private server-side source or live-page computed styles.

## Prompt capture receiver

Requires Node.js 18+. Run:

```bash
npm start
```

Default address: `http://127.0.0.1:8787`

Endpoints:

- `GET /health` — receiver status
- `GET /api/latest` — latest captured request
- `POST /api/clear` — clear the latest request
- `GET /v1/models` — compatible mock model list
- `POST /v1/chat/completions` — capture request and return a mock response
- `POST /chat/completions` — alias for chat completion

The receiver accepts JSON with a `messages` array, stores the latest request in RAM and returns a mock assistant response. When `stream: true`, it returns a small Server-Sent Events stream. No model API is called. It does not persist to disk.

### Janitor AI endpoint setup

Use the custom/OpenAI-compatible API base URL:

```text
http://127.0.0.1:8787/v1
```

Choose `extractor-mock` if a model name is mandatory. A remote Janitor AI service normally cannot reach a computer's loopback address. If so, a secure HTTPS tunnel or separate hosted receiver is required. Configure the same strong bearer token in Janitor AI and the UI's Receiver access key field.

### Environment variables

- `PORT`: listening port, default `8787`.
- `HOST`: default `127.0.0.1`. Public-interface binding is refused unless `API_KEY` is configured.
- `API_KEY`: optional bearer key; required for non-local bind addresses.
- `ALLOWED_ORIGIN`: exact front-end origin, or `*` for local development.

Never commit secrets. Treat captured prompts as sensitive. Do not expose a public unauthenticated receiver.

## Verification

Run:

```bash
npm run check
```

GitHub Actions validates JavaScript syntax and runs a local receiver smoke test on pushes and pull requests.

This checks JavaScript syntax. A real end-to-end Janitor AI test still requires configuring a reachable endpoint in Janitor AI and sending an authorized test message.

## Deferred work

The Brave extension is intentionally not included in this phase. It will later provide authorized inspection of the signed-in page's rendered DOM and accessible assets. It must not bypass creator privacy settings, hidden server-side fields, or access controls.
