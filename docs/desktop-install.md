# Doz Studio — Installation guide (Windows)

## Install

1. Download `Doz-Studio-Setup-<version>-x64.exe`.
2. Double-click it. Windows will show a SmartScreen warning (see below — v1 isn't signed yet).
3. Follow the installation wizard (pick a folder if you want), then open **Doz Studio** from the Start Menu or the desktop.

There's no need to install Node or npm, or to open a terminal.

## The SmartScreen warning ("Windows protected your PC")

Version 1 doesn't use code signing yet, so Windows shows the blue **"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting"** screen with Publisher: *Unknown publisher*. This is normal for a new application without a certificate; it isn't a sign the file is dangerous.

How to get past it:

1. Click **More info** (the small text below the message).
2. A **Run anyway** button appears. Click it.
3. If a UAC / installation dialog appears, continue as usual.

If the file was downloaded through a browser and Windows blocks it: right-click the installer → **Properties** → tick **Unblock** at the bottom → **OK**, then run it again.

Verification (optional): compare the hash against the one listed on the release page: `Get-FileHash .\Doz-Studio-Setup-<version>-x64.exe -Algorithm SHA256`.

## What must already be on the machine

- **The Claude Code CLI** (`claude`) and **git**, if you use the CLI runner or the GitHub features. The app doesn't bundle either. The "Setup" wizard tells you if they aren't found.
- GUI applications on Windows sometimes use a different PATH than the terminal. If `claude`/`git` are detected in a terminal but not in the app: reinstall with the "for all users" option, or make sure their folder is on the system/user PATH (not just for the terminal session), then restart the app.
- The API runner only needs an Anthropic API key (entered in Settings).

## Data location

| OS | Folder |
| --- | --- |
| Windows | `%APPDATA%\doz-studio` |
| macOS | `~/Library/Application Support/doz-studio` |
| Linux | `$XDG_CONFIG_HOME/doz-studio` (default `~/.config/doz-studio`) |

Contents: `config.json` (workdir, API key, sources), `usage.json`, `plugins/` (a copy of the agents/skills/workflows that you can edit), `backups/`. The API key is stored encrypted using your Windows account protection, so only the same Windows account on the same computer can read it. Don't share this folder.

**Close the app with the X button (or the quit menu).** If the app is force-closed (for example through Task Manager, a sudden power loss, or a crash) before it has ever been closed normally after you saved your API key, the saved key may become unreadable and you will need to enter it again in Settings. Nothing else is lost. Once the app has been closed normally one time, this no longer happens.

## Updates

- The **Check for updates** button replaces only the plugin files and web assets. Plugin files you've edited are not overwritten without your approval (a backup is made).
- The application version (the binary) is not updated automatically: download the new installer and run it; your data stays safe because it lives in the app-data folder.

## Reset / uninstall

- Reset to a clean state: close the app and delete the app-data folder above (the `plugins/` folder is recreated from the bundle).
- Uninstall: Settings → Apps → Doz Studio → Uninstall. The app-data folder is deliberately left behind; delete it manually if you want a clean slate.
