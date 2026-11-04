# Project guide

## What this project is

Janitor AI Extractor is a browser-focused workspace with two separate workflows:

1. **Normal extraction** — open a Janitor AI character page in the user's already signed-in Brave browser and inspect information that the page/session makes available.
2. **Prompt capture** — a separate, manually triggered workflow for inspecting requests sent to an endpoint configured by the user, for characters and prompt content the user owns or is authorized to inspect.

The first version is a static UI. The browser connector and local compatible API receiver are not implemented yet.

## Normal extraction sections

- **Definitions:** character name, description, personality, scenario, first message, alternate greetings, example dialogue and other fields that are actually available to the signed-in user.
- **Assets:** character images, available lorebooks and other accessible files.
- **Card design:** rendered card HTML and browser-accessible CSS/style information.

Do not attempt to bypass character visibility controls, access controls, or creator privacy choices. If a field is not provided to the signed-in page/session, mark it unavailable rather than trying to retrieve it through an unauthorized route.

## Prompt capture workflow

The user configures their own OpenAI-compatible endpoint in Janitor AI, opens an authorized test chat, and manually sends a message. The local receiver can then inspect the request that Janitor AI actually sends to that endpoint.

Important limits:
- The receiver can inspect only the content actually sent to it.
- A token count or hidden-field marker is not the hidden text itself.
- The receiver must not try to defeat access controls or extract private creator definitions without permission.
- Capture only the relevant authorized character context. Do not retain account cookies, passwords, API keys, or unrelated private chat history.
- The first receiver mode should return a clearly labelled mock response; real model forwarding is a later optional feature.

## Data handling

- No permanent character database is planned.
- Keep captures in short-lived in-memory/session state only.
- Export is user-initiated (TXT / JSON; HTML / CSS and asset ZIP where available).
- Clear temporary data when the user clears the session or closes the workspace.

## Development stages

1. Static responsive interface (current stage).
2. Brave extension connector for normal page inspection.
3. In-memory download/export helpers.
4. Local OpenAI-compatible request receiver for the separate prompt-capture workflow.
5. Request parser and live status updates.
6. Optional static-site deployment through GitHub Pages.

## Local preview

Open `index.html` in a browser, or run a simple static server from the repository root:

```bash
python -m http.server 8000
```

Then visit `http://127.0.0.1:8000`.

The URL form currently validates and opens a Janitor AI character page. It does not yet extract page data; that needs the Brave extension connector.
