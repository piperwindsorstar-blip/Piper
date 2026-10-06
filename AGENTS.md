<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Piper is a single Next.js app with a local SQLite database. The core product flow does not need SMTP, an import token, or any other secret.

- Install with `npm ci`. If `data/piper.db` is missing, create the demo season with `npm run db:reset`, then load planner suggestions with `npm run db:recommendations`. Sign in as `owner@piper.test` / `piper1234` (admin) or `jordan@piper.test` / `piper1234` (DJ). The README lists the other seeded accounts.
- Run the app with `npm run dev:lan` so it listens on `0.0.0.0:3000`.
- `npm run lint` still invokes `next lint`, which Next.js 16 removed, and this repo has no ESLint config. Use `npm run typecheck` and `npm run build` instead.
- `npm run smoke` and `npm run responsive` expect a server already on port 3000 and the seeded database. Point Playwright at the image's Chrome: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/google-chrome`.
