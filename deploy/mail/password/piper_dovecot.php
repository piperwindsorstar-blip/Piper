<?php

/**
 * Password driver for Piper's Dovecot.
 *
 * Hands the change to /usr/local/sbin/piper-passwd through sudo instead of
 * writing the password file itself.
 *
 * Roundcube ships dovecot_passwdfile, which does write the file directly, and
 * that would work — at the cost of giving the web server write access to every
 * mailbox hash on the box. Anything able to run code as www-data could then
 * set every password on the server and read everyone's mail. Here www-data can
 * only ask, the helper re-checks the current password against Dovecot before
 * agreeing, and /etc/dovecot/users stays owned by root.
 *
 * Both passwords go over the pipe, never in the argument list: arguments are
 * visible in ps output to every user on the machine.
 */
class rcube_piper_dovecot_password
{
    /**
     * @param string $currpass Current password, already checked by the plugin
     * @param string $newpass  New password
     * @param string $username Login name, per password_username_format
     *
     * @return int PASSWORD_SUCCESS|PASSWORD_ERROR|PASSWORD_CONNECT_ERROR
     */
    public function save(string $currpass, string $newpass, string $username): int
    {
        $rcmail = rcmail::get_instance();
        $cmd = $rcmail->config->get('password_piper_cmd', 'sudo -n /usr/local/sbin/piper-passwd');

        $pipes = [];
        $process = proc_open(
            $cmd,
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes
        );

        if (!is_resource($process)) {
            rcube::raise_error("Password plugin: could not run {$cmd}", true);
            return PASSWORD_CONNECT_ERROR;
        }

        // A newline in either password would be read as the end of that field,
        // so the helper would receive something other than what was typed.
        // Refused here rather than silently truncated.
        foreach ([$username, $currpass, $newpass] as $field) {
            if (strpbrk($field, "\r\n") !== false) {
                foreach ($pipes as $pipe) {
                    fclose($pipe);
                }
                proc_close($process);
                return PASSWORD_ERROR;
            }
        }

        fwrite($pipes[0], $username . "\n" . $currpass . "\n" . $newpass . "\n");
        fclose($pipes[0]);

        $out = stream_get_contents($pipes[1]);
        $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        $status = proc_close($process);

        if ($status === 0 && str_contains($out, 'ok')) {
            return PASSWORD_SUCCESS;
        }

        // The helper's refusals are short and specific — "current password is
        // wrong", "no such mailbox". Worth having in the log, because the user
        // only ever sees the plugin's generic message.
        rcube::raise_error(
            'Password plugin: piper-passwd refused the change: ' . trim($err !== '' ? $err : $out),
            true
        );

        return PASSWORD_ERROR;
    }
}
