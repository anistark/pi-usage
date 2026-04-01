# pi-usage

Multi-provider AI usage monitor — Claude, OpenAI, OpenRouter, and more — from one TUI dashboard.

Works standalone or as a [pi](https://github.com/badlogic/pi-mono) extension.

![v0.1.0](https://img.shields.io/badge/version-0.1.0-blue)

## Features

- **Claude quota tracking** — 5-hour and 7-day rolling windows with donut charts
- **Per-model breakdown** — see which models are consuming your quota
- **Auto-refresh** — configurable polling with rate-limit backoff
- **Pi extension** — `/pi-usage` command and `pi_usage` LLM tool
- **Standalone CLI** — runs outside pi with `npx pi-usage`

## Install

### As a pi extension

```sh
pi install npm:pi-usage
# or
pi install github:anistark/pi-usage
```

### Standalone

```sh
npm install -g pi-usage
# or
npx pi-usage
```

## Setup

Authenticate with Claude (required for v0.1.0):

```sh
pi-usage setup
```

This uses OAuth to connect to your Anthropic account. If you already have Claude Code credentials (macOS Keychain or `~/.claude/.credentials.json`), they'll be detected automatically — no setup needed.

To force re-authentication:

```sh
pi-usage setup --re
```

## Usage

### Standalone TUI

```sh
pi-usage
```

Launches a full-screen dashboard with:
- Donut charts for 5-hour and 7-day quota windows
- Per-model usage breakdown
- Auto-refresh with configurable interval

**Keybindings:**

| Key | Action |
|-----|--------|
| `q` | Quit |
| `r` | Force refresh |
| `?` | Toggle help |
| `Tab` | Switch provider |

### Pi extension

Inside a pi session:

```
/pi-usage              Show usage summary for all configured providers
/pi-usage claude       Show Claude usage specifically
```

The LLM can also call the `pi_usage` tool when you ask about your quota or usage.

## Configuration

Config lives at `~/.config/pi-usage/config.toml`:

```toml
refresh_interval = 30       # seconds between auto-refresh
default_provider = "claude"
enabled_providers = ["claude"]
```

## Auth Strategy

| Provider | Source | Method |
|----------|--------|--------|
| Claude | macOS Keychain → `~/.claude/.credentials.json` → own OAuth token | OAuth |
| OpenAI | `OPENAI_API_KEY` env var (v0.2+) | API key |
| OpenRouter | `OPENROUTER_API_KEY` env var (v0.3+) | API key |

When running as a pi extension, provider API keys are resolved from pi's model registry first.

## Development

```sh
pnpm install
just build       # compile TypeScript
just dev         # watch mode
just run         # build + launch TUI
just lint        # type check
just qa          # lint + build
```

## License

MIT
