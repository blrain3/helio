import { exec, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { createIntegrationHarness } from './integration/harness';

const execAsync = promisify(exec);

async function main(): Promise<void> {
  const apiDirectory = process.cwd();
  const repositoryDirectory = resolve(apiDirectory, '..', '..');
  const webPort = await getAvailablePort();
  const webUrl = `http://127.0.0.1:${webPort}`;
  const harness = await createIntegrationHarness({ frontendUrl: webUrl });
  let web: ChildProcessWithoutNullStreams | undefined;

  try {
    await runCommand('pnpm exec tsx prisma/seed.ts', apiDirectory);
    await runCommand('pnpm --filter @helio/web build', repositoryDirectory, {
      VITE_API_BASE_URL: `${harness.baseUrl}/api`,
    });

    web = startWeb(repositoryDirectory, webPort);
    await waitForWeb(webUrl, web);
    await runCommand('pnpm exec playwright test --config e2e/playwright.config.ts', repositoryDirectory, {
      E2E_BASE_URL: webUrl,
    });
  } finally {
    await stopProcess(web);
    await harness.close();
  }
}

async function runCommand(
  command: string,
  cwd: string,
  environment: NodeJS.ProcessEnv = {},
): Promise<void> {
  await execAsync(command, { cwd, env: { ...process.env, ...environment } });
}

async function waitForWeb(url: string, web: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (web.exitCode !== null) {
      throw new Error(`Web preview exited before it became available with code ${web.exitCode}`);
    }
    try {
      if ((await fetch(url)).ok) {
        return;
      }
    } catch {
      // The preview listener may not be bound yet.
    }
    await delay(250);
  }
  throw new Error('Web preview did not become available within 30 seconds');
}

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolvePort, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolvePort());
  });
  const address = server.address();
  await new Promise<void>((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
  if (!address || typeof address === 'string') {
    throw new Error('Unable to allocate an E2E Web port');
  }
  return address.port;
}

function startWeb(cwd: string, port: number): ChildProcessWithoutNullStreams {
  const args = ['--filter', '@helio/web', 'exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port)];
  const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `call pnpm ${args.join(' ')}`], { cwd, env: process.env, stdio: 'pipe' })
    : spawn('pnpm', args, { cwd, env: process.env, stdio: 'pipe' });
  child.stdout.on('data', (chunk) => process.stdout.write(`[e2e:web] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[e2e:web] ${chunk}`));
  return child;
}

async function stopProcess(child: ChildProcessWithoutNullStreams | undefined): Promise<void> {
  if (!child || child.exitCode !== null) {
    return;
  }
  if (process.platform === 'win32' && child.pid) {
    await execAsync(`taskkill /pid ${child.pid} /t /f`).catch(() => undefined);
    return;
  }
  child.kill('SIGTERM');
  if (await waitForExit(child, 5_000)) {
    return;
  }
  child.kill('SIGKILL');
  await waitForExit(child, 5_000);
}

async function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null) {
    return true;
  }
  const exited = once(child, 'exit').then(() => true);
  return Promise.race([exited, delay(timeoutMs).then(() => false)]);
}

void main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
