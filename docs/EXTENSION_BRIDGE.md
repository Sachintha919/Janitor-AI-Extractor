# Companion Extension Bridge Protocol

**Protocol:** JANITOR_EXTRACTOR_BRIDGE  
**Version:** 1  
**Status:** Web-app receiver implemented; companion extension is delivered separately (v1.0.4).

The web app and the extension content script injected into the Extractor web-app origin communicate with window.postMessage. Messages must use the exact page origin as targetOrigin.

## Envelope

    {
      "channel": "JANITOR_EXTRACTOR_BRIDGE",
      "source": "janitor-extractor-extension",
      "type": "HELLO_ACK",
      "protocolVersion": 1,
      "nonce": "the-current-app-challenge",
      "payload": { "extensionVersion": "1.0.0" }
    }

Every extension-to-app message must echo the most recent nonce received in HELLO. The page ignores messages from another window, another origin, an unknown source, a different protocol version or a stale nonce.

## Handshake and heartbeat

1. The app sends HELLO every 2.5 seconds until it receives HELLO_ACK.
2. The extension answers with HELLO_ACK, echoing nonce and providing payload.extensionVersion and optional payload.capabilities.
3. The app sends PING every 2.5 seconds. The extension answers PONG with the same nonce.
4. If no response is received for 8.5 seconds, the app shows Extension disconnected and disables capture controls.

## App-to-extension commands

| Type | Payload | Meaning |
|---|---|---|
| HELLO | protocolVersion, nonce | Start or refresh handshake |
| PING | sentAt | Heartbeat |
| SET_TARGET_URL | { url } | Character page the user opened from the workspace |
| SET_CAPTURE_ENABLED | { enabled: boolean } | Enable or stop prompt capture |

All app-to-extension envelopes use source janitor-extractor-app.

## Extension-to-app events

| Type | Required payload | Meaning |
|---|---|---|
| HELLO_ACK | extensionVersion | Extension connected |
| PONG | optional sentAt | Heartbeat response |
| CAPTURE_STATE | { enabled: boolean } | Capture on/off state |
| CAPTURED_REQUEST | { id, capturedAt, url, method, request, responseMode } | Captured OpenAI-compatible request body |
| CHARACTER_DATA | { sourceUrl, html? / pageHtml?, character?, assets?, lorebooks?, cardDesign? } | User-authorized page data |
| EXTENSION_ERROR | { message } | Safe, user-readable error |

## Captured request shape

    {
      "id": "capture-unique-id",
      "capturedAt": "2026-11-05T10:00:00.000Z",
      "url": "https://configured-proxy.example/v1/chat/completions",
      "method": "POST",
      "responseMode": "mock",
      "request": {
        "model": "example-model",
        "messages": [
          { "role": "system", "content": "..." },
          { "role": "user", "content": "Hi" }
        ],
        "stream": false
      }
    }

Only the request body is required. The extension may include safe endpoint/method metadata but must not forward Cookie, Authorization, API keys, bearer tokens or other secret headers. URL query parameters should be removed before forwarding.

## Character data shape

character may be a Character Card V2 data object or normalized definitions object. Prefer sending the complete page HTML as html (or pageHtml) so the web app can parse all Janitor accordion panels independently, including Scenario, Personality, Initial Messages, Example Dialogs, Character Book data and visible Lorebook/LoreBary references. If structured character fields are also supplied, the web app merges them without overwriting non-empty page-extracted fields. assets is an array of { id?, url, label, source?, type? }; lorebooks is an array of { name, data }; cardDesign may contain { html, css }.

## Important implementation notes

- Inject page interception code into the Janitor AI page's MAIN world only after the user enables capture and only for the configured custom-proxy chat-completion request.
- A Manifest V3 service worker cannot be treated as a general-purpose blocking proxy for arbitrary request bodies. Validate the current page request path and response mechanism during extension development; a carefully scoped MAIN-world fetch/XHR adapter may be needed.
- For streaming mode, the adapter must return a valid text/event-stream response with OpenAI-compatible chunks and a [DONE] terminator. It must not break Janitor AI's stream parser.
- The extension must send CAPTURE_STATE after applying a setting and after any relevant failure.
- Do not attempt to access hidden server-side definitions, private APIs, cookies or information the signed-in page does not expose.
- The extension's page import and bridge are implemented, but platform DOM changes or pages that omit creator definitions can still limit which fields are available.
