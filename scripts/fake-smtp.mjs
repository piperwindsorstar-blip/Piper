/**
 * A throwaway SMTP server that accepts one message and prints it.
 *
 *   node scripts/fake-smtp.mjs 2525
 *
 * For proving the mail path end to end without a real mailbox. Speaks just
 * enough of the protocol for nodemailer: greeting, EHLO, AUTH, MAIL, RCPT,
 * DATA, QUIT. Nothing here is a mail server; it is a tape recorder.
 */
import net from "node:net";

const port = Number(process.argv[2] ?? 2525);
const received = [];

const server = net.createServer((socket) => {
  let inData = false;
  let body = "";

  socket.write("220 fake ESMTP\r\n");

  socket.on("data", (chunk) => {
    const text = chunk.toString();

    if (inData) {
      body += text;
      if (body.includes("\r\n.\r\n")) {
        inData = false;
        received.push(body);
        console.log("RECEIVED:", JSON.stringify(body.slice(0, 400)));
        socket.write("250 OK\r\n");
      }
      return;
    }

    for (const line of text.split("\r\n").filter(Boolean)) {
      const verb = line.split(" ")[0].toUpperCase();
      if (verb === "EHLO" || verb === "HELO") {
        socket.write("250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n");
      } else if (verb === "AUTH") {
        socket.write("235 accepted\r\n");
      } else if (verb === "MAIL" || verb === "RCPT") {
        socket.write("250 OK\r\n");
      } else if (verb === "DATA") {
        inData = true;
        socket.write("354 go ahead\r\n");
      } else if (verb === "QUIT") {
        socket.write("221 bye\r\n");
        socket.end();
      } else {
        socket.write("250 OK\r\n");
      }
    }
  });

  socket.on("error", () => {});
});

server.listen(port, "127.0.0.1", () => console.log(`fake smtp on ${port}`));
