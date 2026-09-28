// Mode pengembangan: server API + Vite (hot reload) sekaligus.
import { spawn } from 'node:child_process';

const procs = [
  spawn(process.execPath, ['--watch', 'server/index.js', ...process.argv.slice(2)], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'web'], { stdio: 'inherit' }),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', stop);
