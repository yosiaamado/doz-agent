// Electron main process: prepare the env, run the Node server inside the app, then open a window pointing at its URL.
import { app, BrowserWindow, dialog, safeStorage, shell } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

app.setName('doz-studio');

let win = null;
let running = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(boot).catch(fail);
}

function fail(err) {
  dialog.showErrorBox('Doz Studio could not start', String(err?.stack ?? err));
  app.exit(1);
}

async function boot() {
  // The env must be set before the server is loaded. process.env is passed through as-is (PATH for claude/git).
  if (app.isPackaged) process.env.DOZ_RESOURCES_DIR = process.resourcesPath;
  process.env.DOZ_USER_DATA_DIR = app.getPath('userData');
  const { startServer } = await import(pathToFileURL(path.join(app.getAppPath(), 'server', 'app.js')).href);
  // API key encryption via the OS (DPAPI/Keychain). Without OS encryption, do not pass a codec: the server would log a plain-text warning.
  const secretCodec = safeStorage.isEncryptionAvailable()
    ? {
        encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
        decrypt: (cipher) => safeStorage.decryptString(Buffer.from(cipher, 'base64')),
      }
    : undefined;
  running = await startServer({ env: process.env, secretCodec });

  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Doz Studio',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
  const origin = new URL(running.url).origin;
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin === origin) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
  await win.loadURL(running.url);
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => {
  const server = running?.server;
  running = null;
  server?.closeAllConnections?.();
  server?.close();
});
