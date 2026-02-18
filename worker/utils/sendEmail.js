const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, text }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    // Ensure port is a Number. Use 465 for secure, 587 for non-secure.
    port: Number(process.env.EMAIL_PORT), 
    // If port is 465, secure must be true. For 587, it must be false.
    secure: process.env.EMAIL_PORT == 465, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // Adding a timeout and TLS settings helps prevent the 'temporary' 454 error
    // debug: true, // Show detailed logs in your console
    // logger: true,
    tls: {
      rejectUnauthorized: false // Helps if you are on a restricted network (like a University)
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text
    });
    console.log("Email sent successfully to:", to);
  } catch (error) {
    console.error("Nodemailer Error:", error.message);
    throw error; // Re-throw so your controller can catch it
  }
};

module.exports = sendEmail;