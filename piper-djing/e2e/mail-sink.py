"""A local SMTP server for the browser check: accepts any login, keeps nothing
but a log line per message."""
import sys
import time

from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult

LOG = sys.argv[1] if len(sys.argv) > 1 else '/tmp/sink.log'


class Handler:
    async def handle_DATA(self, server, session, envelope):
        with open(LOG, 'a') as f:
            f.write(f"MAIL-FROM {envelope.mail_from} TO {','.join(envelope.rcpt_tos)}\n")
        return '250 OK'


def anyone(server, session, envelope, mechanism, auth_data):
    return AuthResult(success=True)


controller = Controller(
    Handler(), hostname='127.0.0.1', port=2525,
    authenticator=anyone, auth_require_tls=False,
)
controller.start()
open(LOG, 'a').close()
while True:
    time.sleep(3600)
