import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const ports = Array.from({ length: 10 }, (_, index) => 4173 + index);
const marker = '<title>雅思机考界面模拟器</title>';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isSimulator(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: AbortSignal.timeout(500),
    });
    if (!response.ok || !(await response.text()).includes(marker)) return false;
    const catalog = await fetch(`http://127.0.0.1:${port}/api/local-exams`, {
      signal: AbortSignal.timeout(1000),
    });
    return catalog.ok && Array.isArray((await catalog.json()).exams);
  } catch {
    return false;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

async function startServer(port) {
  const child = spawn(process.execPath, [join(root, 'server.mjs')], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
  let failed = false;
  child.once('error', () => { failed = true; });
  child.unref();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (failed || child.exitCode !== null) break;
    if (await isSimulator(port)) return true;
    await wait(100);
  }
  if (!failed && child.exitCode === null) child.kill();
  return false;
}

async function main() {
  let port;
  for (const candidate of ports) {
    if (await isSimulator(candidate)) {
      port = candidate;
      break;
    }
  }
  if (!port) {
    for (const candidate of ports) {
      if (await isPortFree(candidate) && await startServer(candidate)) {
        port = candidate;
        break;
      }
    }
  }
  if (!port) throw new Error('Could not start the simulator (ports 4173–4182 are unavailable).');

  console.log(`http://127.0.0.1:${port}/`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
