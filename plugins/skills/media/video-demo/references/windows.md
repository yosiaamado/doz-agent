# Running on Windows

The engine assumes a POSIX machine: `doctor.sh` warns that the platform is unsupported, `install.sh` and `scaffold.mjs` create symlinks (Git Bash's `ln -s` copies instead, and copying the skill into its own `node_modules` fails), and the voice venv is looked up at `.venv/bin/python`, which does not exist on Windows. Don't patch around these one by one. Run it in WSL2.

1. Check WSL: `wsl -l -v`. No distro → tell the user `wsl --install -d Ubuntu` (needs admin and a reboot; theirs to run).
2. Copy the skill into the Linux filesystem once, so the engine never runs off `/mnt/c` (slow, and no real symlinks):

   ```bash
   wsl -- bash -lc 'rm -rf ~/video-demo && cp -r "$(wslpath "<this skill folder>")" ~/video-demo'
   ```

   Repeat the copy after a plugin update; it also refreshes the engine.
3. Inside WSL, Node ≥ 22.18 must exist (`node --version`); if not, pass on the install command, don't run it.
4. Run everything through `wsl -- bash -lc 'cd ~/video-demo && …'`: `scripts/doctor.sh`, `scripts/install.sh`, `scripts/install-voice.sh`, `scripts/scaffold.mjs`, `scripts/demo`.
5. `build` mode: point the scaffold at the repo through its WSL path (`/mnt/e/...`). The app's build runs inside WSL with Linux `node_modules`; if the repo's own `node_modules` was installed on Windows and contains native binaries, the build fails — say so and ask before reinstalling anything in their repo.
6. Hand the user Windows paths for the output: `\\wsl$\Ubuntu\home\<user>\.video-demo\<key>\demo-out\` (or `explorer.exe .` from inside the folder).
