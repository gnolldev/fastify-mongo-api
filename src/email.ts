// src/email.ts
import nodemailer from "nodemailer";
import { env } from "./env.js";

// Create a Nodemailer transporter using agnostic SMTP credentials.
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  // `secure: false` is required for port 587, which uses STARTTLS for encryption.
  secure: env.SMTP_SECURE, 
  auth: {
    user: env.SMTP_USER, // For Mailjet, this is the API Key.
    pass: env.SMTP_PASS, // For Mailjet, this is the Secret Key.
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using the configured transporter.
 * @param {SendEmailOptions} options - The email options.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  try {
    await transporter.sendMail({
      from: '"Vellum Rift" <noreply@vellumrift.com>', // Replace with your "from" email
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    // In a real app, you'd want more robust error handling here.
  }
}
