/**
 * The "File in Piper" button.
 *
 * Enabled when something is selected and disabled when nothing is, which is
 * the difference between a button that does nothing and a button that looks
 * like it should not be pressed yet.
 */

rcube_webmail.prototype.piper_report_file = function () {
    var uids = this.env.uid ? [this.env.uid] : (this.message_list ? this.message_list.get_selection() : null);

    if (!uids || !uids.length) {
        return;
    }

    // The busy lock matters more here than on a local action: this waits on
    // Piper over the network, and without it the button looks ignored.
    var lock = this.set_busy(true, 'piper_report.filing');
    this.http_post('plugin.piper_report.file', this.selection_post_data({ _uid: uids }), lock);
};

if (window.rcmail) {
    rcmail.addEventListener('init', function () {
        rcmail.register_command('plugin.piper_report.file', function () {
            rcmail.piper_report_file();
        }, rcmail.env.uid);

        if (rcmail.message_list) {
            rcmail.message_list.addEventListener('select', function (list) {
                rcmail.enable_command('plugin.piper_report.file', list.get_selection(false).length > 0);
            });
        }
    });
}
