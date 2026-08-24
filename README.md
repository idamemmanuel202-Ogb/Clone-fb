# PLUTO

PLUTO is a polished, static AI workspace that runs directly in a browser. It has no build step and no server-side dependency.

## Files

- `index.html` — app shell
- `styles.css` — responsive dark/light UI
- `app.js` — local state, chat UI, exports, attachments, prompt lab, voice tools, and provider adapters
- `PLUTO.html` — single-file bundle you can save and open anywhere

## Run it

Open `PLUTO.html` directly, or serve the folder:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Connecting a live model

PLUTO starts in **no-key Demo mode**, so it works offline and does not pretend to have a model behind it. To connect a real model, open **Settings → Connection** and choose one of:

- OpenRouter — includes a few free-model presets; availability and limits are controlled by OpenRouter.
- Hugging Face — enter your own inference token.
- Ollama — enter the URL of an Ollama server you control.
- Custom — any CORS-enabled OpenAI-compatible `/chat/completions` endpoint.

The browser stores the key locally and sends it only to the provider you select. For anything beyond personal local use, put credentials behind a server-side proxy rather than shipping them in a browser app. PLUTO does not generate, guess, or share random API keys.

## Built-in features

- Conversation history persisted in browser storage
- Demo chat with no API key
- OpenRouter, Hugging Face, Ollama, and custom OpenAI-compatible adapters
- Model picker, endpoint/key settings, privacy controls, and theme switcher
- File drag-and-drop / attachment context for text and code files
- Library metadata view
- Prompt lab with saved reusable prompts
- HTML, Markdown, TXT, and JSON conversation downloads
- Full workspace JSON backup with API key redacted
- Search, command palette, regenerate, edit-to-composer, copy, read aloud, and voice input
- Web/Think toggles ready to be honored by a connected backend

Free and uncensored model availability is not something a static client can guarantee: each provider and model applies its own policies, limits, and moderation. This UI leaves those decisions with the selected provider instead of bypassing them.
