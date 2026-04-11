import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import { ToxiproxyClient } from './toxiproxy-client';

const TOXIPROXY_PORT = 8474;
const JUPYTER_PORT = 8888;
const POLL_INTERVAL_MS = 250;
const STARTUP_TIMEOUT_MS = 30_000;

/**
 * Poll until a TCP port accepts connections, or throw after a timeout.
 */
function waitForPort(port: number, timeoutMs = STARTUP_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function attempt() {
      const socket = new net.Socket();
      socket.setTimeout(500);

      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.on('error', () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(new Error(`Port ${port} did not open within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, POLL_INTERVAL_MS);
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        setTimeout(attempt, POLL_INTERVAL_MS);
      });

      socket.connect(port, '127.0.0.1');
    }

    attempt();
  });
}

function spawnProcess(cmd: string, args: string[], opts: object = {}): ChildProcess {
  const proc = spawn(cmd, args, { stdio: 'pipe', ...opts });

  proc.stdout?.on('data', (d: Buffer) => process.stdout.write(`[${cmd}] ${d}`));
  proc.stderr?.on('data', (d: Buffer) => process.stderr.write(`[${cmd}] ${d}`));

  proc.on('error', err => {
    console.error(`Failed to start ${cmd}: ${err.message}`);
    console.error(`Is '${cmd}' installed and on your PATH?`);
  });

  return proc;
}

export default async function globalSetup() {
  // --- 1. Start Toxiproxy ---
  const toxiproxy = spawnProcess('toxiproxy-server', []);
  await waitForPort(TOXIPROXY_PORT);
  console.log('✓ toxiproxy-server ready');

  // --- 2. Start JupyterLab ---
  const serverDir = path.resolve(__dirname, '..', 'server');
  const jupyter = spawnProcess(
    'jupyter',
    ['lab', `--config=${path.join(serverDir, 'jupyter_server_config.py')}`],
    { cwd: serverDir }
  );
  await waitForPort(JUPYTER_PORT);
  console.log('✓ JupyterLab ready');

  // --- 3. Register Toxiproxy proxies ---
  const toxi = new ToxiproxyClient();
  await toxi.createProxy('jupyter_client_a', '0.0.0.0:18888', '127.0.0.1:8888');
  await toxi.createProxy('jupyter_client_b', '0.0.0.0:18889', '127.0.0.1:8888');
  console.log('✓ Toxiproxy proxies registered');

  // Store PIDs so globalTeardown can kill the processes
  process.env._TOXIPROXY_PID = String(toxiproxy.pid);
  process.env._JUPYTER_PID = String(jupyter.pid);
}
