// Menjalankan perintah shell untuk node action. Exit code 0 = PASS.
import { spawn } from 'node:child_process';
import { childEnv } from '../lib/secretEnv.js';

const MAX_OUTPUT = 200_000;

export function shellCommand(command) {
  return process.platform === 'win32' ? ['cmd', ['/d', '/s', '/c', command]] : ['bash', ['-lc', command]];
}

export function runCommand({ command, workdir, signal, onLine }) {
  return new Promise((resolve, reject) => {
    const [bin, args] = shellCommand(command);
    const child = spawn(bin, args, { cwd: workdir, env: childEnv() });
    let output = '';
    let partial = '';
    const onData = (chunk) => {
      const text = chunk.toString();
      if (output.length < MAX_OUTPUT) output += text;
      partial += text;
      const lines = partial.split('\n');
      partial = lines.pop();
      for (const line of lines) if (line.trim()) onLine?.(line.slice(0, 400));
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const onAbort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', onAbort);
    child.on('error', (err) => reject(new Error(`failed to run command: ${err.message}`)));
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) return reject(new Error('stopped'));
      resolve({ code, output: output.length >= MAX_OUTPUT ? `${output}\n[... output dipotong]` : output });
    });
  });
}
