#!/usr/bin/env node
'use strict';

/**
 * Aamako-Agro cross-platform development launcher.
 *
 * Starts the Backend API, Dashboard admin UI and static Frontend
 * storefront together in one terminal. Works identically on
 * macOS, Linux and Windows (no bash or Python required).
 *
 * Usage:  npm run dev     (from the repository root)
 * Stop:   Ctrl+C          (shuts down all three services)
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IS_WIN = process.platform === 'win32';
// On Windows, npm is npm.cmd; Node >= 18.20 also requires shell:true for .cmd files.
const NPM_CMD = IS_WIN ? 'npm.cmd' : 'npm';
const SPAWN_OPTS = IS_WIN ? { shell: true } : { detached: true };

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

const SERVICES = [
  {
    name: 'api',
    color: '\x1b[36m', // cyan
    cwd: path.join(ROOT, 'Backend'),
    args: ['run', 'start:dev'],
    url: 'http://localhost:3000/api/docs',
  },
  {
    name: 'admin',
    color: '\x1b[35m', // magenta
    cwd: path.join(ROOT, 'Dashboard'),
    args: ['run', 'dev'],
    url: 'http://localhost:3001',
  },
  {
    name: 'web',
    color: '\x1b[33m', // yellow
    cwd: path.join(ROOT, 'Frontend'),
    args: ['run', 'start'],
    url: 'http://localhost:8080',
  },
];

const children = [];
let shuttingDown = false;

/** Prefix every line of a stream with a colored [tag]. */
function pipeWithPrefix(child, service, stream) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop(); // keep incomplete last line for next chunk
    for (const line of lines) {
      if (line.trim()) {
        process.stdout.write(`${service.color}[${service.name}]${RESET} ${line}\n`);
      }
    }
  });
}

/** Kill a child and (on Unix) its whole process group. */
function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  try {
    if (IS_WIN) {
      // /T = whole tree, /F = force — npm wraps children in extra processes.
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else if (child.detached && child.pid) {
      process.kill(-child.pid, 'SIGTERM'); // negative pid = process group
    } else {
      child.kill('SIGTERM');
    }
  } catch (_) {
    /* already gone */
  }
}

function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${DIM}Stopping all services...${RESET}`);
  children.forEach(stopChild);
  // Give processes a moment to terminate before the launcher exits.
  setTimeout(() => process.exit(exitCode || 0), IS_WIN ? 2000 : 600);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`${DIM}Starting Aamako-Agro development services...${RESET}\n`);

for (const service of SERVICES) {
  const child = spawn(NPM_CMD, service.args, {
    cwd: service.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...SPAWN_OPTS,
  });
  children.push(child);
  pipeWithPrefix(child, service, child.stdout);
  pipeWithPrefix(child, service, child.stderr);
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.log(`${service.color}[${service.name}]${RESET} exited (code=${code}${signal ? `, signal=${signal}` : ''})`);
    }
  });
}

console.log(`
Once startup finishes:
  🛍️  Storefront : ${SERVICES[2].url}
  🔐  Dashboard  : ${SERVICES[1].url}
  ⚙️  API docs   : ${SERVICES[0].url}

Admin login (after seeding): admin@aamako.agro / Admin123!
Press ${DIM}Ctrl+C${RESET} to stop everything.
`);
