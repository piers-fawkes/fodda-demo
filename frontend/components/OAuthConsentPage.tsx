import React, { useEffect } from 'react';
import { OAuthConsent, useAuth } from '@clerk/react';
import { AuthGate } from './AuthGate';
import { writePendingOAuthRedirect, clearPendingOAuthRedirect } from '../../shared/oauthResumeStorage';

/**
 * OAuthConsentPage
 *
 * Dedicated OAuth consent page for app.fodda.ai (replaces Clerk-hosted accounts.fodda.ai/oauth-consent).
 *
 * Requirements:
 * 1. Signed-in: Renders Clerk's prebuilt <OAuthConsent /> component with Allow / Deny buttons.
 * 2. Signed-out: Preserves the full URL with all OAuth params into storage and renders AuthGate.
 * 3. Enforces strict-origin-when-cross-origin referrer policy for Clerk Frontend API POSTs.
 * 4. Minimal, compact layout with official Fodda branding.
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

  // Manage pending OAuth redirect persistence:
  // - Signed out: preserve full URL so post-auth resumes back to /oauth-consent
  // - Signed in: clear pending keys from all storage because resume succeeded
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthLoaded) return;
    if (clerkUserId) {
      clearPendingOAuthRedirect();
    } else {
      const fullUrl = window.location.pathname + window.location.search + window.location.hash;
      writePendingOAuthRedirect(fullUrl);
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

  // Signed in: render compact, consent-focused OAuthConsent container
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg, #faf9f6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Official Brand Header */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <img
          src="https://ucarecdn.com/6e7893d7-6b14-426b-83bc-574a3f72d6bc/foddaminilogo.png"
          alt="Fodda"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
        <span className="font-serif italic" style={{ fontSize: 20, fontWeight: 400, color: 'var(--ink, #1b1917)' }}>
          Fodda
        </span>
        <span style={{ color: 'var(--line, #e2ded4)', margin: '0 2px' }}>·</span>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            color: 'var(--ink-3, #78716c)',
            fontWeight: 600,
          }}
        >
          Authorization
        </span>
      </div>

      {/* Clerk prebuilt <OAuthConsent /> card */}
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <OAuthConsent
          appearance={{
            elements: {
              rootBox: {
                width: '100%',
                maxWidth: '460px',
                margin: '0 auto',
              },
              card: {
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                border: '1px solid var(--line, #e2ded4)',
                borderRadius: '12px',
                backgroundColor: 'var(--paper, #ffffff)',
                padding: '24px 20px',
              },
              headerTitle: {
                fontFamily: 'var(--font-serif, "Newsreader", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: '22px',
                color: 'var(--ink, #1b1917)',
              },
              formButtonPrimary: {
                backgroundColor: '#1b1917',
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
          marginTop: 12,
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
