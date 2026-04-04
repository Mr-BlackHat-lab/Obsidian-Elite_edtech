import nodemailer from "nodemailer";
import { env } from "../config/env";

interface VerificationEmailInput {
  to: string;
  name: string;
  verificationUrl: string;
}

class EmailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly smtpEnabled: boolean;

  constructor() {
    this.smtpEnabled = Boolean(env.SMTP_HOST && env.SMTP_PORT);

    if (this.smtpEnabled) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: Boolean(env.SMTP_SECURE),
        auth: env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
      });
      return;
    }

    this.transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  async sendVerificationEmail(input: VerificationEmailInput): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
        <h2 style="margin-bottom: 8px;">Verify your LearnPulse account</h2>
        <p style="line-height: 1.5;">Hi ${input.name},</p>
        <p style="line-height: 1.5;">Please confirm your email address to activate your account.</p>
        <a
          href="${input.verificationUrl}"
          style="display: inline-block; margin: 16px 0; padding: 10px 16px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;"
        >
          Verify Email
        </a>
        <p style="line-height: 1.5; font-size: 13px; color: #4b5563;">
          If the button does not work, open this link in your browser:<br />
          <a href="${input.verificationUrl}">${input.verificationUrl}</a>
        </p>
      </div>
    `;

    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: "Verify your LearnPulse account",
      html,
      text: `Verify your email by visiting: ${input.verificationUrl}`,
    });

    if (!this.smtpEnabled) {
      console.info("[Auth] SMTP is not configured. Real emails are not delivered in this mode.");
      console.info("[Auth] Use this dev verification URL:", input.verificationUrl);
    }
  }
}

export const emailService = new EmailService();
