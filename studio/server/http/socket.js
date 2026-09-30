// WebSocket hub: every client receives the same run events.
import { WebSocketServer } from 'ws';
import { isLocalRequest } from './middleware.js';

export function createSocketHub(server) {
  const sockets = new Set();
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (!isLocalRequest(req) || !req.url.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
    });
  });
  return {
    broadcast(message) {
      const data = JSON.stringify(message);
      for (const ws of sockets) if (ws.readyState === 1) ws.send(data);
    },
  };
}
