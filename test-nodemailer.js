const nodemailer = require("nodemailer");
require('dotenv').config({path: '.env.local'});

async function test() {
  console.log("Creating transporter...");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  console.log("Verifying connection...");
  try {
    await transporter.verify();
    console.log("Server is ready to take our messages");
  } catch (err) {
    console.error("Verify Error:", err);
    return;
  }

  console.log("Sending email...");
  try {
    const info = await transporter.sendMail({
      from: '"Agentify Test" <info@agentifychat.online>',
      to: "musaabduljnr@gmail.com",
      subject: "Direct Node.js Test",
      text: "This is a direct test from Node.js using your SMTP credentials.",
      html: "<b>This is a direct test from Node.js using your SMTP credentials.</b>",
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Response: %s", info.response);
  } catch (err) {
    console.error("Send Error:", err);
  }
}

test();
