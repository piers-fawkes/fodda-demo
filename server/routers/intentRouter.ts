import { Router, Request, Response } from 'express';
import { clerkClient } from '@clerk/express';

const router = Router();

// In-memory rate limiting: 10 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

/**
 * POST /api/intent
 * Server-side proxy for high-intent analytics & booking events.
 * Dispatches to Fodda Sales Agent webhook with HMAC / secret authentication.
 */
router.post('/', async (req: Request, res: Response) => {
  const INTENT_SECRET = process.env.INTENT_WEBHOOK_SECRET || '';
  const INTENT_URL = process.env.INTENT_WEBHOOK_URL || 'https://fodda-sales-agent-p3uz7zw7ja-uc.a.run.app/webhooks/intent';

  if (!INTENT_SECRET) {
    console.warn('[IntentRouter] INTENT_WEBHOOK_SECRET not configured');
    return res.status(503).json({ ok: false, error: 'Intent webhook not configured' });
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp, 10)) {
    return res.status(429).json({ ok: false, error: 'Too many requests' });
  }

  try {
    const { email, intent_event, parameters = {} } = req.body || {};

    if (!email || !intent_event || typeof intent_event !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(intent_event)) {
      return res.status(400).json({ ok: false, error: 'Valid email and intent_event required' });
    }

    let finalEmail = String(email).toLowerCase().trim();

    // Verify Clerk session via req.auth (clerkMiddleware)
    const auth = (req as any).auth;
    if (auth?.userId) {
      parameters.clerkUserId = auth.userId;
      const claimEmail = auth.sessionClaims?.email || auth.claims?.email;
      if (claimEmail && typeof claimEmail === 'string' && claimEmail.includes('@')) {
        finalEmail = claimEmail.toLowerCase().trim();
      } else {
        try {
          const clerkUser = await clerkClient.users.getUser(auth.userId);
          const userEmail = clerkUser.emailAddresses?.find((e: any) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress 
            || clerkUser.emailAddresses?.[0]?.emailAddress;
          if (userEmail) {
            finalEmail = userEmail.toLowerCase().trim();
          }
          if (!parameters.requesterName) {
            const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ');
            if (fullName) parameters.requesterName = fullName;
          }
        } catch (e: any) {
          console.warn('[IntentRouter] Failed to fetch Clerk user details:', e.message);
        }
      }
    }

    console.log(`[IntentRouter] Forwarding ${intent_event} for ${finalEmail} to Sales Agent webhook...`);

    const webhookRes = await fetch(INTENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fodda-webhook-secret': INTENT_SECRET,
      },
      body: JSON.stringify({
        email: finalEmail,
        intent_event,
        parameters,
        ip: clientIp,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!webhookRes.ok) {
      const errText = await webhookRes.text().catch(() => '');
      console.error(`[IntentRouter] Sales Agent webhook responded with ${webhookRes.status}: ${errText}`);
      return res.status(502).json({ ok: false, error: 'Sales Agent webhook dispatch failed' });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('[IntentRouter] Error processing intent:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
  }
});

export default router;
