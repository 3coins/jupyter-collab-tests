# jupyter-collab-tests

Two test suites for JupyterLab, both using **Galata** (Playwright):

1. **Collaboration tests** — Toxiproxy network fault injection with two browser clients
2. **Chat session tests** — AI agent `@mention` interactions, yroom drain/recovery,
   multi-agent conversations (Kiro, Claude, Codex)

No Docker — all processes are spawned and torn down by the test runner itself.

## Prerequisites

- `toxiproxy-server` on your PATH (collab tests only) — download from https://github.com/Shopify/toxiproxy/releases
- `jupyter-ai-devrepo` cloned as a sibling directory with `uv sync` done (chat tests only)
- Python 3.11+
- Node.js 18+

## Quick Commands

```bash
# One-time JS setup (from project root)
npm install
npx playwright install chromium

# ── Collab tests ──────────────────────────────────────────────────────────────
# One-time Python setup
cd server && uv sync && cd ..

# Run all collab tests (starts Toxiproxy + JupyterLab automatically)
npx playwright test

# Run a specific collab spec
npx playwright test tests/specs/collab-latency.spec.ts

# ── Chat tests ────────────────────────────────────────────────────────────────
# Run all chat tests (starts JupyterLab from devrepo automatically)
npx playwright test --config=playwright.chat.config.ts

# Run a specific chat spec
npx playwright test --config=playwright.chat.config.ts tests/specs/chat-agent-mention.spec.ts

# Override devrepo path
DEVREPO_DIR=/path/to/jupyter-ai-devrepo npx playwright test --config=playwright.chat.config.ts

# ── Common ────────────────────────────────────────────────────────────────────
# Run with visible browser (useful for debugging)
npx playwright test --headed
npx playwright test --config=playwright.chat.config.ts --headed

# Open the HTML report after a run
npx playwright show-report
```

## Architecture

### Collaboration tests

```
Browser (Playwright page A)
  └─> Toxiproxy :18888  ──[toxics]──> JupyterLab :8888
Browser (Playwright page B)
  └─> Toxiproxy :18889  ──[toxics]──> JupyterLab :8888

Toxiproxy control API: :8474  (HTTP REST, used by tests to add/remove toxics)
```

Each simulated collaborator connects through its own Toxiproxy port so network
conditions can be applied independently per client, mid-test.

### Chat tests

```
Browser (Playwright)  ──>  JupyterLab :8888  (launched from jupyter-ai-devrepo via uv run)
                                │
                                ├── jupyter-ai-persona-manager  (routes @mentions to personas)
                                ├── jupyter-ai-acp-client       (Kiro, Claude, Codex personas)
                                ├── jupyter-ai-chat-commands    (slash commands, file commands)
                                └── jupyter-server-documents    (YRoom management + drain)
```

`chat-global-setup.ts` runs `uv run jupyter lab --config=<chat-config>` from the
devrepo directory, activating its full Python environment. A single Playwright browser
connects directly to port 8888.

## Project Structure

```
jupyter-collab-tests/
├── CLAUDE.md                        # This file
├── README.md
├── package.json
├── tsconfig.json
├── playwright.config.ts             # Config for collaboration tests
├── playwright.chat.config.ts        # Config for chat session tests
│
├── server/
│   ├── pyproject.toml
│   ├── jupyter_server_config.py           # Server config for collab tests
│   ├── jupyter_server_chat_test_config.py # Server config for chat tests
│   └── notebooks/
│       └── collab-test.ipynb
│
└── tests/
    ├── global-setup.ts              # Collab: spawns toxiproxy + jupyter lab
    ├── global-teardown.ts           # Collab: kills both processes
    ├── toxiproxy-client.ts          # Toxiproxy HTTP REST wrapper
    ├── fixtures.ts                  # Collab: pageA, pageB, toxi fixtures
    │
    ├── chat-global-setup.ts         # Chat: spawns jupyter lab from devrepo
    ├── chat-global-teardown.ts      # Chat: kills jupyter lab
    ├── chat-fixtures.ts             # Chat: single chatPage fixture
    ├── chat-helpers.ts              # Chat: page object helpers + selectors
    │
    └── specs/
        ├── collab-create.spec.ts
        ├── collab-latency.spec.ts
        ├── collab-disconnect.spec.ts
        ├── collab-bandwidth.spec.ts
        ├── collab-packet.spec.ts
        ├── chat-agent-mention.spec.ts
        ├── chat-yroom-drain.spec.ts
        └── chat-multi-agent.spec.ts
```

## Key Files & Responsibilities

### Collab test files

**`tests/toxiproxy-client.ts`** — wraps the Toxiproxy REST API. Use this in tests,
never raw `fetch`. Methods: `createProxy`, `deleteProxy`, `addToxic`, `removeToxic`,
`resetAll`, `setProxyEnabled`.

