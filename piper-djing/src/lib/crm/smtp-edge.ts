import type { Letter } from './mail-copy.ts'

type MailSocket = {
  readable: ReadableStream<Uint8Array>
  writable: WritableStream<Uint8Array>
  startTls: () => MailSocket
}

const encoder = new TextEncoder()

export function mailbox(from: string): string {
  const wrapped = from.match(/<([^<>\s]+)>/u)
  return (wrapped?.[1] ?? from).trim()
}

export function smtpData(input: {
  from: string
  to: string
  replyTo: string | null
  letter: Letter
}): string {
  const subject = input.letter.subject.replace(/[\r\n]+/gu, ' ').trim()
  const headers = [
    `From: ${input.from.replace(/[\r\n]+/gu, ' ').trim()}`,
    `To: ${input.to}`,
    input.replyTo ? `Reply-To: ${input.replyTo}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
  ].filter(Boolean)
  const body = input.letter.text
    .replace(/\r\n/gu, '\n')
    .replace(/\r/gu, '\n')
    .split('\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n')
  return `${headers.join('\r\n')}\r\n\r\n${body}\r\n`
}

async function readReply(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder()
  let text = ''
  while (!/(^|\n)\d{3} /u.test(text)) {
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
    if (text.length > 8000) break
  }
  return text.trim()
}

function code(reply: string): string {
  const match = reply.match(/(^|\n)(\d{3}) /u)
  return match?.[2] ?? ''
}

async function say(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  command: string,
  ok: string,
) {
  await writer.write(encoder.encode(`${command}\r\n`))
  const reply = await readReply(reader)
  if (code(reply) !== ok) {
    throw new Error(
      reply.replace(/\s+/gu, ' ').slice(0, 180) ||
        'The mail server refused the message.',
    )
  }
  return reply
}

/** Gmail on the worker: plain SMTP, then STARTTLS. Nodemailer's upgrade fails here. */
export async function submitSmtp(
  socket: MailSocket,
  input: {
    user: string
    pass: string
    from: string
    to: string
    data: string
  },
): Promise<void> {
  const writer = socket.writable.getWriter()
  const reader = socket.readable.getReader()
  const greeting = await readReply(reader)
  if (code(greeting) !== '220') {
    throw new Error('The mail server did not greet us.')
  }
  await say(writer, reader, 'EHLO piperpweddingdj.services', '250')
  await say(writer, reader, 'STARTTLS', '220')
  writer.releaseLock()
  reader.releaseLock()
  const secure = socket.startTls()
  const secureWriter = secure.writable.getWriter()
  const secureReader = secure.readable.getReader()
  try {
    await say(
      secureWriter,
      secureReader,
      'EHLO piperpweddingdj.services',
      '250',
    )
    await say(secureWriter, secureReader, 'AUTH LOGIN', '334')
    await say(secureWriter, secureReader, btoa(input.user), '334')
    await say(secureWriter, secureReader, btoa(input.pass), '235')
    await say(
      secureWriter,
      secureReader,
      `MAIL FROM:<${mailbox(input.from)}>`,
      '250',
    )
    await say(secureWriter, secureReader, `RCPT TO:<${input.to}>`, '250')
    await say(secureWriter, secureReader, 'DATA', '354')
    await secureWriter.write(encoder.encode(`${input.data}\r\n.\r\n`))
    const queued = await readReply(secureReader)
    if (code(queued) !== '250') {
      throw new Error(
        queued.replace(/\s+/gu, ' ').slice(0, 180) ||
          'The message was not accepted.',
      )
    }
    await secureWriter.write(encoder.encode('QUIT\r\n'))
  } finally {
    await secureWriter.close().catch(() => undefined)
  }
}

export async function sendEdgeMail(
  smtp: { user: string; pass: string; from: string; replyTo: string | null },
  to: string,
  letter: Letter,
): Promise<{ delivered: boolean; detail: string }> {
  const address = to.trim()
  if (!/^[^\s@<>]+@[^\s@<>]+$/u.test(address)) {
    return { delivered: false, detail: 'That email address cannot be used.' }
  }
  try {
    const { connect } = await import('cloudflare:sockets')
    const socket = connect(
      { hostname: 'smtp.gmail.com', port: 587 },
      { secureTransport: 'starttls', allowHalfOpen: false },
    )
    await Promise.race([
      submitSmtp(socket, {
        user: smtp.user,
        pass: smtp.pass,
        from: smtp.from,
        to: address,
        data: smtpData({
          from: smtp.from,
          to: address,
          replyTo: smtp.replyTo,
          letter,
        }),
      }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error('The mail server did not answer.')),
          20_000,
        )
      }),
    ])
    return { delivered: true, detail: 'Sent.' }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'The mail server refused the message.'
    return { delivered: false, detail: message.slice(0, 500) }
  }
}
