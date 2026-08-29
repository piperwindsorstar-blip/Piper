# Webmail on mail.djpynxpro.com

Roundcube behind nginx, with one extra button: **File in Piper** sends the
message you are reading to the CRM's crew-report intake and tells you what it
made of it.

## Start here, on the mail droplet

The mail server is **not** the machine Piper runs on, so there is no checkout
of this repository there and nothing to run. Over ssh **to the mail droplet**,
as root:

```
curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/mail/bootstrap.sh -o /tmp/bootstrap.sh
bash /tmp/bootstrap.sh mail.djpynxpro.com
```

Downloaded and then run, rather than piped into a shell: you can read it
first, and there is no pipe syntax to get wrong.

That drops the installer at `/opt/piper-mail` and runs it. Re-running is safe,
and is also how you pick up a newer version of any of this.

**The token is optional.** Leave it out and everything installs; the "File in
Piper" button simply stays hidden until one is set. To include it, put a real
token on the same line — never a placeholder in angle brackets, because `<` is
input redirection in a shell and bash will answer `-bash: the: No such file or
directory`:

```
PIPER_IMPORT_TOKEN=paste_the_real_token_here bash /tmp/bootstrap.sh mail.djpynxpro.com
```

It lives in `/etc/piper.env` on the **CRM** droplet, not this one. Adding it
afterwards is fine — edit
`/var/www/roundcube/plugins/piper_report/config.inc.php` and reload PHP-FPM.

If you would rather read the whole thing before running any of it:

```
apt-get install -y git
git clone -b claude/wedding-dj-crm-sltogo \
  https://github.com/piperwindsorstar-blip/Piper.git /opt/piper
cd /opt/piper/deploy/mail
bash install-webmail.sh mail.djpynxpro.com
```

## When something is wrong

One read-only command that reports the whole state of the box — what is
installed, what is listening, which nginx site owns the name, whether the
certificate is there, what the last errors were:

```
curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/mail/doctor.sh -o /tmp/doctor.sh
bash /tmp/doctor.sh mail.djpynxpro.com
```

It changes nothing, starts nothing and stops nothing, so it is safe on a live
box. Paste its output rather than guessing which file to look at next.

## What the scripts do

`install-webmail.sh` installs Roundcube, PHP-FPM, the nginx site and the
plugin. If the box has no mail server of its own it calls
`install-mail-stack.sh` to put a small Postfix and Dovecot underneath. If it
finds a Dovecot it did not configure, it leaves it completely alone and says
so — a box already delivering mail keeps delivering it.

Both are idempotent. Re-running `install-webmail.sh` is also how you upgrade
Roundcube: bump `RC_VERSION` and `RC_SHA256` at the top and run it again. Your
`config.inc.php`, logs and preferences database survive.

## Then add a mailbox

Nobody can sign in until there is somebody to sign in as.

```
piper-mailbox add martin@mail.djpynxpro.com --generate
piper-mailbox list
piper-mailbox passwd martin@mail.djpynxpro.com --generate
piper-mailbox remove martin@mail.djpynxpro.com
```

`--generate` makes a twenty-character password, prints it once and keeps only
the hash — so it cannot be read back later. Leave the flag off to be asked for
one instead. Either way the username to sign in with is the **full address**,
not the part before the @.

Mailboxes are virtual: a line in `/etc/dovecot/users` and a Maildir under
`/var/mail/vhosts`. No system account, no shell, nothing to log into but mail.

### If that says `command not found`

Two reasons, and they need different answers.

**It is installed, but not on your PATH.** `/usr/local/sbin` is not on an
ordinary user's PATH on Ubuntu — only root's. Use `sudo`, as above, or the
full path:

```
ls -l /usr/local/sbin/piper-mailbox     # is it there?
sudo /usr/local/sbin/piper-mailbox list
```

**It was never installed**, because the droplet already had a Dovecot when
you ran the installer. In that case `install-webmail.sh` deliberately did not
touch your mail server, and `piper-mailbox` only understands the Dovecot
configuration *this* script writes — pointing it at somebody else's would
write users into a file their server never reads. Check which happened:

```
sudo doveconf -n | head -40                    # whose config is running
ls -l /etc/dovecot/conf.d/99-piper.conf        # present = Piper configured it
```

If you would rather Piper managed the mail server, hand it over explicitly:

```
sudo PIPER_FORCE_MAIL_STACK=yes bash install-webmail.sh mail.djpynxpro.com
```

