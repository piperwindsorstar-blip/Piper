# Webmail on mail.djpynxpro.com

Roundcube behind nginx, with one extra button: **File in Piper** sends the
message you are reading to the CRM's crew-report intake and tells you what it
made of it.

## Start here, on the mail droplet

The mail server is **not** the machine Piper runs on, so there is no checkout
of this repository there and nothing to run. Fetch it and go, in one command,
over ssh to that box:

```
curl -fsSL https://raw.githubusercontent.com/piperwindsorstar-blip/Piper/claude/wedding-dj-crm-sltogo/deploy/mail/bootstrap.sh \
  | sudo PIPER_IMPORT_TOKEN=<the token> bash -s -- mail.djpynxpro.com
```

That drops the installer at `/opt/piper-mail` and runs it. Re-running is safe,
and is also how you pick up a newer version of any of this.

If you would rather look before you run:

```
sudo apt-get install -y git
sudo git clone -b claude/wedding-dj-crm-sltogo \
  https://github.com/piperwindsorstar-blip/Piper.git /opt/piper
cd /opt/piper/deploy/mail
sudo PIPER_IMPORT_TOKEN=<the token> bash install-webmail.sh mail.djpynxpro.com
```

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
sudo piper-mailbox add reports@mail.djpynxpro.com
sudo piper-mailbox list
sudo piper-mailbox passwd reports@mail.djpynxpro.com
```

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
