import { useState } from 'react';
import { useLavaCheckout } from '@lavapayments/checkout';

// The Lava checkout session is minted server-side by the Fodda API
// (POST /api/checkout/lava-session). That endpoint stamps metadata.accountId +
// customer_email onto the session, which the Lava webhook (/v1/checkout/lava-webhook)
// relies on to credit the right account after payment. So we MUST go through it —
// never mint a session client-side — or purchases won't credit.
const LAVA_SESSION_ENDPOINT = 'https://api.fodda.ai/api/checkout/lava-session';

interface UseLavaWalletOptions {
  /** Fired after the customer completes checkout in the Lava overlay. */
  onSuccess?: () => void;
}

/**
 * Launches the embedded Lava PAYG wallet checkout.
 *
 * Lava has no static/redirectable checkout URL — the flow is a server-created
 * session token handed to the @lavapayments/checkout SDK, which renders a
 * dismissable full-screen overlay. The onCancel callback is what lets the user
 * close it cleanly (the old lava.so deep-link had no way out).
 */
export function useLavaWallet(opts?: UseLavaWalletOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { open } = useLavaCheckout({
    onSuccess: () => opts?.onSuccess?.(),
    onCancel: () => { /* overlay dismissed — nothing to do */ },
    onError: ({ error }) => setError(error || 'Lava checkout error'),
  });

  const launchLavaWallet = async (email?: string, accountId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(LAVA_SESSION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkout_mode: 'subscription', email, accountId }),
      });
      const data = await res.json().catch(() => ({} as any));
      const token = data.checkoutSessionToken || data.checkout_session_token;
      if (!res.ok || !token) {
        throw new Error(data.error || `Checkout unavailable (${res.status})`);
      }
      open(token);
    } catch (e: any) {
      setError(e?.message || 'Could not start Lava checkout');
    } finally {
      setLoading(false);
    }
  };

  return { launchLavaWallet, loading, error };
}