**`tests/fixtures.ts`** — extends Galata's `test` with:
- `pageA`: Playwright page pointed at Toxiproxy port 18888
- `pageB`: Playwright page pointed at Toxiproxy port 18889
- `toxi`: a ready `ToxiproxyClient` instance
- `afterEach` hook that calls `toxi.resetAll()`

**`tests/global-setup.ts`** — spawns `toxiproxy-server` and `jupyter lab`, waits for
ports 8474 and 8888 to accept connections, then creates the two proxy entries.

**`server/jupyter_server_config.py`** — sets `token = ''`, `password = ''`,
`open_browser = False`, and pins the root dir to `server/`.

### Chat test files

**`tests/chat-helpers.ts`** — page object helpers and CSS selectors for the chat UI.
Functions: `createAndOpenChat`, `openChat`, `sendMessage`, `mentionAgent`,
`waitForAgentResponse`, `getMessageCount`, `getMessageTexts`, `closeChat`.

**`tests/chat-fixtures.ts`** — extends Galata's `test` with:
- `chatPage`: a single `IJupyterLabPageFixture` pointed at `http://localhost:8888`

**`tests/chat-global-setup.ts`** — spawns `uv run jupyter lab` from the devrepo
directory with the chat test config. Waits for port 8888.

**`server/jupyter_server_chat_test_config.py`** — Galata helpers, no auth,
`YRoom.inactivity_timeout = 10`, `YRoomManager.auto_free_interval = 60`.

## Toxiproxy Toxic Types Reference

| Type | Key Attributes | What it simulates |
|---|---|---|
| `latency` | `latency` (ms), `jitter` (ms) | Slow or jittery WAN link |
| `bandwidth` | `rate` (KB/s) | Throttled connection (10 ≈ very slow) |
| `timeout` | `timeout` (ms, 0=forever) | Data freeze / hanging connection |
| `reset_peer` | _(none)_ | Abrupt TCP RST — hard disconnect |
| `slow_close` | `delay` (ms) | Half-open socket before close |
| `slicer` | `average_size` (bytes), `delay` (ms) | Packet fragmentation |
| `limit_data` | `bytes` | Close connection after N bytes |

Toxics apply to `"downstream"` (server→client) or `"upstream"` (client→server).
`toxicity` (0.0–1.0) is the fraction of connections affected.

Disabling a proxy entirely (`setProxyEnabled(name, false)`) simulates complete outage.

## Test Conventions

- `fixtures.ts` runs `toxi.resetAll()` in `afterEach` — tests never need to clean up
  their own toxics, but they may do so for mid-test state changes.
- Use generous `expect` timeouts when latency is injected: if you add 2000ms, use at
  least `{ timeout: 15_000 }`.
- Name toxics descriptively: `"client_a_latency"` not `"lat"`.
- `pageA` and `pageB` are separate `BrowserContext` instances — they have independent
  cookies, WebSocket connections, and collaborative sessions.
- The shared notebook (`collab-test.ipynb`) is opened by both pages at the start of
  each test via Galata's `page.notebook.open()` helper.

## Scenario Catalogue

- `high latency client eventually syncs edits to healthy client`
- `client recovers and re-syncs after connection drop`
- `bandwidth-throttled client does not block healthy client`
- `healthy client sees edits while other client is disconnected`
- `both clients on high latency still reach consistency`
- `TCP reset triggers reconnect and document stays consistent`
- `packet fragmentation does not corrupt collaborative state`
- `client on timeout toxic reconnects and receives missed changes`

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `TOXIPROXY_URL` | `http://localhost:8474` | Toxiproxy control API |
| `JUPYTER_URL` | `http://localhost:8888` | Direct JupyterLab URL |
| `CLIENT_A_URL` | `http://localhost:18888` | Proxied URL for client A |
| `CLIENT_B_URL` | `http://localhost:18889` | Proxied URL for client B |
| `DEVREPO_DIR` | `../jupyter-ai-devrepo` | Path to the jupyter-ai devrepo |

## Debugging Tips

- If `globalSetup` hangs, check that ports 8474, 8888, 18888, 18889 are free before
  running: `lsof -i :8474 -i :8888 -i :18888 -i :18889`
- Use `--headed` to watch browser behaviour with toxics applied live.
- Add `await page.pause()` in a test to freeze and inspect the Playwright inspector.
- If Toxiproxy isn't forwarding, verify the binary is on PATH: `which toxiproxy-server`
- JupyterLab startup is slow (~3–5s). The `waitForPort` helper in `global-setup.ts`
  polls with a timeout — increase it if your machine is slow.
- Toxiproxy blocks `Mozilla/` User-Agent on its control API port (:8474). This is
  intentional — all control calls must come from Node, not the browser.
- Chat tests: if a persona doesn't appear in the `@` autocomplete, check that the
  devrepo environment has the ACP client installed and API keys / ACP server configured.
- Chat drain test waits ~75s (`inactivity_timeout=10` + `auto_free_interval=60` + margin).
  Increase the margin in the spec if the test is flaky on slow machines.
