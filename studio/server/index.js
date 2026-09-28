// doz-studio: server lokal (127.0.0.1) untuk editor visual workflow + runner.
import { createApp } from './app.js';
import { claudeVersion } from './runners/claude-cli.js';
import { apiAvailable } from './runners/api.js';
import { logger } from './lib/logger.js';

const { server, config } = createApp();

server.listen(config.port, '127.0.0.1', () => {
  const version = claudeVersion();
  logger.banner([
    `Doz Studio jalan di http://localhost:${config.port}`,
    `workdir  : ${config.getWorkdir()}`,
    `runner   : claude-cli ${version ? `✓ ${version}` : '✗'} | api ${apiAvailable() ? '✓' : '✗ (ANTHROPIC_API_KEY belum di-set)'}`,
  ]);
});
