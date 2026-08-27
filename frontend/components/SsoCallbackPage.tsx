import React, { useEffect, useState } from 'react';
import { AuthenticateWithRedirectCallback, useUser } from '@clerk/react';
import { GateFrame, Eyebrow, FieldRule, Btn, Masthead, WaxSeal } from './AuthGateAtoms';
import { isValidRedirectUrl } from '../../shared/redirectAllowlist';

/**
 * SsoCallbackPage
 *
 * Handles the OAuth redirect back from Clerk after a user signs in / signs up
 * via Google or LinkedIn.
 *
 * Flow:
 *   1. <AuthenticateWithRedirectCallback /> completes the Clerk session.
 *   2. If sessionStorage('fodda.oauthPending') is set (written by AuthGate
 *      before the redirect), we show a "tell us a bit more" modal to collect
 *      company + job title. These are not available from OAuth providers.
 *   3. After the user submits, we PATCH /api/auth/patch-oauth-metadata so the
 *      Clerk user's unsafeMetadata and the Airtable User record are both updated.
 *   4. Redirect to / — App.tsx's Clerk session sync picks up from there.
 */
export const SsoCallbackPage: React.FC = () => {
  const [callbackDone, setCallbackDone] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false);

  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [apiUse, setApiUse] = useState('Mainly Claude');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { user, isLoaded: isUserLoaded } = useUser();

  // Once Clerk has finished and user object is available, decide next step
  useEffect(() => {
    if (!callbackDone || !isUserLoaded || !user) return;

    // Fast-path resume for connector consent if pendingOAuthResume / pendingOAuthRedirect is stashed
    const pendingResume = sessionStorage.getItem('fodda.pendingOAuthResume') || sessionStorage.getItem('fodda.pendingOAuthRedirect');
    if (pendingResume && isValidRedirectUrl(pendingResume)) {
      sessionStorage.removeItem('fodda.pendingOAuthResume');
      sessionStorage.removeItem('fodda.pendingOAuthRedirect');
      sessionStorage.removeItem('fodda.oauthPending');
      window.location.replace('/?redirect_url=' + encodeURIComponent(pendingResume));
      return;
    }

    const pendingProvider = sessionStorage.getItem('fodda.oauthPending');
    if (pendingProvider) {
      // Pre-fill name from OAuth profile if available
      // Show extra fields prompt
      setShowExtraFields(true);
    } else {
      // Returning user — no extra fields needed, go straight to app
      window.location.replace('/');
    }
  }, [callbackDone, isUserLoaded, user]);

  const handleExtraFieldsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !jobTitle.trim()) {
      setError('Company and job title are required.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      // Update Clerk unsafeMetadata so the webhook handler has the right fields
      // (for new users, user.created webhook fires before we get here, so we also
      //  call the server PATCH to update Airtable directly)
      await user?.update({
        unsafeMetadata: {
          ...(user.unsafeMetadata || {}),
          company,
          jobTitle,
          apiUse,
          signupIntent: 'account',
        },
      });

      // Patch Airtable record via API (authenticated via Clerk session)
      const res = await fetch('/api/auth/patch-oauth-metadata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, jobTitle, apiUse }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn('[SsoCallback] patch-oauth-metadata failed:', data.error);
        // Non-fatal — the Clerk unsafeMetadata update above is the source of truth
        // for future webhook syncs; the Airtable record can be lazily fixed.
      }
    } catch (err: any) {
      console.error('[SsoCallback] Extra fields submission error:', err);
      // Non-fatal — continue to app
    } finally {
      sessionStorage.removeItem('fodda.oauthPending');
      const pendingResume = sessionStorage.getItem('fodda.pendingOAuthResume') || sessionStorage.getItem('fodda.pendingOAuthRedirect');
      if (pendingResume && isValidRedirectUrl(pendingResume)) {
        sessionStorage.removeItem('fodda.pendingOAuthResume');
        sessionStorage.removeItem('fodda.pendingOAuthRedirect');
        window.location.replace('/?redirect_url=' + encodeURIComponent(pendingResume));
      } else {
        window.location.replace('/');
      }
    }
  };

  const API_USE_OPTIONS: [string, string][] = [
    ['Mainly Claude', 'Claude Desktop, Code, web'],
    ['ChatGPT', 'Desktop, web — via MCP'],
    ['Mainly Perplexity', 'Perplexity Pro, web'],
    ['MCP endpoint', 'Any MCP-compatible client'],
    ['REST API / CLI', 'Build something'],
    ['Self-demo', 'Try the built-in chat'],
    ['A mix of the above', "We'll set them all up"],
  ];

  // ── Phase 1: Clerk callback in progress ──────────────────────────────
  if (!callbackDone) {
    return (
      <>
        {/*
          AuthenticateWithRedirectCallback finalises the OAuth handshake.
          It renders nothing visible — we show a spinner while it works.
          Navigation is handled by _SessionWatcher once the user object is available.
        */}
        <AuthenticateWithRedirectCallback />
        {/* Trigger callbackDone once user is loaded (session set by Clerk) */}
        <_SessionWatcher onReady={() => setCallbackDone(true)} />
        <_LoadingScreen label="Completing sign-in…" />
      </>
    );
  }

  // ── Phase 2: "Tell us a bit more" modal ──────────────────────────────
  if (showExtraFields) {
    const footer = (
      <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
        Powered by PSFK
      </span>
    );

    return (
      <GateFrame footer={footer}>
        <Eyebrow style={{ marginBottom: 18 }}>One last thing</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'flex-start' }}>
          <div>
            <h2
              className="font-serif italic"
              style={{ fontSize: 48, fontWeight: 400, margin: '0 0 12px', lineHeight: 1.04, letterSpacing: '-0.015em' }}
            >
              Tell us a little more.
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', maxWidth: 480, lineHeight: 1.65, margin: '0 0 32px' }}>
              We couldn't get your company or title from your sign-in provider — just fill these in and we'll have your desk ready instantly.
            </p>
            <form onSubmit={handleExtraFieldsSubmit}>
              <div className="flex flex-col gap-5" style={{ maxWidth: 480 }}>
                <FieldRule label="Company" hint="employer · client" value={company} onChange={setCompany} required />
                <FieldRule label="Job title" value={jobTitle} onChange={setJobTitle} required />

                {/* Platform picker — condensed version */}
                <div>
                  <Eyebrow style={{ marginBottom: 10 }}>How will you use Fodda?</Eyebrow>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    {API_USE_OPTIONS.map(([value, desc]) => {
                      const selected = apiUse === value;
                      return (
                        <div
                          key={value}
                          onClick={() => setApiUse(value)}
                          className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-md border transition-all"
                          style={{
                            background: selected ? 'var(--brand-softer)' : 'var(--cream)',
                            borderColor: selected ? 'var(--brand)' : 'var(--line)',
                            borderWidth: selected ? 1.5 : 1,
                          }}
                        >
                          <span
                            style={{
                              width: 12, height: 12, border: '1.5px solid var(--ink)',
                              borderRadius: '50%', background: selected ? 'var(--brand)' : 'transparent',
                              flexShrink: 0, marginTop: 2,
                            }}
                          />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{value}</div>
                            <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <div style={{ fontSize: 12, color: '#b91c1c' }}>
                    <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em' }}>Errata · </span>
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-3.5" style={{ marginTop: 16, paddingTop: 18, borderTop: '1px solid var(--ink)' }}>
                  <span style={{ flex: 1 }} />
                  <Btn brand type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Setting up…' : 'Open my desk →'}
                  </Btn>
                </div>
              </div>
            </form>
          </div>
          <WaxSeal />
        </div>
      </GateFrame>
    );
  }

  // ── Fallback: redirect in progress ───────────────────────────────────
  return <_LoadingScreen label="Opening your desk…" />;
};

// ── Internal helpers ──────────────────────────────────────────────────────

/**
 * Watches for the Clerk user object to become available, then calls onReady.
 * This is the signal that AuthenticateWithRedirectCallback has completed.
 */
const _SessionWatcher: React.FC<{ onReady: () => void }> = ({ onReady }) => {
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      onReady();
    }
  }, [isLoaded, user]);

  return null;
};

const _LoadingScreen: React.FC<{ label: string }> = ({ label }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100vh', background: 'var(--bg, #faf9f6)', gap: 16,
  }}>
    <div style={{
      width: 40, height: 40, border: '3px solid var(--line, #e0ddd8)',
      borderTopColor: 'var(--brand, #6c47ff)', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <p style={{ fontFamily: 'var(--font-serif, Georgia)', fontStyle: 'italic', color: 'var(--ink-2, #888)', fontSize: 14 }}>
      {label}
    </p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);
