# Quest Dashboard

A personal RPG-styled task dashboard. Reads tasks from an Obsidian kanban file, presents them as cyberpunk-HUD-styled quests with XP scoring + daily/weekly progress bars. Supports bidirectional sync (marking a quest complete in the dashboard writes back to the kanban).

See [`docs/`](docs/) for full design (PRD, spec, architecture, user stories, implementation plan).

## Quick start

```bash
# 1. Install
nvm use            # Node 20+
npm install

# 2. Configure
mkdir -p config data
cp config/sources.example.json config/sources.json
cp config/targets.example.json config/targets.json
# Edit config/sources.json to point to your kanban file

# 3. Run (dev mode)
npm run dev
# Open http://localhost:5173

# OR production mode (single port, no Vite dev server)
npm run build
npm start
# Open http://localhost:3000
```

## Features (v1)

- Reads tasks from an Obsidian kanban-plugin board
- Quests categorized (Daily, Job Hunt, Personal Dev, Codaic, Venera, Side Quests)
- Auto XP scoring + `#xpN` tag override
- Cyberpunk HUD UI with daily/weekly progress bars
- Bidirectional sync: "Mark Complete" writes back to the kanban
- 60s background polling + manual refresh
- Show/hide completed toggle
- First-run backfill from existing `✅ YYYY-MM-DD` markers

## Config files

| File | Purpose |
|---|---|
| `config/sources.json` | Adapter activation + per-source config (kanban file path, vault) |
| `config/targets.json` | Daily/weekly XP goals |
| `config/categoryMap.json` (optional) | Override default category mapping rules |
| `data/xp-history.jsonl` | Append-only completion log — auto-managed |

## Testing

```bash
npm test                  # all workspaces
npm test --workspace=server
npm test --workspace=client
```

## Roadmap

- **v1** ✓ Obsidian-only MVP
- **v2** Google Tasks integration + live file watching
- **v3** Google Calendar (events as timeboxed quests)

See [`docs/PRD.md`](docs/PRD.md) for full roadmap detail.
