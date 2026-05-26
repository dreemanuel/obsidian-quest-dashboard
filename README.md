# Quest Dashboard

An RPG-styled task dashboard for your Obsidian kanban. Reads tasks from a kanban-plugin board, presents them as cyberpunk-HUD-styled "quests" with XP scoring + daily/weekly progress bars. Supports **bidirectional sync** — marking a quest complete in the dashboard writes back to the kanban file in your vault.

See [`docs/`](docs/) for full design (PRD, spec, architecture, user stories, implementation plan).

<!-- Add a screenshot here once you have one you like -->

## What it looks like

- A cyberpunk-HUD header with daily / weekly XP progress bars and a streak counter
- Each kanban lane mapped to a quest category (Job Hunt, Personal Dev, custom DEV lanes, Side Quests, etc.)
- Each top-level task → a "quest card" with title, XP badge, flag icons (🔥 ⭐ 🔺), and a mini progress bar for subtasks ("objectives")
- Click a card → modal with the full subtask list. Click subtasks to tick them off; when all subtasks are done, the parent auto-completes and fires its XP

## Quick start

Requires Node 20+ and an Obsidian vault containing a [kanban-plugin](https://github.com/mgmeyers/obsidian-kanban) board file.

```bash
# 1. Install
nvm use            # Node 20+
npm install

# 2. Configure
mkdir -p config data
cp config/sources.example.json config/sources.json
cp config/targets.example.json config/targets.json
```

Then edit `config/sources.json` to point at YOUR kanban file:

```json
{
  "sources": [
    {
      "id": "obsidian",
      "adapter": "ObsidianAdapter",
      "config": {
        "file": "/absolute/path/to/your/Obsidian-Vault/Tasks/your-board.md",
        "vault": "YourVaultName"
      },
      "pollIntervalSec": 60
    }
  ]
}
```

The `file` is the absolute path to your kanban markdown. The `vault` is the Obsidian vault name (used for `obsidian://` deep links so the "Open in Obsidian" button works).

**Back up your kanban file before the first run.** The dashboard's "Mark Complete" action writes back to it. Make a copy:

```bash
cp "/absolute/path/to/your/Obsidian-Vault/Tasks/your-board.md" \
   "/absolute/path/to/your/Obsidian-Vault/Tasks/your-board.md.bak.pre-qd-$(date +%Y%m%d)"
```

```bash
# 3. Run (dev mode — both server + client with hot reload)
npm run dev
# Open http://localhost:5274

# OR production mode (single port; serve built client from backend)
npm run build
npm start
# Open http://localhost:3274
```

## Adapting the lane → XP / category rules to your kanban

The defaults assume a kanban with lanes like `TO DO - TODAY !`, several `... JOB SEARCH ...` lanes, `DEV - PERSONAL`, other `DEV - *` project lanes, `TO DO - BACKBURNER`, `DONE - REVIEW`, and `Archive`. They map as follows:

| Lane pattern | Base XP | Category |
|---|---|---|
| `TO DO - TODAY !` | 30 | Daily Quests (featured) |
| Any lane matching `/JOB SEARCH/i` | 25 | Job Hunt |
| `DEV - PERSONAL` | 15 | Personal Dev |
| Any other `DEV - *` lane | 20 | (suffix becomes category name) |
| `TO DO - BACKBURNER` | 5 | Side Quests (rendered dimmer) |
| `DONE - REVIEW`, `Archive` | hidden | hidden |
| anything else | 10 | (lane name as-is) |

**If your kanban uses different lane names**, edit the rules in:
- `server/core/scoring.js` (`BASE_XP_RULES`) — controls XP per lane
- `server/core/categoryMap.js` (`DEFAULT_RULES`) — controls category mapping

Each is a small ordered list of `{ test, ... }` entries. First match wins.

### XP modifiers (apply to any lane)

| Trigger in task title | XP modifier |
|---|---|
| Contains 🔥 | +10 |
| Contains ⭐ | +5 |
| Contains 🔺 | +10 |
| Contains `URGENT` or `TODAY` (case-insensitive) | +5 |

### Override XP per task

Add `#xp25` (or any number) to a task title in Obsidian — the dashboard will use that exact value as the quest's XP, ignoring the auto rules. The tag is stripped from the displayed title.

## Features (v1 + v1.1)

- Reads tasks + nested subtasks from an Obsidian kanban-plugin board
- Auto XP scoring + `#xpN` tag override
- Cyberpunk HUD UI with daily/weekly progress bars (fixed goal for the first 7 days, then rolling 7-day average)
- Bidirectional sync: "Mark Complete" rewrites the kanban file (with the `✅ YYYY-MM-DD` marker that the kanban plugin understands)
- Subtask interaction: click subtasks to tick them; the last subtask completion auto-completes the parent quest + awards its XP
- Show/hide completed toggle (persisted)
- Streak counter (consecutive days with XP earned)
- 60s background polling + manual refresh button
- First-run backfill from existing `✅` markers so historical progress counts

## Config files

| File | Purpose |
|---|---|
| `config/sources.json` | Adapter activation + per-source config (kanban file path, vault) |
| `config/targets.json` | Daily/weekly XP goals (defaults: 50 / 250) |
| `data/xp-history.jsonl` | Append-only completion log — auto-managed |
| `data/.backfilled-obsidian` | First-run backfill marker — delete to re-run backfill |

`config/` and `data/` are git-ignored. They hold your personal state.

## Testing

```bash
npm test                    # all workspaces (server + client)
npm test --workspace=server
npm test --workspace=client
```

## Architecture in one paragraph

A small Node + Express backend exposes a JSON API. The frontend is a Vite + React + Tailwind SPA. The backend reads from a pluggable `SyncAdapter` (only `ObsidianAdapter` ships in v1; the abstraction is in place for future Google Tasks / Google Calendar adapters). Quest data flows: adapter → `aggregator` (scoring + category mapping + completion-diff detection) → `xp-history.jsonl` for history events → routes → frontend. Writes flow the same path in reverse: frontend → route → adapter → file. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture.

## Roadmap

- **v1** ✓ Obsidian-only MVP — shipped
- **v1.1** ✓ Interactive subtasks + parent auto-completion — shipped
- **v2** Google Tasks integration + live file watching (chokidar + WebSocket push, replacing 60s polling)
- **v3** Google Calendar (events as timeboxed quests)

See [`docs/PRD.md`](docs/PRD.md) for full roadmap detail.

## License

MIT — see [LICENSE](LICENSE).
