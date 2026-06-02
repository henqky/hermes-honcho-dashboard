# Hermes Honcho Dashboard

A dashboard plugin for [Hermes Agent](https://github.com/NousResearch/hermes-agent) that surfaces your [Honcho](https://honcho.dev) AI-native memory — peer cards, semantic search, memory timeline, health stats, and LLM model info — all from within the Hermes dashboard.

## Features

- **Peer Cards** — Browse what Honcho knows about you and your AI peer
- **Semantic Search** — Search Honcho's stored context with relevance scores
- **Memory Timeline** — Scroll through past Honcho sessions
- **Memory Health** — Stats on workspace config, peer facts, sessions, and more
- **LLM Model Card** — See which model Honcho is using (e.g. Gemma-4-31B-it, gemini-embedding-2)

## Install

```bash
hermes plugins install henqky/hermes-honcho-dashboard
```

Then restart the gateway:

```bash
hermes gateway restart
```

The **Memory** tab appears in your Hermes dashboard at `/honcho`.

## Requirements

- Hermes Agent with the [Honcho plugin](https://docs.honcho.dev) enabled
- Honcho running (self-hosted or cloud)
- Hermes dashboard (built-in)

If Honcho is self-hosted via Docker, the plugin auto-discovers model info from the `honcho-deriver-1` container.

## Architecture

```
hermes-honcho-dashboard/
├── plugin.yaml              # Hermes plugin manifest
├── dashboard/
│   ├── manifest.json        # Dashboard tab registration
│   ├── plugin_api.py        # FastAPI backend (6 endpoints)
│   └── dist/
│       ├── index.js         # React IIFE frontend
│       └── style.css        # Claymorphism-compatible styles
└── README.md
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/plugins/honcho-dashboard/profile` | User + AI peer cards |
| `/api/plugins/honcho-dashboard/search?q=...` | Semantic memory search |
| `/api/plugins/honcho-dashboard/sessions` | Recent session list |
| `/api/plugins/honcho-dashboard/health` | Workspace stats |
| `/api/plugins/honcho-dashboard/model` | LLM model configuration |

## License

MIT
