# Piper DJing

The public wedding site and the private desk. The crew CRM in the rest of this repository is a separate app.

```bash
npm install
npm run dev
```

The site runs at http://localhost:8080.

`/` and `/book` are the public pages. The desk is at `/login`. On this empty local book the password is `piper-local`. When `DATABASE_URL` is set, sign-in uses `DESK_PASSWORD` and this app does not create or reset that database.

Booking and invoice emails are sent from the PiperPWeddingDJ@gmail.com Gmail inbox. Set `PIPER_SMTP_PASS` to that inbox’s Gmail app password. The host defaults to `smtp.gmail.com` and the From line is Piper DJing at that address. Without the app password the message is saved on the local book and is not sent. The published database is not given an email table.
