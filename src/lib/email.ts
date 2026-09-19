import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 465);
const user = process.env.SMTP_USER;
const password = process.env.SMTP_PASSWORD;
const from = process.env.MAIL_FROM || user;

export async function sendTransactionCodeEmail(to: string, code: string, type: 'TRANSFER' | 'WITHDRAWAL') {
  if (!host || !user || !password || !from) throw new Error('Email delivery is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD and MAIL_FROM.');
  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass: password } });
  const action = type === 'TRANSFER' ? 'transfer or send money' : 'withdrawal';
  await transporter.sendMail({
    from, to, subject: 'Crestline Capital security code',
    text: 'Your Crestline Capital security code is ' + code + '. It expires in 10 minutes. Use this code to confirm your ' + action + '. If you did not request this, contact support immediately.',
    html: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Crestline Capital</h2><p>Your security code for a ' + action + ' is:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">' + code + '</p><p>This code expires in 10 minutes and should never be shared with anyone.</p></div>',
  });
}
