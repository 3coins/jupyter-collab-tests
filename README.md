# jupyter-collab-tests

Tests for JupyterLab real-time collaboration under simulated adverse network conditions,
using [Toxiproxy](https://github.com/Shopify/toxiproxy) for network fault injection and
[Galata](https://github.com/jupyterlab/jupyterlab/tree/main/galata) (Playwright) to
drive multiple browser clients.

## Prerequisites

- **Node.js 18+**
- **Python 3.11+**
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

## Setup

```bash
# 1. Clone and enter the project
git clone https://github.com/3coins/jupyter-collab-tests.git
cd jupyter-collab-tests

# 2. Install JavaScript dependencies
npm install
npx playwright install chromium

# 3. Set up the Python environment
cd server

# With uv
uv sync

# With pip
pip install .

cd ..
```

## Running Tests

```bash
# Run the full suite
# (automatically starts toxiproxy-server and jupyter lab, then shuts them down)
npx playwright test

# Run a specific spec file
npx playwright test tests/specs/collab-create.spec.ts

# Run with visible browsers (useful for debugging)
npx playwright test --headed

# Open the HTML report
npx playwright show-report
```

## Project Structure

```
jupyter-collab-tests/
├── CLAUDE.md                        # Claude Code steering file
├── README.md
├── package.json
├── tsconfig.json
├── .gitignore
│
├── server/                          # Python / JupyterLab side
│   ├── pyproject.toml
│   ├── jupyter_server_config.py
│   └── notebooks/
│       └── collab-test.ipynb        # Shared notebook used by tests
│
└── tests/                           # TypeScript / Playwright side
    ├── playwright.config.ts
    ├── global-setup.ts              # Spawns toxiproxy-server + jupyter lab
    ├── global-teardown.ts           # Shuts them down after the suite
    ├── toxiproxy-client.ts          # Toxiproxy HTTP REST wrapper
    ├── fixtures.ts                  # pageA, pageB, toxi fixtures
    └── specs/
        ├── collab-latency.spec.ts
        ├── collab-disconnect.spec.ts
        ├── collab-bandwidth.spec.ts
        └── collab-packet.spec.ts
```

## How It Works

```
Browser A (Playwright)  ──>  Toxiproxy :18888  ──[toxics]──>  JupyterLab :8888
Browser B (Playwright)  ──>  Toxiproxy :18889  ──[toxics]──>  JupyterLab :8888
                                    ↑
                             Control API :8474
                          (tests add/remove toxics here)
```

Each test client gets its own Toxiproxy port, so network conditions can be applied
to one client independently of the other, and changed mid-test.

## Troubleshooting

**`toxiproxy-server` not found** — make sure the binary is on your PATH and is
executable. Run `which toxiproxy-server` to verify.

**Port already in use** — check for lingering processes:
```bash
lsof -i :8474 -i :8888 -i :18888 -i :18889
```

**JupyterLab startup timeout** — the default timeout is 30s. If your machine is slow,
increase `STARTUP_TIMEOUT_MS` in `tests/global-setup.ts`.

**Python virtualenv** — make sure `server/.venv` exists and `jupyter` is installed
inside it. The `global-setup.ts` spawns `jupyter` from the system PATH. If you want
to use the venv's jupyter, set `PATH` accordingly or use the full path to the binary.
