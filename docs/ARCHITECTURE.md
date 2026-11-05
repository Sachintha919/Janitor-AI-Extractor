# Architecture

## Deployment model

The repository contains a static browser application. GitHub Pages serves index.html, styles and ES modules. There is no application server, local Fake API server, database or runtime dependency.

Character data and prompt captures live in the current page's JavaScript memory. The user explicitly downloads any data they want to keep.

## Application modules

- core/extension-bridge.js: handshake, heartbeat, message validation and commands to the separate companion extension.
- importers/character-importer.js: Character Card JSON, labelled text, HTML metadata, nested asset discovery and PNG metadata parsing.
- utils/download.js: safe filenames, browser downloads and a small dependency-free ZIP writer.
- app.js: UI orchestration, definition editing, assets, prompt capture and temporary session state.

## Future extension responsibilities

The companion extension is not part of this repository. It will have two browser contexts:

1. A Janitor AI page content script that detects the user's configured custom-proxy request and, when capture is enabled, supplies a local mock completion response without contacting the configured provider.
2. A content script on the Extractor web-app origin that connects to the page bridge and forwards captured request/character data to the open workspace tab.

The exact interception method must be verified against Janitor AI's current fetch/XHR implementation and the target Brave/Chromium version. The extension must not bypass access controls or attempt to read server-only data.

## Data flow

    Janitor AI tab
      -> companion extension observes the configured chat request
      -> request body is normalized and secret headers are discarded
      -> extension returns a mock OpenAI-compatible completion
      -> extension forwards the capture to the Extractor tab
      -> web app displays the capture and offers user-triggered exports

## Security boundaries

- The page bridge accepts messages only from the same window and same origin, with the expected channel, protocol version and current handshake nonce.
- The extension must echo the handshake nonce and must independently validate messages before forwarding them.
- Never include cookies, authorization values, API keys, bearer tokens or other secret headers in the bridge payload.
- Request message content is escaped before display.
- Character-card previews run in a sandboxed iframe without script permission.
- Data is held in memory and is cleared when the page is refreshed or closed.
