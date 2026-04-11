import { ToxiproxyClient } from './toxiproxy-client';

export default async function globalTeardown() {
  // Clean up proxies gracefully first
  try {
    const toxi = new ToxiproxyClient();
    await toxi.deleteProxy('jupyter_client_a');
    await toxi.deleteProxy('jupyter_client_b');
  } catch {
    // Toxiproxy may already be dead — that's fine
  }

  // Kill child processes by PID
  for (const envVar of ['_TOXIPROXY_PID', '_JUPYTER_PID']) {
    const pid = process.env[envVar];
    if (pid) {
      try {
        process.kill(Number(pid), 'SIGTERM');
      } catch {
        // Process may have already exited
      }
    }
  }
}
