# jupyter-collab-tests

Tests for JupyterLab real-time collaboration and AI chat sessions, using
[Galata](https://github.com/jupyterlab/jupyterlab/tree/main/galata) (Playwright)
to drive browser clients. Includes two test suites:

1. **Collaboration tests** — network fault injection via
   [Toxiproxy](https://github.com/Shopify/toxiproxy) with multiple browser clients
2. **Chat session tests** — AI agent `@mention` interactions, yroom drain/recovery,
   and multi-agent conversations (Kiro, Claude, Codex)

## Prerequisites

- **Node.js 18+**
- **Python 3.11+**

### For collaboration tests only

- **`toxiproxy-server`** on your PATH

  Download the binary for your platform from the
  [Toxiproxy releases page](https://github.com/Shopify/toxiproxy/releases) and place
  it somewhere on your PATH (e.g. `/usr/local/bin`).

  ```bash
  # macOS (arm64) example
  curl -L https://github.com/Shopify/toxiproxy/releases/latest/download/toxiproxy-server-darwin-arm64 \
    -o /usr/local/bin/toxiproxy-server
  chmod +x /usr/local/bin/toxiproxy-server

  # Verify
  toxiproxy-server --version
  ```

### For chat tests only

- **jupyter-ai-devrepo** — the
  [jupyter-ai development monorepo](https://github.com/3coins/jupyter-ai-devrepo)
  cloned as a sibling directory (i.e. `../jupyter-ai-devrepo` relative to this repo),
  with its Python environment set up via `uv sync`. This repo contains all the
  jupyter-ai packages (persona manager, ACP client, chat commands, etc.) needed to
  run the AI chat tests.

  ```bash
  # Expected directory layout
  projects/
  ├── jupyter-collab-tests/    # this repo
  └── jupyter-ai-devrepo/      # jupyter-ai monorepo with .venv
  ```

  If the devrepo lives elsewhere, set the `DEVREPO_DIR` environment variable to its
  absolute path.

## Setup

```bash
# 1. Clone and enter the project
git clone https://github.com/3coins/jupyter-collab-tests.git
cd jupyter-collab-tests

# 2. Install JavaScript dependencies
npm install
npx playwright install chromium

# 3. Set up the Python environment (for collaboration tests)
cd server
uv sync    # or: pip install .
cd ..
```

## Running Tests

### Collaboration tests (Toxiproxy)

```bash
# Run the full collab suite
# (automatically starts toxiproxy-server and jupyter lab, then shuts them down)
npx playwright test

# Run a specific spec file
npx playwright test tests/specs/collab-create.spec.ts

# Run with visible browsers (useful for debugging)
npx playwright test --headed

# Open the HTML report
npx playwright show-report
```

### Chat session tests (AI agents)

These tests launch JupyterLab from the jupyter-ai devrepo using `uv run`, so all
AI extensions and personas are available. No Toxiproxy is needed.

```bash
# Run all chat tests
npx playwright test --config=playwright.chat.config.ts

# Run a specific chat spec
npx playwright test --config=playwright.chat.config.ts tests/specs/chat-agent-mention.spec.ts
npx playwright test --config=playwright.chat.config.ts tests/specs/chat-yroom-drain.spec.ts
npx playwright test --config=playwright.chat.config.ts tests/specs/chat-multi-agent.spec.ts

# Run with visible browser
npx playwright test --config=playwright.chat.config.ts --headed

# Override the devrepo path
DEVREPO_DIR=/path/to/jupyter-ai-devrepo npx playwright test --config=playwright.chat.config.ts
```

#### Chat test descriptions

| Spec | What it tests | Timeout |
|---|---|---|
| `chat-agent-mention.spec.ts` | Create a chat, send `@Kiro hello`, verify the agent responds | 2 min |
| `chat-yroom-drain.spec.ts` | Send a message, close the tab, wait ~75s for the yroom to drain from memory, reopen the chat, verify message history is preserved | 3 min |
| `chat-multi-agent.spec.ts` | Send `@Kiro hello`, `@Claude hello`, `@Codex hello` in the same chat, verify each agent responds | 5 min |

#### Chat test server configuration

The chat tests use `server/jupyter_server_chat_test_config.py` which configures:

- **No authentication** — token and password disabled
- **Galata helpers** — `window.jupyterapp` exposed for Playwright interaction
- **YRoom drain timeouts** — `inactivity_timeout=10s`, `auto_free_interval=60s`
  (low values so the drain test doesn't wait too long)

## Project Structure

```
jupyter-collab-tests/
├── README.md
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── playwright.config.ts              # Config for collaboration tests
├── playwright.chat.config.ts         # Config for chat session tests
│
├── server/
│   ├── pyproject.toml
│   ├── jupyter_server_config.py      # Server config for collab tests
│   ├── jupyter_server_chat_test_config.py  # Server config for chat tests
│   └── notebooks/
│       └── collab-test.ipynb
│
└── tests/
    ├── global-setup.ts               # Collab: spawns toxiproxy + jupyter lab
    ├── global-teardown.ts            # Collab: kills both processes
    ├── toxiproxy-client.ts           # Toxiproxy HTTP REST wrapper
    ├── fixtures.ts                   # Collab: pageA, pageB, toxi fixtures
    │
    ├── chat-global-setup.ts          # Chat: spawns jupyter lab from devrepo
    ├── chat-global-teardown.ts       # Chat: kills jupyter lab
    ├── chat-fixtures.ts              # Chat: single chatPage fixture
    ├── chat-helpers.ts               # Chat: page object helpers + selectors
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

## How It Works

### Collaboration tests

```
Browser A (Playwright)  ──>  Toxiproxy :18888  ──[toxics]──>  JupyterLab :8888
Browser B (Playwright)  ──>  Toxiproxy :18889  ──[toxics]──>  JupyterLab :8888
                                    ↑
                             Control API :8474
                          (tests add/remove toxics here)
```

Each test client gets its own Toxiproxy port, so network conditions can be applied
to one client independently of the other, and changed mid-test.

### Chat tests

```
Browser (Playwright)  ──>  JupyterLab :8888  (launched from jupyter-ai-devrepo via uv run)
                                │
                                ├── jupyter-ai-persona-manager  (routes @mentions to personas)
                                ├── jupyter-ai-acp-client       (Kiro, Claude, Codex personas)
                                ├── jupyter-ai-chat-commands    (slash commands, file commands)
                                └── jupyter-server-documents    (YRoom management + drain)
```

The chat global setup runs `uv run jupyter lab --config=<chat-config>` from the
devrepo directory, which activates the devrepo's full Python environment with all
jupyter-ai extensions. A single Playwright browser connects directly to port 8888.

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `TOXIPROXY_URL` | `http://localhost:8474` | Toxiproxy control API |
| `JUPYTER_URL` | `http://localhost:8888` | Direct JupyterLab URL |
| `CLIENT_A_URL` | `http://localhost:18888` | Proxied URL for client A |
| `CLIENT_B_URL` | `http://localhost:18889` | Proxied URL for client B |
| `DEVREPO_DIR` | `../jupyter-ai-devrepo` | Path to the jupyter-ai devrepo |

## Troubleshooting

**`toxiproxy-server` not found** — make sure the binary is on your PATH and is
executable. Run `which toxiproxy-server` to verify.

**Port already in use** — check for lingering processes:
```bash
lsof -i :8474 -i :8888 -i :18888 -i :18889
```

**JupyterLab startup timeout** — the default timeout is 30s for collab tests, 60s
for chat tests. If your machine is slow, increase `STARTUP_TIMEOUT_MS` in the
respective `global-setup.ts` file.

**Chat test: persona not appearing in autocomplete** — the AI persona (Kiro, Claude,
Codex) must be properly configured in the devrepo environment. Ensure the ACP client
is installed and any required API keys or ACP server connections are set up.

**Chat test: yroom drain test timing** — the drain test waits ~75s
(`inactivity_timeout=10s` + `auto_free_interval=60s` + 5s margin). If the test
fails with messages not matching, the yroom may not have been freed yet — try
increasing the wait margin in the spec.

**Python virtualenv** — for collab tests, make sure `server/.venv` exists. For chat
tests, the devrepo's `.venv` is used automatically via `uv run`.
