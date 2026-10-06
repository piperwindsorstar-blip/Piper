# Piper DJing

The public wedding site and the private desk. The crew CRM in the rest of this repository is a separate app.

```bash
npm install
npm run dev
```

The site runs at http://localhost:8080.

`/` and `/book` are the public pages. The desk is at `/login`. On this empty local book the password is `piper-local`. When `DATABASE_URL` is set, sign-in uses `DESK_PASSWORD` and this app does not create or reset that database.

Booking and invoice emails go out when `PIPER_SMTP_HOST`, `PIPER_SMTP_USER`, and `PIPER_SMTP_PASS` are set. `PIPER_SMTP_PORT` defaults to 587. `PIPER_MAIL_FROM` overrides the From line, which otherwise is Piper DJing at the public address. Without those settings the message is saved on the local book and is not sent. The published database is not given an email table.
