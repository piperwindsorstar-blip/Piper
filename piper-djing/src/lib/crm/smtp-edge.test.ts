import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mailbox, smtpData, submitSmtp } from './smtp-edge.ts'

const encoder = new TextEncoder()

function scripted(replies: string[]) {
  const writes: string[] = []
  let cursor = 0
  const readable = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (cursor >= replies.length) {
        controller.close()
        return
      }
      cursor += 1
      controller.enqueue(encoder.encode(`${replies[cursor - 1]}\r\n`))
    },
  })
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      writes.push(new TextDecoder().decode(chunk))
    },
  })
  return {
    writes,
    socket: {
      readable,
      writable,
      startTls() {
        return scripted([
          '250-smtp.gmail.com\r\n250 AUTH LOGIN',
          '334 VXNlcm5hbWU6',
          '334 UGFzc3dvcmQ6',
          '235 Accepted',
          '250 Sender ok',
          '250 Recipient ok',
          '354 Go ahead',
          '250 Queued',
        ]).socket
      },
    },
  }
}

describe('edge smtp', () => {
  it('builds a plain letter and pulls the mailbox out of the from line', () => {
    assert.equal(
      mailbox('Piper DJing <PiperPWeddingDJ@gmail.com>'),
      'PiperPWeddingDJ@gmail.com',
    )
    const data = smtpData({
      from: 'Piper DJing <PiperPWeddingDJ@gmail.com>',
      to: 'guest@example.com',
      replyTo: 'PiperPWeddingDJ@gmail.com',
      letter: { subject: 'You are confirmed', text: 'Hello\n.secret' },
    })
    assert.match(data, /Subject: You are confirmed/)
    assert.match(data, /To: guest@example.com/)
    assert.match(data, /\r\n\.\.secret\r\n/)
    assert.match(data, /Content-Type: text\/plain; charset=utf-8/)
  })

  it('wraps an HTML card and a CSV attachment in one message', () => {
    const data = smtpData({
      from: 'Piper DJing <PiperPWeddingDJ@gmail.com>',
      to: 'guest@example.com',
      replyTo: null,
      letter: {
        subject: 'You are invited',
        text: 'You are invited',
        html: '<table><tr><td>Cream card</td></tr></table>',
        attachments: [
          {
            filename: 'caterer-report.csv',
            content: 'Name,Meal\nAda,Salmon\n',
            contentType: 'text/csv; charset=utf-8',
          },
        ],
      },
    })
    assert.match(data, /Content-Type: multipart\/mixed; boundary="piper-mixed_/)
    assert.match(
      data,
      /Content-Type: multipart\/alternative; boundary="piper-alt_/,
    )
    assert.match(data, /Content-Type: text\/html; charset=utf-8/)
    assert.match(data, /<td>Cream card<\/td>/)
    assert.match(data, /Content-Type: text\/csv; charset=utf-8/)
    assert.match(
      data,
      /Content-Disposition: attachment; filename="caterer-report.csv"/,
    )
    const encoded = Buffer.from('Name,Meal\nAda,Salmon\n').toString('base64')
    assert.ok(data.includes(encoded))
  })

  it('authenticates and accepts the message', async () => {
    const session = scripted([
      '220 ready',
      '250-smtp.gmail.com\r\n250 STARTTLS',
      '220 Ready to start TLS',
    ])
    await submitSmtp(session.socket, {
      user: 'PiperPWeddingDJ@gmail.com',
      pass: 'app-password',
      from: 'Piper DJing <PiperPWeddingDJ@gmail.com>',
      to: 'guest@example.com',
      data: 'Subject: Hi\r\n\r\nHello\r\n',
    })
    assert.match(session.writes.join(''), /STARTTLS/)
    assert.equal(
      session.writes.some((line) => line.includes('app-password')),
      false,
    )
  })
})
