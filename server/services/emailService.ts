
import nodemailer from 'nodemailer';
import { EMAIL_TEMPLATES } from './emailTemplates';

// ─── Transport Routing ───
// "personal" = Piers' Gmail (warm, human touch for onboarding prompts)
// "formal"   = Resend (transactional emails from Fodda brand)
// "internal" = Piers' Gmail (admin alerts, internal notifications)
type EmailTransport = 'personal' | 'formal' | 'internal';

const TEMPLATE_TRANSPORT: Record<string, EmailTransport> = {
  // Personal — from Piers' Gmail
  ONBOARDING_PROMPTS: 'personal',
  CLIENT_WELCOME_PROMPTS: 'personal',
  DEVELOPER_ONBOARDING: 'personal',
  WELCOME_EMAIL: 'personal',

  // Internal — admin alerts to Piers
  PROMPT_VALIDATION_ALERT: 'internal',
  EXPERT_GRAPH_SUBMITTED_ADMIN: 'internal',

  // Formal — transactional from Fodda via Resend
  OAUTH_WELCOME: 'formal',
  SIGNUP_CONFIRMATION: 'formal',
  PLAN_LIMIT_WARNING: 'formal',
  LAPSED_NOTIFICATION: 'formal',
  MAGIC_LINK_LOGIN: 'formal',
  NEW_USER_JOINED: 'formal',
  PLAN_UPGRADED: 'formal',
  TOP_UP_CONFIRMED: 'formal',
  EXPERT_GRAPH_APPROVED: 'formal',
  EXPERT_GRAPH_FEEDBACK: 'formal',
  EXPERT_GRAPH_DECLINED: 'formal',
  PARTNER_WELCOME: 'formal',
  SUBSCRIPTION_CANCELLED: 'formal',
  PAYMENT_UNMATCHED_ADMIN: 'internal',
  PAYMENT_UNMATCHED_BUYER: 'formal',
  OVERAGE_ACTIVATED: 'formal',
  OVERAGE_PAYMENT_FAILED: 'formal',
  AGENT_PAYMENT_NUDGE: 'formal',
  EXPERT_ONBOARDING_STALLED: 'formal',
  EXPERT_ONBOARDING_RESUME: 'formal',
};

// ─── Gmail (nodemailer) ───
const EMAIL_CONFIG = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
};

const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// ─── Resend (HTTP API) ───
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = 'Fodda <team@fodda.ai>';

async function sendViaResend(to: string, subject: string, text: string, html?: string, cc?: string[], scheduledAt?: string, idempotencyKey?: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[EmailService] RESEND_API_KEY not set, falling back to Gmail');
    return false; // Caller should fall back to Gmail
  }

  try {
    const payload: any = {
      from: RESEND_FROM,
      to: [to],
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    };

    if (cc && cc.length > 0) {
      payload.cc = cc;
    }

    if (scheduledAt) {
      payload.scheduledAt = scheduledAt;
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    };

    // Resend dedupes requests sharing an Idempotency-Key (24h window) — guards
    // against duplicate sends when a caller fires the same email more than once.
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[EmailService/Resend] API error ${res.status}: ${errText}`);
      return false;
    }

    const data = await res.json();
    console.log(`[EmailService/Resend] Email sent: ${data.id}`);
    return true;
  } catch (error) {
    console.error('[EmailService/Resend] Error:', error);
    return false;
  }
}

async function sendViaGmail(to: string, subject: string, text: string, html?: string, cc?: string[]): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_EMAIL) {
    console.log('--- [MOCK EMAIL] ---');
    console.log(`To: ${to}`);
    if (cc) console.log(`CC: ${cc.join(', ')}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text.substring(0, 100)}...`);
    if (html) {
      console.log('HTML available');
    }
    console.log('--- [END MOCK] ---');
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Piers at Fodda" <${process.env.EMAIL_USER}>`,
      to,
      cc,
      subject,
      text,
      html,
    });
    console.log(`[EmailService/Gmail] Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('[EmailService/Gmail] Error:', error);
    return false;
  }
}

// ─── Main Send Function ───
export const sendSystemEmail = async (
    templateKey: keyof typeof EMAIL_TEMPLATES,
    to: string,
    data: any = {},
    options: { cc?: string[]; scheduledAt?: string; idempotencyKey?: string } = {}
) => {
    const template = EMAIL_TEMPLATES[templateKey];
    if (!template) {
        console.error(`[EmailService] Template ${templateKey} not found.`);
        return false;
    }

    const subject = typeof template.subject === 'function' ? template.subject(data) : template.subject;
    const text = template.body(data);
    const html = template.html ? template.html(data) : undefined;
    const { cc, scheduledAt, idempotencyKey } = options;

    const transport = TEMPLATE_TRANSPORT[templateKey] || 'formal';

    if (transport === 'formal') {
      // Try Resend first, fall back to Gmail if Resend isn't configured
      const resendOk = await sendViaResend(to, subject, text, html, cc, scheduledAt, idempotencyKey);
      if (!resendOk) {
        console.log(`[EmailService] Resend unavailable for ${templateKey}, falling back to Gmail`);
        return sendViaGmail(to, subject, text, html, cc);
      }
      return resendOk;
    } else {
      // Personal or internal → Gmail
      return sendViaGmail(to, subject, text, html, cc);
    }
};

// ─── Direct Resend send (for custom email bodies like partner invites) ───
export const sendDirectEmail = async (
  to: string,
  subject: string,
  text: string,
  transport: EmailTransport = 'formal'
): Promise<boolean> => {
  if (transport === 'formal') {
    const resendOk = await sendViaResend(to, subject, text);
    if (!resendOk) return sendViaGmail(to, subject, text);
    return resendOk;
  }
  return sendViaGmail(to, subject, text);
};
