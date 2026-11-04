<!-- Animated SVG banner: GitHub README does not execute custom CSS or JavaScript. -->
<p align="center"><img src="assets/images/banner.svg" alt="Janitor AI Extractor — Inspect. Organize. Export." width="100%"></p>

<p align="center">
  <img src="https://img.shields.io/badge/status-functional%20prototype-9b8cff?style=for-the-badge" alt="Functional prototype">
  <img src="https://img.shields.io/badge/browser-Brave%20%2F%20Chromium-66d9c0?style=for-the-badge" alt="Brave and Chromium">
  <img src="https://img.shields.io/badge/license-MIT-8da2fb?style=for-the-badge" alt="MIT License">
</p>

<p align="center"><strong>A temporary browser workspace for organizing accessible character data, assets, card markup and API requests.</strong></p>

---

## ✨ What this project does

Janitor AI Extractor has two separate workflows:

1. **Normal extraction workspace** — import character data that you can access, review and edit its fields, inspect imported assets/lorebooks, and export files.
2. **Prompt capture workspace** — point Janitor AI to your own compatible receiver, send a test message, and inspect the request that the service actually sends.

A permanent character database is not used. Imported data stays in the active browser tab; prompt requests stay in the receiver process memory until cleared or the process stops.

## 🧩 Features in the current build

### Definitions
- Import Character Card JSON (including common V2-style `data` objects), PNG character-card images with embedded `chara` / `ccv3` metadata, JSON, HTML, text, CSS, or local image files.
- Detect common fields: name, description, personality, scenario, first message, alternate greetings, example dialogue, creator notes, system prompt, post-history instructions, creator, version and tags.
- Edit detected fields before exporting.
- Export as TXT, normalized JSON, or a Character Card V2-shaped JSON file.

### Assets
- Find image URLs and embedded base64 image data in imported JSON/HTML; import standalone images and extract embedded character-card metadata from supported PNG cards.
- Preview and download individual images when the browser/image host permits it.
- Detect lorebook / world-info objects and export them as JSON.
- Create a ZIP archive containing imported lorebook JSON and image files that permit browser fetching.

**Browser limitation:** some image hosts block cross-origin downloads. Those files may need to be opened at their original URL and saved manually. This importer does not crawl private APIs or hidden resources.

### Character card design
- Import/paste HTML and CSS separately, or parse a supplied HTML document.
- Preview HTML in a sandboxed iframe (scripts are not executed).
- Edit and export HTML and CSS separately.

The workspace can inspect only the markup and styles supplied to it. Automatic inspection of the signed-in Janitor AI page, its rendered DOM, and computed CSS requires the future Brave extension and is intentionally not included yet.

### Prompt capture
The included Node.js receiver accepts OpenAI-compatible chat-completion requests at:
- `POST /v1/chat/completions`
- `POST /chat/completions`

It stores the latest request in process memory and returns a mock completion. Streaming requests (`stream: true`) receive a compatible Server-Sent Events response. The receiver also provides:
- `GET /health`
- `GET /api/latest`
- `POST /api/clear`
- `GET /v1/models`

The Prompt Capture tab can connect, poll for new requests, display message roles/content and selected request metadata, and export the captured request as TXT or JSON. The manual request-import box works without running the receiver.

**Important:** the capture tab can display only the request content that Janitor AI actually transmits to the endpoint. It cannot reveal data omitted from the request or bypass creator privacy settings, authentication, or platform access controls. Use only your own characters or content you have permission to inspect.

## 🚀 Run locally

Requires Node.js 18 or newer.

```bash
git clone https://github.com/Sachintha919/Janitor-AI-Extractor.git
cd Janitor-AI-Extractor
npm start
```

Open the static interface with a local web server in a second terminal:

```bash
python -m http.server 8000
```

Then visit `http://127.0.0.1:8000`. Open the **Prompt Capture** tab and connect to `http://127.0.0.1:8787`.

Run the syntax check:

```bash
npm run check
```

GitHub Actions also runs JavaScript syntax checks and a local receiver smoke test on pushes and pull requests.

