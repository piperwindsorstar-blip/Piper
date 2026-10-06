# Piper DJing

The public wedding site and the private desk. The crew CRM in the rest of this repository is a separate app.

```bash
npm install
npm run dev
```

The site runs at http://localhost:8080.

`/` and `/book` are the public pages. The desk is at `/login`. On this empty local book the password is `piper-local`. When `DATABASE_URL` is set, sign-in uses `DESK_PASSWORD` and this app does not create or reset that database.
