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
https://piperpweddingdj.services.

Publishing is wired through `.github/workflows/deploy-site.yml` at the repository
root: a push that touches anything under `piper-djing/` on the site's branch runs
`npm ci`, `npm run build:cloudflare` and `npm run deploy`. Two repository secrets
make it work (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — a token with Workers Scripts: Edit.
- `CLOUDFLARE_ACCOUNT_ID` — from the Workers & Pages sidebar.

Cloudflare Workers Builds (Workers & Pages → piper-djing → Settings → Builds) can do
the same job with root directory `piper-djing`, build command
`npm run build:cloudflare`, deploy command `npm run deploy`. Use one or the other,
not both: two pipelines deploying one Worker overwrite each other's active version,
and Git-deployed versions are labelled in Deployments while hand-run ones read
"Manually deployed".

To deploy by hand, run the same commands from `piper-djing/` after
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
through the `.wrangler/deploy/config.json` redirect the build writes. Run it from
`piper-djing/`, not the repository root, for the same reason.

`.nvmrc` pins the build to Node 24.18.0; bump it deliberately.

The Worker's `Book` Durable Object holds the live bookings; deploying code leaves its
storage alone, and the `v1` migration in the generated config is already applied.
