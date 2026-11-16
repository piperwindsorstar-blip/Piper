/**
 * Checks on what a visitor types into the public /book forms. The desk and the
 * bots can still enter past dates (old weddings, records); only the website's
 * own inquiry forms are held to these.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** An error for a date the public form should not accept, or null. */
export function publicDateProblem(
  date: string,
  today: string,
  label = 'The date',
): string | null {
  const value = date.trim()
  if (!ISO_DATE.test(value)) return 'Choose a date.'
  if (value < today) return `${label} has already passed. Choose a date from today on.`
  return null
}

/** A phone number needs 7 to 15 digits; spaces, dashes, dots, brackets and + are fine. */
export function phoneProblem(phone: string, required: boolean): string | null {
  const value = phone.trim()
  if (!value) return required ? 'Enter a phone number.' : null
  if (!/^[\d\s().+\-]+$/.test(value)) return 'Enter a phone number using digits.'
  const digits = value.replace(/\D/g, '').length
  if (digits < 7 || digits > 15) return 'Enter a full phone number.'
  return null
}

/** Only The Main Event (the full wedding day) takes a stag and doe on its own date. */
export function stagAllowed(packageId: string): boolean {
  return packageId === 'full'
}
