import { after } from 'next/server';

export interface AuthEmail {
  to: string;
  subject: string;
  actionUrl: string;
  purpose: 'verify_email' | 'reset_password';
}

export interface EmailProvider {
  send(message: AuthEmail): Promise<void>;
}

type AfterResponse = (callback: () => Promise<void>) => void;

export function scheduleAuthEmail(message: AuthEmail, schedule: AfterResponse = after): void {
  schedule(async () => {
    try {
      await authEmailProvider.send(message);
    } catch {
      console.error(`[Auth email] ${message.purpose} delivery failed`);
    }
  });
}

class AuthEmailProvider implements EmailProvider {
  async send(message: AuthEmail): Promise<void> {
    const provider = process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === 'production' ? '' : 'mock');
    if (provider === 'mock' && process.env.NODE_ENV !== 'production') {
      console.info(`[Auth email mock] ${message.purpose} message queued`);
      return;
    }

    if (provider !== 'resend') {
      throw new Error('EMAIL_PROVIDER must be configured to resend in production');
    }
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.AUTH_EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error('RESEND_API_KEY and AUTH_EMAIL_FROM are required for email delivery');
    }

    const actionLabel = message.purpose === 'verify_email' ? 'Verify your email' : 'Reset your password';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: `<p>${actionLabel} for your CyberShield account:</p><p><a href="${escapeHtml(message.actionUrl)}">${actionLabel}</a></p><p>This link expires in 15 minutes. If you did not request this, ignore this email.</p>`,
        text: `${actionLabel} for your CyberShield account: ${message.actionUrl}\nThis link expires in 15 minutes. If you did not request this, ignore this email.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Email provider rejected message (${response.status})`);
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

export const authEmailProvider: EmailProvider = new AuthEmailProvider();
