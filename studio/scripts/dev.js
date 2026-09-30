// Development mode: the API server and Vite (hot reload) at the same time.
// Note: if the server moves to another port (4317 already in use), set DOZ_STUDIO_PORT=<port> so the Vite proxy points at the right one.
import { spawn } from 'node:child_process';

const procs = [
  spawn(process.execPath, ['--watch', 'server/index.js', ...process.argv.slice(2)], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'web'], { stdio: 'inherit' }),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', stop);
