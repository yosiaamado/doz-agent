// doz-studio: server lokal (127.0.0.1) untuk editor visual workflow + runner.
import { startServer } from './app.js';
import { claudeVersion } from './runners/claude-cli.js';
import { apiAvailable } from './runners/api.js';
import { logger } from './lib/logger.js';

const { config, port, url } = await startServer();
const version = claudeVersion();
logger.banner([
  `Doz Studio running at ${url.replace('127.0.0.1', 'localhost')}`,
  `workdir  : ${config.getWorkdir()}`,
  `runner   : claude-cli ${version ? `✓ ${version}` : '✗'} | api ${apiAvailable() ? '✓' : '✗ (ANTHROPIC_API_KEY is not set)'}`,
  ...(port === 4317 ? [] : [`port     : ${port} (default port in use; set DOZ_STUDIO_PORT for dev mode)`]),
]);
