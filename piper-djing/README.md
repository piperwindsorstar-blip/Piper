# Piper DJing

The public wedding site and the private desk. The crew CRM in the rest of this repository is a separate app.

```bash
npm install
npm run dev
```

The site runs at http://localhost:8080.

`/` and `/book` are the public pages. The desk is at `/login`. On this empty local book the password is `piper-local`. When `DATABASE_URL` is set, sign-in uses `DESK_PASSWORD` and this app does not create or reset that database.

Booking and invoice emails are sent from the PiperPWeddingDJ@gmail.com Gmail inbox. Set `PIPER_SMTP_PASS` to that inbox’s Gmail app password. The host defaults to `smtp.gmail.com` and the From line is Piper DJing at that address. Without the app password the message is saved on the local book and is not sent. The published database is not given an email table.

## Deploying

The site is the `piper-djing` Worker on Cloudflare, serving
https://piperpweddingdj.services. Cloudflare Workers Builds publishes it, so it is
configured in the Cloudflare dashboard (Workers & Pages → piper-djing → Settings →
Builds) rather than here:

- Root directory: `piper-djing`
- Build command: `npm run build:cloudflare`
- Deploy command: `npm run deploy`
- Production branch: the branch the site work lands on — the repository's default
  branch holds the CRM and has no `piper-djing/` directory at all.

Nothing else publishes this Worker, so a commit that never reaches that branch never
goes live. `.nvmrc` pins the build's Node to 24.18.0; push a newer one deliberately.

To deploy by hand, run the same two commands from `piper-djing/` after
`npx wrangler login` (or with `CLOUDFLARE_API_TOKEN` set):

```bash
npm ci
npm run build:cloudflare
npm run deploy
```

Use `build:cloudflare`, never plain `npm run build`: the Cloudflare preset only turns
on when `NITRO_PRESET` is set, and without it the build emits a Node server that
`wrangler deploy` cannot publish. `npm run deploy` alone is not enough either — it
needs that build to have just run, because Wrangler reaches the generated config
through the `.wrangler/deploy/config.json` redirect the build writes.

The Worker's `Book` Durable Object holds the live bookings; deploying code leaves its
storage alone, and the `v1` migration in the generated config is already applied.
