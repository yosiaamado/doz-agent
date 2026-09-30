// A small structured logger. One JSON line per event to stderr, except `banner` for startup messages.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.DOZ_LOG_LEVEL ?? 'info'] ?? LEVELS.info;

function write(level, message, fields = {}) {
  if (LEVELS[level] < threshold) return;
  process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level, message, ...fields })}\n`);
}

export const logger = {
  debug: (message, fields) => write('debug', message, fields),
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
  banner: (lines) => process.stdout.write(`${lines.join('\n')}\n`),
};
