import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import * as path from 'path';

const JUPYTER_PORT = 8888;
const POLL_INTERVAL_MS = 250;
const STARTUP_TIMEOUT_MS = 60_000;

function waitForPort(port: number, timeoutMs = STARTUP_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function attempt() {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.on('connect', () => { socket.destroy(); resolve(); });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() >= deadline) reject(new Error(`Port ${port} did not open within ${timeoutMs}ms`));
        else setTimeout(attempt, POLL_INTERVAL_MS);
      });
      socket.on('timeout', () => { socket.destroy(); setTimeout(attempt, POLL_INTERVAL_MS); });
      socket.connect(port, '127.0.0.1');
    }
    attempt();
  });
}

export default async function globalSetup() {
  const devrepoDir = process.env.DEVREPO_DIR ?? path.resolve(__dirname, '../../jupyter-ai-devrepo');
  const configPath = path.resolve(__dirname, '../server/jupyter_server_chat_test_config.py');

  console.log(`Starting JupyterLab from devrepo: ${devrepoDir}`);
  console.log(`Using config: ${configPath}`);

  const jupyter: ChildProcess = spawn(
    'uv',
    ['run', 'jupyter', 'lab', `--config=${configPath}`],
    { cwd: devrepoDir, stdio: 'pipe' },
  );

  jupyter.stdout?.on('data', (d: Buffer) => process.stdout.write(`[jupyter] ${d}`));
  jupyter.stderr?.on('data', (d: Buffer) => process.stderr.write(`[jupyter] ${d}`));
  jupyter.on('error', err => {
    console.error(`Failed to start jupyter: ${err.message}`);
  });

  await waitForPort(JUPYTER_PORT);
  console.log('✓ JupyterLab ready');

  process.env._JUPYTER_CHAT_PID = String(jupyter.pid);
}
