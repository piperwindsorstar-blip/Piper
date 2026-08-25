/**
 * Says, once, that this section is readable but not editable.
 *
 * The server actions already refuse — that is the check that matters. This is
 * the other half: a page that renders its forms to somebody who cannot use them
 * invites them to fill one in and watch it bounce, which reads as a bug rather
 * than a decision. So the write controls come off and this says why.
 */
export default function ReadOnly({ what }: { what: string }) {
  return (
    <div className="alert alert-info">
      <strong>You can look, but not change.</strong> {what} Ask an admin if you need to
      edit here.
    </div>
  );
}
