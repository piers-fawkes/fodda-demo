import React, { useEffect } from 'react';
import { OAuthConsent, useAuth } from '@clerk/react';
import { AuthGate } from './AuthGate';
import { WaxSeal } from './AuthGateAtoms';
import { isValidRedirectUrl } from '../../shared/redirectAllowlist';

/**
 * OAuthConsentPage
 *
 * Dedicated OAuth consent page for app.fodda.ai (replaces Clerk-hosted accounts.fodda.ai/oauth-consent).
 *
 * Requirements:
 * 1. Signed-in: Renders Clerk's prebuilt <OAuthConsent /> component with Allow / Deny buttons.
 * 2. Signed-out: Preserves the full URL with all OAuth params into sessionStorage and renders AuthGate.
 * 3. Enforces strict-origin-when-cross-origin referrer policy for Clerk Frontend API POSTs.
 * 4. Minimal, isolated layout with no app navigation or escape links.
 */
export const OAuthConsentPage: React.FC = () => {
  const { userId: clerkUserId, isLoaded: isAuthLoaded } = useAuth();

  // Enforce strict-origin-when-cross-origin referrer policy
  useEffect(() => {
    let meta = document.querySelector('meta[name="referrer"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'referrer';
      meta.content = 'strict-origin-when-cross-origin';
      document.head.appendChild(meta);
    } else {
      meta.content = 'strict-origin-when-cross-origin';
    }
  }, []);

  // When signed out, preserve the current full URL so post-auth resumes back to /oauth-consent
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthLoaded) return;
    if (!clerkUserId) {
      const fullUrl = window.location.pathname + window.location.search + window.location.hash;
      if (isValidRedirectUrl(fullUrl)) {
        sessionStorage.setItem('fodda.pendingOAuthRedirect', fullUrl);
        sessionStorage.setItem('fodda.pendingOAuthResume', fullUrl);
        localStorage.setItem('fodda.pendingOAuthRedirect', fullUrl);
        localStorage.setItem('fodda.pendingOAuthResume', fullUrl);
      }
    }
  }, [isAuthLoaded, clerkUserId]);

  // Loading state while Clerk initializes
  if (!isAuthLoaded) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg, #faf9f6)',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid var(--line, #e0ddd8)',
            borderTopColor: 'var(--brand, #0A66C2)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontFamily: 'var(--font-serif, Georgia)', fontStyle: 'italic', color: 'var(--ink-2, #888)', fontSize: 14 }}>
          Loading authorization…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Signed out variant: render AuthGate to let the user authenticate via LinkedIn/Google/Email
  if (!clerkUserId) {
    return <AuthGate />;
  }

  // Signed in: render minimal, consent-focused OAuthConsent container
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg, #faf9f6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      {/* Minimal Header */}
      <div style={{ marginBottom: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <WaxSeal size={36} />
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--ink-3, #78716c)',
            fontWeight: 700,
          }}
        >
          Fodda Context Layer · Authorization
        </div>
      </div>

      {/* Clerk prebuilt <OAuthConsent /> card */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <OAuthConsent
          appearance={{
            elements: {
              rootBox: {
                width: '100%',
                maxWidth: '480px',
                margin: '0 auto',
              },
              card: {
                boxShadow: 'none',
                border: '1px solid var(--line, #e2ded4)',
                borderRadius: '12px',
                backgroundColor: 'var(--paper, #ffffff)',
              },
              headerTitle: {
                fontFamily: 'var(--font-serif, "Newsreader", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: '24px',
                color: 'var(--ink, #1b1917)',
              },
              formButtonPrimary: {
                backgroundColor: '#0A66C2',
                color: '#ffffff',
                fontWeight: 600,
                borderRadius: '8px',
                fontSize: '14px',
              },
              formButtonReset: {
                color: 'var(--ink-2, #44403c)',
                borderRadius: '8px',
                fontSize: '14px',
              },
            },
          }}
        />
      </div>

      {/* Minimal Footer */}
      <div
        style={{
          marginTop: 32,
          fontSize: 11,
          color: 'var(--ink-3, #a8a29e)',
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}
      >
        Powered by <span style={{ fontWeight: 600, color: 'var(--ink-2, #57534e)' }}>Fodda</span> · PSFK Context Layer
      </div>
    </div>
  );
};
