<?php

/**
 * File a crew report into Piper, from the message you are looking at.
 *
 * Webmail on its own would mean reading a report in one tab and pasting it
 * into the CRM in another. The forward-a-report page already takes a whole
 * raw email and files it, so the only thing missing was a button — this is
 * that button. The message goes to Piper exactly as it arrived, headers and
 * all, because the Date: header is half of what stops a report filing twice.
 *
 * Nothing is parsed here. Piper owns what a crew report looks like, and a
 * second implementation living in a mail plugin is a second thing to keep in
 * step every time the form changes. This sends bytes and shows the answer.
 *
 * @author Piper
 */
class piper_report extends rcube_plugin
{
    /** Mail only — there is nothing to file from the address book. */
    public $task = 'mail';

    /** @var rcmail */
    private $rcube;

    #[\Override]
    public function init()
    {
        $this->rcube = rcmail::get_instance();
        $this->load_config();

        // Pointed at nothing means no button at all, rather than a button that
        // fails when somebody presses it.
        if (!$this->endpoint() || !$this->token()) {
            return;
        }

        $this->register_action('plugin.piper_report.file', [$this, 'file_message']);
        $this->add_texts('localization/', true);

        // The list and the message view. Filing from the list is deliberate:
        // a night's reports arrive together and get filed together.
        if ($this->rcube->action == '' || $this->rcube->action == 'show') {
            $this->include_script('piper_report.js');
            $this->include_stylesheet($this->local_skin_path() . '/piper_report.css');

            $this->add_button([
                'command' => 'plugin.piper_report.file',
                'type' => 'link',
                'class' => 'button buttonPas piperfile disabled',
                'classact' => 'button piperfile',
                'classsel' => 'button piperfile pressed',
                'title' => 'piper_report.buttontitle',
                'innerclass' => 'inner',
                'label' => 'piper_report.buttonlabel',
            ], 'toolbar');
        }
    }

    private function endpoint(): ?string
    {
        $url = $this->rcube->config->get('piper_report_endpoint');

        return is_string($url) && $url !== '' ? rtrim($url, '/') : null;
    }

    private function token(): ?string
    {
        $token = $this->rcube->config->get('piper_report_token');

        return is_string($token) && $token !== '' ? $token : null;
    }

    /**
     * Sends the selected messages to Piper, one at a time.
     *
     * One at a time rather than in a batch because the interesting answer is
     * per-report — "job 26-0167 filed, 26-0171 was already in" is worth more
     * than "2 of 3 succeeded", and a crew manager reading it needs to know
     * which one to go and look at.
     */
    public function file_message()
    {
        $uids = rcube_utils::get_input_value('_uid', rcube_utils::INPUT_POST);
        $uids = is_array($uids) ? $uids : preg_split('/\s*,\s*/', (string) $uids, -1, \PREG_SPLIT_NO_EMPTY);

        if (empty($uids)) {
            $this->rcube->output->show_message($this->gettext('nothingselected'), 'warning');
            $this->rcube->output->send();
            return;
        }

        // A sane ceiling. Each one is an HTTP round trip and the request has to
        // finish inside PHP's own time limit; past this it belongs in the
        // nightly sync, not in somebody's browser.
        $limit = (int) $this->rcube->config->get('piper_report_max_batch', 20);
        if (count($uids) > $limit) {
            $this->rcube->output->show_message($this->gettext('toomany'), 'error');
            $this->rcube->output->send();
            return;
        }

        $filed = [];
        $skipped = [];
        $failed = [];

        foreach ($uids as $uid) {
            [$folder, $id] = $this->split_uid($uid);
            if ($folder !== null) {
                $this->rcube->storage->set_folder($folder);
            }

            $raw = $this->rcube->storage->get_raw_body($id);
            if (!$raw) {
                $failed[] = $this->gettext('couldnotread');
                continue;
            }

            $answer = $this->send($raw);

            if ($answer['ok'] && ($answer['body']['inserted'] ?? 0) > 0) {
                $filed[] = (string) ($answer['body']['job'] ?? '?');
            } elseif ($answer['ok']) {
                // Filed before, or filed as a test entry. Neither is a problem
                // and neither should read like one.
                $skipped[] = (string) ($answer['body']['job'] ?? '?');
            } else {
                $failed[] = $answer['reason'];
            }
        }

        // Said in the order that matters: what went wrong first, because that
        // is the part somebody has to do something about.
        if ($failed) {
            $this->rcube->output->show_message(
                $this->gettext('somefailed') . ' ' . implode(' ', array_unique($failed)),
                'error'
            );
        }
        if ($filed) {
            $this->rcube->output->show_message(
                $this->gettext('filed') . ' ' . implode(', ', $filed),
                'confirmation'
            );
        }
        if ($skipped) {
            $this->rcube->output->show_message(
                $this->gettext('alreadyfiled') . ' ' . implode(', ', $skipped),
                'notice'
            );
        }

        $this->rcube->output->send();
    }

    /**
     * Splits Roundcube's "uid-folder" form back into its two halves.
     *
     * A multi-folder search returns uids with the folder glued on, and reading
     * one of those against the current folder either fails or — worse — reads
     * whatever message happens to hold that number somewhere else.
     */
    private function split_uid(string $uid): array
    {
        if (preg_match('/^(\d+)-(.+)$/', $uid, $m)) {
            return [$m[2], $m[1]];
        }

        return [null, $uid];
    }

    /**
     * One POST to Piper, and a reason rather than an exception if it fails.
     */
    private function send(string $raw): array
    {
        try {
            $response = $this->rcube->get_http_client()->request(
                'POST',
                $this->endpoint(),
                [
                    'headers' => [
                        'Authorization' => 'Bearer ' . $this->token(),
                        'Content-Type' => 'text/plain; charset=utf-8',
                    ],
                    'body' => $raw,
                    // Piper answers 401 and 422 on purpose, and both carry a
                    // message worth showing. Letting Guzzle throw on those
                    // would turn a sentence a person can act on into a stack
                    // trace in a log nobody reads.
                    'http_errors' => false,
                ]
            );
        } catch (\Exception $e) {
            rcube::raise_error([
                'code' => 600,
                'file' => __FILE__,
                'line' => __LINE__,
                'message' => 'piper_report: ' . $e->getMessage(),
            ], true, false);

            return ['ok' => false, 'reason' => $this->gettext('unreachable')];
        }

        $status = $response->getStatusCode();
        $body = json_decode((string) $response->getBody(), true);

        if ($status === 200 && is_array($body)) {
            return ['ok' => true, 'body' => $body];
        }

        // Piper's own refusals say why in plain words. Prefer that to a number.
        if (is_array($body) && !empty($body['error'])) {
            return ['ok' => false, 'reason' => (string) $body['error']];
        }

        return ['ok' => false, 'reason' => $this->gettext('badstatus') . ' ' . $status];
    }
}
