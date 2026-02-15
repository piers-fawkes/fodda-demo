
import nodemailer from 'nodemailer';
import { EMAIL_TEMPLATES } from './emailTemplates';

// Configuration
const EMAIL_CONFIG = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
};

// Create Transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

export const sendSystemEmail = async (
    templateKey: keyof typeof EMAIL_TEMPLATES,
    to: string,
    data: any = {}
) => {
    const template = EMAIL_TEMPLATES[templateKey];
    if (!template) {
        console.error(`[EmailService] Template ${templateKey} not found.`);
        return false;
    }

    const subject = template.subject;
    const text = template.body(data);

    // Development Fallback: If credentials aren't set, just log it.
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('--- [MOCK EMAIL] ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('Body:');
        console.log(text);
        console.log('--- [END MOCK] ---');
        return true;
    }

    try {
        const info = await transporter.sendMail({
            from: `"Piers at Fodda" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            // html: ... (Could add HTML version if needed later)
        });

        console.log(`[EmailService] Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('[EmailService] Error sending email:', error);
        return false;
    }
};