### Configure Janitor AI

In the Janitor AI API settings, choose a compatible/custom OpenAI-style endpoint and set its base URL to:

```text
http://127.0.0.1:8787/v1
```

Use model name `extractor-mock` if a model name is required. The receiver returns a mock response and does not contact an AI provider. Send a test message, then return to Prompt Capture to inspect the request.

A remote Janitor AI service generally cannot connect to your computer's `127.0.0.1`. If localhost is not reachable from Janitor AI, a secure HTTPS tunnel or hosted receiver is needed. Do not expose a receiver publicly without configuring a strong `API_KEY`.

### Optional receiver security settings

- `API_KEY`: bearer token required by the receiver. Use the same value in Janitor AI and the Prompt Capture access-key field.
- `HOST`: defaults to `127.0.0.1`. Binding to a public interface is refused unless `API_KEY` is set.
- `PORT`: defaults to `8787`.
- `ALLOWED_ORIGIN`: defaults to `*` for simple local use. For a hosted deployment, set it to the exact origin of your interface.

Example:

```bash
API_KEY="replace-with-a-long-random-secret" HOST="0.0.0.0" PORT=8787 ALLOWED_ORIGIN="https://your-site.example" npm start
```

Do not commit real keys to GitHub. Do not paste an API key into screenshots or public issue reports. The receiver does not save requests to disk, but captured prompt content can be sensitive while the process is running.

## 🔒 Data handling and limitations

- No database, account login, browser-cookie collection, or permanent character storage.
- The static interface does not request Janitor AI passwords or session cookies.
- The receiver stores only the latest JSON request in RAM; it clears on `/api/clear` or process shutdown.
- The receiver does not store request headers or forward prompts to a model provider.
- Downloads are initiated by the user.
- The current normal workflow is manual import. URL validation opens the character page but does not read the signed-in page.
- Automatic signed-in page reading, asset extraction from the live page, and live card DOM/CSS inspection are deferred until the separate Brave extension is built.

## 📌 Development status

| Feature | Current status |
|---|---|
| Animated responsive interface and navigation | Implemented |
| Manual JSON / HTML / text / file import | Implemented |
| Common character definition parsing and editing | Implemented; format coverage varies |
| TXT, JSON and Character Card V2-shaped export | Implemented |
| Image URL / embedded image discovery | Implemented for imported sources |
| Individual image and lorebook downloads | Implemented; cross-origin restrictions apply |
| ZIP export | Implemented for assets the browser can fetch |
| Sandboxed HTML preview and HTML/CSS export | Implemented for supplied source |
| Local OpenAI-compatible receiver | Implemented; mock response only |
| Streaming mock response | Implemented |
| Live polling and captured request TXT/JSON export | Implemented |
| Automatic signed-in Janitor AI page inspection | Deferred: Brave extension |
| Automatic live-page assets and card DOM/CSS inspection | Deferred: Brave extension |
| Hosted receiver deployment and end-to-end Janitor AI verification | Not yet verified |
| GitHub Pages deployment | Workflow configured; deployment must be checked in Actions |

## 🛠️ Technology

- HTML5, CSS3 and vanilla JavaScript
- Node.js built-in HTTP module (no npm runtime dependencies)
- GitHub Pages workflow for the static front end
- Brave / Chromium extension planned as a separate future component

## 🗂️ Repository layout

```text
Janitor-AI-Extractor/
├── .github/workflows/\n│   ├── pages.yml\n│   └── validate.yml
├── assets/
│   ├── css/styles.css
│   ├── images/banner.svg
│   └── js/app.js
├── docs/PROJECT_GUIDE.md
├── index.html
├── package.json
├── server.js
├── .nojekyll
├── LICENSE
└── README.md
```

## ⚖️ Responsible use

Use this project only with content you own or have permission to inspect and download. Respect creator choices, platform terms, copyright, and access restrictions. If a field is not made available to the page or request, the application should report it as unavailable rather than attempting to defeat a protection.

## 📄 License

MIT — see [LICENSE](LICENSE).