That rewrites Dovecot and Postfix to the configuration described here. It
keeps existing Maildirs, but any mailbox users your old setup knew about will
have to be recreated with `piper-mailbox add`, because the user list moves to
`/etc/dovecot/users`. Read that sentence twice before running it on a box
that is already receiving mail.

## Changing your own password

**Settings → Password**, in webmail. Asks for the current one, wants at least
ten characters for the new one.

Roundcube ships a driver that writes `/etc/dovecot/users` itself. That works,
and it means the web server can rewrite every mailbox hash on the box — so
anything able to run code as `www-data` owns all the mail on it, permanently.
Instead:

- `/usr/local/sbin/piper-passwd` does the write as root and is the only thing
  `www-data` may call through sudo. It takes no arguments; the username and
  both passwords arrive on stdin, because arguments are visible in `ps` to
  every user on the machine.
- It re-checks the current password against Dovecot before writing anything,
  so `www-data` can only ask for a change it can already prove it is entitled
  to make.
- `/etc/dovecot/users` stays owned by `root:dovecot`, mode 640.

Two things that testing caught and reading would not have:

- **`doveadm auth test` exits 0 whether the password was right or wrong.**
  Only the words differ. Trusting the exit status would have accepted every
  password ever offered — the exact opposite of the point. The helper matches
  on `auth succeeded`.
- **Dovecot caches the passwd file and notices changes only to the second.**
  Two changes inside one second left the second unseen, and the superseded
  password still authenticated — reproduced, accepted in two runs out of
  three. The helper now reloads Dovecot after writing, which made it three
  rejections out of three.

## The DNS that is still missing

Checked on 29 August 2026, and this is the honest state of it:

| Record | State | Why it matters |
|---|---|---|
| A, MX, SPF | present | mail arrives |
| **PTR** (reverse DNS) | **absent** | Gmail and Outlook reject or spam-bin mail from an IP with no reverse DNS |
| **DKIM** | **absent** | `install-mail-stack.sh` generates the key and prints the record |
| **DMARC** | **absent** | tells the world what to do with mail that fails the other two |

None of these block *receiving*, so forwarding crew reports in works without
them. All three matter the moment this box sends anything outward.

- **PTR** — rename the droplet to `mail.djpynxpro.com` in the DigitalOcean
  panel. That is what sets it; there is no separate field.
- **DKIM** — the install prints the TXT record. It is also in
  `/etc/opendkim/keys/mail.djpynxpro.com/mail.txt`, split across lines that
  have to be joined into one value.
- **DMARC** — TXT at `_dmarc.mail.djpynxpro.com`:
  `v=DMARC1; p=none; rua=mailto:postmaster@mail.djpynxpro.com`.
  Start at `p=none`, read what comes back for a fortnight, then tighten.

Check the result at <https://www.mail-tester.com> — send it a message and it
grades all of the above.

## The Piper button

Adds a toolbar button in the message view. It sends the raw message —
headers included, because the `Date:` header is half of what stops a report
filing twice — to `POST /api/reports/email`, and shows what came back:

- **Filed in Piper: 26-0167** — it went in.
- **Already in Piper** — same report, nothing duplicated.
- **Piper would not take it** — with Piper's own reason, which is a sentence
  rather than a status code.

Configured in `plugins/piper_report/config.inc.php`, mode 640 and owned by
`root:www-data` because it holds the API token. The nginx site refuses to
serve it as well; the file mode is the lock that does not depend on a web
server config staying correct.

To point it somewhere else, or to turn it off, edit that file — an empty
token hides the button rather than leaving one that fails when pressed.

## What was actually tested, and what was not

Written and checked on a machine running the same nginx 1.24.0 as the droplet:

- the nginx site parses, serves, and returns **404 for
  `/plugins/piper_report/config.inc.php`** — the file with the token in it —
  as well as for `/config/`, `/installer` and dotfiles;
- the Dovecot config parses under `doveconf -n`, and a real IMAP login over
  loopback succeeds while a system account (`root`) is refused;
- port 993 serves TLS 1.3 and accepts a virtual mailbox;
- the `postconf` calls are idempotent — two runs leave exactly one
  `submission` entry in `master.cf`, and `postfix check` passes;
- the generated DKIM record was verified to match the private key on disk;
- the plugin's request and every branch of its response handling were run
  against a live Piper.

Not tested, because it needs the droplet: the install end to end as one run,
delivery of a real message from outside, and sending outward.
