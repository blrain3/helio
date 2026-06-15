import { exec, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { Queue } from 'bullmq';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';

const execAsync = promisify(exec);
const startupTimeoutMs = 30_000;

type HttpMethod = 'GET' | 'POST' | 'PATCH';

interface IntegrationResponse<T> {
  status: number;
  body: T;
}

type RequestInput = { authorization?: string } & Record<string, unknown>;

export interface IntegrationHarness {
  baseUrl: string;
  request<T>(method: HttpMethod, path: string, input?: RequestInput): Promise<IntegrationResponse<T>>;
  close(): Promise<void>;
}

interface IntegrationHarnessOptions {
  frontendUrl?: string;
}

export async function createIntegrationHarness(
  options: IntegrationHarnessOptions = {},
): Promise<IntegrationHarness> {
  const environment = saveEnvironment();
  let postgres: StartedTestContainer | undefined;
  let redis: StartedTestContainer | undefined;
  let api: ChildProcessWithoutNullStreams | undefined;
  let worker: ChildProcessWithoutNullStreams | undefined;

  try {
    postgres = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_USER: 'helio',
        POSTGRES_PASSWORD: 'helio',
        POSTGRES_DB: 'helio',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/))
      .start();
    redis = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start();

    const postgresHost = dockerHost(postgres.getHost());
    const databaseUrl = `postgresql://helio:helio@${postgresHost}:${postgres.getMappedPort(5432)}/helio`;
    const redisHost = dockerHost(redis.getHost());
    const redisPort = redis.getMappedPort(6379);
    const port = await getAvailablePort();
    const apiUrl = `http://127.0.0.1:${port}`;

    Object.assign(process.env, {
      DATABASE_URL: databaseUrl,
      REDIS_URL: `redis://${redisHost}:${redisPort}`,
      REDIS_HOST: redisHost,
      REDIS_PORT: String(redisPort),
      JWT_ACCESS_SECRET: 'integration-access-secret',
      JWT_REFRESH_SECRET: 'integration-refresh-secret',
      INTERNAL_REQUEST_SECRET: 'integration-internal-secret',
      PAYMENT_PROVIDER: 'mock',
      MOCK_PAYMENT_DEMO_ENABLED: 'true',
      API_BASE_URL: `${apiUrl}/api`,
      FRONTEND_URL: options.frontendUrl ?? 'http://127.0.0.1:5173',
      NODE_ENV: 'test',
      PORT: String(port),
    });

    const apiDirectory = process.cwd();
    const workerDirectory = resolve(apiDirectory, '..', 'worker');
    await runCommand('pnpm exec prisma migrate deploy --schema prisma/schema.prisma', apiDirectory);
    await runCommand('pnpm run build', apiDirectory);
    await runCommand('pnpm run build', workerDirectory);

    api = startProcess(apiDirectory);
    await waitForReady(`${apiUrl}/api/health/ready`, api);
    worker = startProcess(workerDirectory);
    await waitForWorker(redisHost, redisPort, worker);

    const activeApi = api;
    return {
      baseUrl: apiUrl,
      async request<T>(method: HttpMethod, path: string, input: RequestInput = {}) {
        const { authorization, ...payload } = input;
        const body = Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined;
        const response = await fetch(`${apiUrl}/api${path}`, {
          method,
          headers: {
            ...(authorization ? { authorization } : {}),
            ...(body ? { 'content-type': 'application/json' } : {}),
          },
          body,
        });
        const text = await response.text();
        return {
          status: response.status,
          body: (text ? JSON.parse(text) : undefined) as T,
        };
      },
      async close() {
        await closeAll(worker, activeApi, redis, postgres);
        restoreEnvironment(environment);
      },
    };
  } catch (error) {
    await closeAll(worker, api, redis, postgres);
    restoreEnvironment(environment);
    throw error;
  }
}

function startProcess(cwd: string): ChildProcessWithoutNullStreams {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd,
    env: process.env,
    stdio: 'pipe',
  });
  child.stdout.resume();
  child.stderr.resume();
  return child;
}

async function runCommand(command: string, cwd: string): Promise<void> {
  try {
    await execAsync(command, { cwd, env: process.env });
  } catch (error) {
    const failed = error as { message: string; stderr?: string; stdout?: string };
    throw new Error(`${command} failed: ${failed.stderr ?? failed.message}\n${failed.stdout ?? ''}`);
  }
}

async function waitForReady(url: string, api: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) {
      throw new Error(`API exited before readiness check completed with code ${api.exitCode}`);
    }
    try {
      if ((await fetch(url)).ok) {
        return;
      }
    } catch {
      // The listener may not be bound yet.
    }
    await delay(250);
  }
  throw new Error(`API did not become ready within ${startupTimeoutMs / 1000} seconds`);
}

async function waitForWorker(
  host: string,
  port: number,
  worker: ChildProcessWithoutNullStreams,
): Promise<void> {
  const queue = new Queue('settlement', { connection: { host, port } });
  const deadline = Date.now() + startupTimeoutMs;
  try {
    while (Date.now() < deadline) {
      if (worker.exitCode !== null) {
        throw new Error(`Worker exited before registration completed with code ${worker.exitCode}`);
      }
      if ((await queue.getWorkersCount()) > 0) {
        return;
      }
      await delay(250);
    }
  } finally {
    await queue.close();
  }
  throw new Error(`Settlement worker did not register within ${startupTimeoutMs / 1000} seconds`);
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
    throw new Error('Unable to allocate an integration API port');
  }
  return address.port;
}

async function closeAll(
  worker: ChildProcessWithoutNullStreams | undefined,
  api: ChildProcessWithoutNullStreams | undefined,
  redis: StartedTestContainer | undefined,
  postgres: StartedTestContainer | undefined,
): Promise<void> {
  await Promise.allSettled([
    stopProcess(worker),
    stopProcess(api),
    redis?.stop(),
    postgres?.stop(),
  ]);
}

async function stopProcess(child: ChildProcessWithoutNullStreams | undefined): Promise<void> {
  if (!child || child.exitCode !== null) {
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

function saveEnvironment(): Record<string, string | undefined> {
  return Object.fromEntries(
    [
      'DATABASE_URL',
      'REDIS_URL',
      'REDIS_HOST',
      'REDIS_PORT',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'INTERNAL_REQUEST_SECRET',
      'PAYMENT_PROVIDER',
      'MOCK_PAYMENT_DEMO_ENABLED',
      'API_BASE_URL',
      'FRONTEND_URL',
      'NODE_ENV',
      'PORT',
    ].map((key) => [key, process.env[key]]),
  );
}

function restoreEnvironment(environment: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function dockerHost(host: string): string {
  return host === 'localhost' ? '127.0.0.1' : host;
}
