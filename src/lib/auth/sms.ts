import { after } from 'next/server';
import { getAuthConfig } from './config';

export interface SmsOtpMessage {
  to: string;
  code: string;
}

export interface SmsProvider {
  sendOtp(message: SmsOtpMessage): Promise<void>;
}

type AfterResponse = (callback: () => Promise<void>) => void;

class AuthSmsProvider implements SmsProvider {
  async sendOtp(message: SmsOtpMessage): Promise<void> {
    const config = getAuthConfig();
    if (config.SMS_PROVIDER === 'mock' && process.env.NODE_ENV !== 'production') {
      if (process.env.NODE_ENV === 'development') {
        console.info(`[Auth SMS mock] OTP: ${message.code}`);
      }
      return;
    }

    if (config.SMS_PROVIDER !== 'twilio') {
      throw new Error('SMS_PROVIDER must be configured for production delivery');
    }

    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = config;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      throw new Error('Twilio SMS credentials are required');
    }

    const body = new URLSearchParams({
      To: message.to,
      From: TWILIO_FROM_NUMBER,
      Body: `Your CyberShield verification code is ${message.code}. It expires in 5 minutes.`,
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error(`SMS provider rejected message (${response.status})`);
  }
}

export const authSmsProvider: SmsProvider = new AuthSmsProvider();

export function scheduleOtpSms(message: SmsOtpMessage, schedule: AfterResponse = after): void {
  schedule(async () => {
    try {
      await authSmsProvider.sendOtp(message);
    } catch {
      if (process.env.NODE_ENV !== 'production' || process.env.SMS_PROVIDER) {
        console.error('[Auth SMS] OTP delivery failed');
      }
    }
  });
}
