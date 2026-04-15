export default async function globalTeardown() {
  const pid = process.env._JUPYTER_CHAT_PID;
  if (pid) {
    try {
      process.kill(Number(pid), 'SIGTERM');
      console.log(`✓ Killed JupyterLab (PID ${pid})`);
    } catch {
      // Process may have already exited
    }
  }
}
