# jupyter-collab-chaos

Tests JupyterLab real-time collaboration under simulated adverse network conditions.
Uses **Toxiproxy** (TCP proxy binary) to inject network faults and **Galata**
(Playwright-based JupyterLab test framework) to drive multiple browser clients.
No Docker — all processes are spawned and torn down by the test runner itself.

## Prerequisites

- `toxiproxy-server` on your PATH — download from https://github.com/Shopify/toxiproxy/releases
- Python 3.11+ with the `server/` virtualenv set up (see README)
- Node.js 18+

## Quick Commands

```bash
# One-time Python setup
cd server && python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# One-time JS setup (from project root)
npm install
npx playwright install chromium

# Run all tests (starts Toxiproxy + JupyterLab automatically)
npx playwright test

# Run a specific spec
npx playwright test tests/specs/collab-latency.spec.ts

# Run with visible browser (useful for debugging)
npx playwright test --headed

# Open the HTML report after a run
npx playwright show-report

# Inspect Toxiproxy state manually (while tests are running)
curl http://localhost:8474/proxies
curl http://localhost:8474/proxies/jupyter_client_a/toxics

# Reset all toxics without restarting
curl -X POST http://localhost:8474/reset
```

## Architecture

```
Browser (Playwright page A)
  └─> Toxiproxy :18888  ──[toxics]──> JupyterLab :8888
Browser (Playwright page B)
  └─> Toxiproxy :18889  ──[toxics]──> JupyterLab :8888

Toxiproxy control API: :8474  (HTTP REST, used by tests to add/remove toxics)
```

Each simulated collaborator connects through its own Toxiproxy port so network
conditions can be applied independently per client, mid-test.

`global-setup.ts` spawns both `toxiproxy-server` and `jupyter lab` as child processes,
waits for their ports to be ready, then registers the two proxies.
`global-teardown.ts` kills both processes by PID.

## Project Structure

```
jupyter-collab-chaos/
├── CLAUDE.md                        # This file
├── README.md
├── package.json
├── tsconfig.json
├── .gitignore
│
├── server/                          # Python side — JupyterLab server
│   ├── pyproject.toml
│   ├── jupyter_server_config.py
│   ├── .venv/                       # gitignored
│   └── notebooks/
│       └── collab-test.ipynb        # Shared notebook used by tests
│
└── tests/                           # TypeScript side — all test code
    ├── playwright.config.ts
    ├── global-setup.ts              # Spawns toxiproxy-server + jupyter lab
    ├── global-teardown.ts           # Kills both processes
    ├── toxiproxy-client.ts          # Thin HTTP wrapper for Toxiproxy REST API
    ├── fixtures.ts                  # Extended Galata fixtures (pageA, pageB, toxi)
    └── specs/
        ├── collab-latency.spec.ts
        ├── collab-disconnect.spec.ts
        ├── collab-bandwidth.spec.ts
        └── collab-packet.spec.ts
```

## Key Files & Responsibilities

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
Stores child process PIDs in `process.env` for teardown.

**`tests/global-teardown.ts`** — kills Toxiproxy and Jupyter by PID.

**`server/jupyter_server_config.py`** — sets `token = ''`, `password = ''`,
`open_browser = False`, and pins the root dir to `server/`.

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
