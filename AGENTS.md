<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Piper runs locally against SQLite. The demo needs no hosted credentials.

- `npm ci` installs dependencies. A missing `data/piper.db` is created with `npm run db:reset`, then `npm run db:recommendations` so planner suggestions exist for `npm run smoke`.
- Dev server: `npm run dev:lan` (port 3000). Open `http://localhost:3000`. Next.js rejects dev assets when the page origin is `127.0.0.1`, and client-side actions then fail. Demo sign-in is `owner@piper.test` / `piper1234`.
- `npm run typecheck` and `npm run db:check-schema` do not need a server. `npm run smoke` and `npm run responsive` do, against that seeded database. Use the system Chrome browser: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/google-chrome`.
- `npm run lint` invokes `next lint`, which Next.js 16 removed, and this repo has no ESLint config.
