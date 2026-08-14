# Agent Git Runbook — Valuable

> Read this BEFORE committing or pushing. Following it avoids every known pitfall in this repo.

## Repository facts (verified)
- Remote: `https://github.com/Gggffrrrddd/valuable.git`
- GitHub username is **`Gggffrrrddd`** — ends with **three d's**.
  A URL ending in `fff` is a typo and causes `remote: Repository not found.`
- Default branch: **`main`**
- Authentication: ALREADY handled by Windows Credential Manager on this machine
  (target `git:https://github.com`, user `Gggffrrrddd`). **No password, token, or
  sign-in popup is needed for push.** Never store credentials in this repo.

## Commit identity (required — no global git identity is configured)
Use inline flags on every commit/merge:

```powershell
git -c user.name="Gggffrrrddd" -c user.email="Gggffrrrddd@users.noreply.github.com" commit -m "your message"
```

Optional one-time fix (run manually once, then inline flags are unnecessary):

```powershell
git config user.name "Gggffrrrddd"
git config user.email "Gggffrrrddd@users.noreply.github.com"
```

## Commit + push runbook (PowerShell)
1. `npm run typecheck` — must pass.
2. `npm run lint` — 0 errors required (warnings acceptable, same as existing repo state).
3. Review staged files: `git status --short`. Never commit:
   - `supabase/.temp/` (local CLI state + certificates — already gitignored)
   - `.env` (already gitignored)
   - scratch files (`*.tmp`, helper scripts)
4. Stage and commit:
   ```powershell
   git add -A
   git -c user.name="Gggffrrrddd" -c user.email="Gggffrrrddd@users.noreply.github.com" commit -m "message"
   ```
5. Push: `git push origin main`

## PowerShell pitfalls (learned the hard way)
- `&&` is NOT supported — chain with `;`
- Very long one-line commands corrupt the terminal (PSReadLine buffer bug).
  Keep commands short; for multi-step git surgery, write a small `.ps1` file and
  run it with `powershell -NoProfile -ExecutionPolicy Bypass -File script.ps1`,
  then delete the script.
- `git rm` uses `-q`, NOT `--quiet` (`--quiet` fails silently when stderr is redirected).

## Starting from a fresh download (no `.git` folder)
```powershell
git init
git remote add origin https://github.com/Gggffrrrddd/valuable.git
git fetch origin
git checkout -b main origin/main        # continue on the existing remote history
```
Do NOT make a fresh root commit and force-push — it destroys the repo history.

## Project environment note
There is no `.env` in the repo. Supabase features need:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (see `src/lib/supabase.ts` — client
creation is guarded, so the app still mounts without them).
