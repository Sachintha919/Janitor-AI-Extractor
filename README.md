<!--
  Animated SVG banner is intentionally kept as a separate asset.
  GitHub README markdown does not execute custom CSS or JavaScript.
-->
<p align="center">
  <img src="assets/images/banner.svg" alt="Janitor AI Extractor — Inspect. Organize. Export." width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-early%20development-9b8cff?style=for-the-badge" alt="Early development">
  <img src="https://img.shields.io/badge/browser-Brave%20%2F%20Chromium-66d9c0?style=for-the-badge" alt="Brave and Chromium">
  <img src="https://img.shields.io/badge/license-MIT-8da2fb?style=for-the-badge" alt="MIT License">
</p>

<p align="center">
  <strong>A clean browser workspace for character-page inspection, asset collection, card-design review and a separate prompt-capture workflow.</strong>
</p>

---

## ✨ Project overview

**Janitor AI Extractor** is a browser-focused project with two intentionally separate workflows:

| Workspace | Purpose |
|---|---|
| **Normal extraction** | Open a character page through the user's signed-in Brave browser session and inspect information the page/session makes available. |
| **Prompt capture** | A separate, manually triggered workflow that inspects requests sent to an endpoint configured by the user, for characters and content they own or are authorized to inspect. |

The project is designed around temporary capture and user-initiated downloads. A permanent character database is not part of the current plan.

## 🧭 Planned features

### 1. Normal extraction

Paste a character URL and use the Brave extension to open/inspect the page in the existing signed-in browser session.

- Character name and description
- Personality and scenario **when made available to the signed-in page/session**
- First message and alternate greetings
- Example dialogues and other accessible definition fields
- Field-level source and availability indicators

### 2. Assets

- Character avatar and accessible gallery images
- Lorebooks and entries available to the signed-in user
- Other accessible character-related files
- Individual downloads and a download-all archive

### 3. Card design

- Rendered character-card HTML structure
- Browser-accessible CSS and computed styles
- HTML/CSS preview
- Separate HTML and CSS exports

> The browser can inspect rendered DOM and styles available to the page. It cannot guarantee access to private server-side source files or resources the account/page does not expose.

### 4. Prompt capture — separate workflow

The user configures their own compatible endpoint in Janitor AI, opens an authorized test chat and manually sends a message. The local receiver can inspect the request that Janitor AI actually sends to that endpoint.

- Incoming-request status and request inspection
- Display relevant prompt sections in the web interface
- TXT and JSON download actions
- Optional response forwarding can be considered separately

**Important limits:** the receiver can inspect only content actually sent to it. A hidden-field marker or token count is not the hidden text itself. This workflow is for the user's own characters or content they have permission to inspect; it is not intended to bypass creator privacy choices or access controls.

## 📦 Export formats

| Data | Planned format |
|---|---|
| Definitions | TXT, JSON |
| Captured request | TXT, JSON |
| Character images | Original image files |
| Card design | HTML, CSS |
| Multiple assets | ZIP archive |
| Normalized character card | Character Card JSON format (format compatibility to be implemented and tested) |

## 🔒 Data handling

- No permanent character database planned.
- Keep captured data in temporary browser/server memory only.
- Downloads are initiated by the user.
- Do not store account passwords, session cookies, authorization headers, API keys or unrelated private chat history.
- Clear temporary capture data when the session is cleared or the local receiver stops.

## 🧪 Run the local prompt receiver

GitHub Pages can host the static interface, but it cannot receive API requests. The prompt receiver is a separate Node.js process. Install Node.js 18 or newer, then run:

```bash
npm start
```

The receiver listens on `http://127.0.0.1:8787`. Open the Prompt Capture tab and choose **Check connection**. If the chat client runs remotely, localhost will not be reachable from it; you need a secure HTTPS tunnel or a hosted receiver. Never expose the receiver publicly without setting an `API_KEY` environment variable and configuring the same bearer key in the client where supported. The receiver returns a mock reply, does not call an AI provider, and keeps only the latest request in memory.

## 🚧 Development status

This repository is an **early UI prototype**. The checklist below is intentionally honest about what is and is not implemented yet.

| Component | Status |
|---|---|
| Responsive dark interface | ✅ Implemented |
| Animated CSS effects | ✅ Implemented |
| Normal / Prompt Capture navigation | ✅ Implemented |
| Definitions / Assets / Card Design tabs | ✅ Implemented |
| Character URL validation and open-in-new-tab | ✅ Implemented |
| Manual JSON / HTML / text / file import | ✅ Implemented |
| Definition editing and TXT / JSON / Character Card JSON export | ✅ Implemented |
| Asset URL and lorebook discovery from imported data | ✅ Implemented |
| Individual asset and lorebook downloads | ✅ Implemented |
| HTML / CSS preview and export | ✅ Implemented |
| Local OpenAI-compatible mock request receiver | ✅ Implemented |
| Live request polling and TXT / JSON export | ✅ Implemented |
| ZIP export for downloadable assets and lorebooks | ✅ Implemented |
| Browser extension and signed-in page connector | ⏳ Planned |
| Automatic visible-field extraction | ⏳ Planned |
| Asset and lorebook extraction | ⏳ Planned |
| Rendered HTML/CSS inspection | ⏳ Planned |
| Automatic extraction from signed-in character page | ⏳ Brave extension later |
| GitHub Pages deployment verification | ⏳ Pending |

A visible button or preview in the current UI may be disabled until its underlying connector is implemented.

## 🛠️ Technology

- HTML5
- CSS3 (responsive layout, motion and reduced-motion support)
- Vanilla JavaScript
- Brave / Chromium extension APIs (planned)
- Node.js local request receiver (planned)
- GitHub Pages for the static interface

No external AI provider API key is required for the planned request-inspection prototype. A separate provider credential would only be needed if optional real-model forwarding is added later.

## 🚀 Run the current UI locally

Clone the repository:

```bash
git clone https://github.com/Sachintha919/Janitor-AI-Extractor.git
cd Janitor-AI-Extractor
```

Start a simple static server:

```bash
python -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000
```

You can also open `index.html` directly, but using a local HTTP server is closer to the eventual deployment environment.

## 🗂️ Current repository structure

```text
Janitor-AI-Extractor/
├── .github/
│   └── workflows/
│       └── pages.yml
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── images/
│   │   └── banner.svg
│   └── js/
│       └── app.js
├── docs/
│   └── PROJECT_GUIDE.md
├── .nojekyll
├── index.html
└── LICENSE
```

## 🧩 Roadmap

1. Finish and verify the static interface.
2. Build the Brave extension connector for normal page inspection.
3. Add temporary capture state and download helpers.
4. Build the local compatible endpoint for the separate prompt-capture workflow.
5. Add parsing, live status and request display.
6. Test asset and card-design exports.
7. Verify GitHub Pages deployment.

## ⚖️ Responsible use

Use this project only with content you own or have permission to inspect and download. Respect creator settings, platform rules, copyright and access restrictions. The project should report unavailable fields honestly rather than attempting to defeat protections.

## 📄 License

This project is distributed under the MIT License. See [LICENSE](LICENSE).
