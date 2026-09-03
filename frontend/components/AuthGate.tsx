import React, { useState, useEffect, useRef } from 'react';
import { useSignIn, useSignUp, useClerk, useAuth } from '@clerk/react';
import { ThinkingOrb } from 'thinking-orbs';
import { Eyebrow, Masthead, FieldRule, Margin, GateFrame, Btn, StepBar, WaxSeal, GateFooter } from './AuthGateAtoms';
import { isValidRedirectUrl, normalizeOAuthRedirectUrl } from '../../shared/redirectAllowlist';
import { writePendingOAuthRedirect, readPendingOAuthRedirect, clearPendingOAuthRedirect, setOAuthPending } from '../../shared/oauthResumeStorage';

const GRAPH_LOOKUP: Record<string, { name: string; owner: string; headline: string; portrait_url?: string }> = {
  retail: { name: 'Future of Retail Graph', owner: 'PSFK', headline: 'Tracking the automation of physical commerce' },
  sports: { name: 'Future of Sports Graph', owner: 'PSFK', headline: 'Decoding the next generation of fan engagement' },
  beauty: { name: 'Future of Beauty Graph', owner: 'PSFK', headline: 'Exploring sensory tech and personalized aesthetics' },
  sic: { name: 'SIC Graph', owner: 'Ben Dietz', headline: 'Strategic Independent Culture mapping' },
  baseline: { name: 'Pew Public Beliefs Graph', owner: 'PSFK', headline: 'US public sentiment and demographic trends' },
  'ce-design': { name: 'Consumer Electronics & Design Graph', owner: 'Piers Fawkes', headline: 'Expert graph tracking innovation in CE and product design' },
  // Expert graphs — keyed by both graph_id and analyst slug
  'postpals-expert-graph': { name: 'Jeremy Bergstein — Science of Education & Innovation', owner: 'Jeremy Bergstein', headline: 'Ask Jeremy\'s AI twin about experiential retail, science education, and innovation strategy.', portrait_url: 'https://storage.googleapis.com/fodda-public/portraits/jeremy-bergstein.jpg' },
  'jeremy-bergstein-science-education-innovation': { name: 'Jeremy Bergstein — Science of Education & Innovation', owner: 'Jeremy Bergstein', headline: 'Ask Jeremy\'s AI twin about experiential retail, science education, and innovation strategy.', portrait_url: 'https://storage.googleapis.com/fodda-public/portraits/jeremy-bergstein.jpg' },
  'piers-fawkes': { name: 'Piers Fawkes — Future of Retail & Commerce', owner: 'Piers Fawkes', headline: 'Ask Piers\'s AI twin about the future of retail, commerce, and consumer experience.', portrait_url: 'https://storage.googleapis.com/fodda-public/portraits/piers-fawkes.jpg' },
  'ben-dietz': { name: 'Ben Dietz — Strategic Independent Culture', owner: 'Ben Dietz', headline: 'Ask Ben\'s AI twin about independent culture, brand strategy, and emerging movements.', portrait_url: 'https://storage.googleapis.com/fodda-public/portraits/ben-dietz.jpg' },
};

/** Derive the legacy signupIntent value from the user's apiUse selection */
const deriveIntent = (apiUse: string): string => {
  if (apiUse === 'Self-Demo') return 'demo';
  if (apiUse === 'Graph Seller') return 'sell';
  if (apiUse === 'Mainly API Access') return 'api';
  return 'account';
};

const API_USE_OPTIONS: [string, string, string][] = [
  ['Mainly Claude', 'Mainly Claude', 'Claude Desktop, Code, web'],
  ['ChatGPT', 'Mainly ChatGPT', 'Desktop, web — via MCP'],
  ['Mainly Perplexity', 'Mainly Perplexity', 'Perplexity Pro, web'],
  ['Mainly Notion AI', 'Mainly Notion', 'Notion connector'],
  ['Mainly Copilot', 'Mainly MSFT Co-pilot', 'MSFT Copilot for M365'],
  ['Mainly Gemini', 'Mainly Gemini', 'Workspace + AI Studio'],
  ['MCP endpoint', 'Mainly MCP Use', 'Any MCP-compatible client'],
  ['REST API / CLI', 'Mainly API Access', 'Build something'],
  ['Self-demo', 'Self-Demo', 'Try the built-in chat'],
  ['Sell my graph', 'Graph Seller', 'Upload research & earn'],
  ['A mix of the above', 'A Mix of Engagements', "We'll set them all up"],
  ['Not sure yet', "I Don't Know", 'Decide later'],
];

const getClerkErrorCode = (error: any): string | undefined => {
  if (!error) return undefined;
  return error.errors?.[0]?.code || error.code;
};

const dateEyebrow = () => {
  const d = new Date();
  return `${d.toLocaleDateString('en', { weekday: 'long' })} · ${d.toLocaleDateString('en', { month: 'long' })} ${d.getDate()} · Sign in`.toUpperCase();
};

interface AuthGateProps {
  onUnlock?: (email: string) => Promise<any>;
  onRegister?: (email: string, firstName: string, lastName: string, company: string, jobTitle: string, companyContextRaw?: string, userContextRaw?: string, apiUse?: string, intent?: string, referralGraph?: string, isProfessionalServices?: boolean, promoTag?: string) => void;
  onJoin?: (email: string, firstName: string, lastName: string, signupCode: string, jobTitle: string, userContextRaw?: string) => Promise<boolean>;
  onVerify?: (token: string) => Promise<boolean>;
  onAdminOpen?: () => void;
  initialReferralGraph?: string | null;
  initialExpertSlug?: string | null;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAdminOpen, initialReferralGraph, initialExpertSlug }) => {
  // Capture ?redirect_url= immediately before any URL cleaning runs
  if (typeof window !== 'undefined') {
    try {
      const initialParams = new URLSearchParams(window.location.search);
      const initialRedirect = initialParams.get('redirect_url');
      if (initialRedirect) {
        writePendingOAuthRedirect(initialRedirect);
      }
    } catch (e) {}
  }

  const _hasReferral = !!(initialReferralGraph && initialReferralGraph.length > 0);
  const _hasExpert = !!(initialExpertSlug && initialExpertSlug.length > 0);
  const [isSignUp, setIsSignUp] = useState(_hasReferral || _hasExpert);
  const [isJoinTeam, setIsJoinTeam] = useState(false);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [companyContextRaw, setCompanyContextRaw] = useState('');
  const [userContextRaw, setUserContextRaw] = useState('');
  const [apiUse, setApiUse] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const onboard = params.get('platform') || params.get('onboarding');
      if (onboard) {
        const lower = onboard.toLowerCase();
        if (lower.includes('mcp')) return 'Mainly MCP Use';
        if (lower.includes('chatgpt') || lower.includes('openai')) return 'Mainly ChatGPT';
        if (lower.includes('claude')) return 'Mainly Claude';
        if (lower.includes('perplexity')) return 'Mainly Perplexity';
        if (lower.includes('notion')) return 'Mainly Notion';
        if (lower.includes('copilot') || lower.includes('co-pilot')) return 'Mainly MSFT Co-pilot';
        if (lower.includes('gemini')) return 'Mainly Gemini';
        if (lower.includes('vertex') || lower.includes('api')) return 'Mainly API Access';
      }
    }
    return 'Mainly Claude';
  });
  const [referralGraph, setReferralGraph] = useState<string | null>(initialReferralGraph && initialReferralGraph.length > 0 ? initialReferralGraph : (initialExpertSlug || null));
  const [isProfessionalServices, setIsProfessionalServices] = useState(false);
  const [promoTag] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('promo') || '' : '');

  // Pricing page "Buy Now" params — passed through Clerk unsafeMetadata for post-signup checkout
  const [selectedPlanCode] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('plan') || '' : '');
  const [selectedTier] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tier') || '' : '');
  const [selectedPrice] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('price') || '' : '');
  const [isLoading, setIsLoading] = useState(false);
  const [errorHeader, setErrorHeader] = useState('');
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [legacyMagicLinkDetected, setLegacyMagicLinkDetected] = useState(false);
  const [isUnconfirmed, setIsUnconfirmed] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [returningFromConfirm, setReturningFromConfirm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Clerk head-less state hooks (v6 / Core 3 API)
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { signOut } = useAuth();
  const clerkReady = !!signIn && !!signUp;

  /** Trigger an OAuth redirect via Clerk. Stores a flag so SsoCallbackPage
   *  knows to show the "tell us more" modal for brand-new signups.
   *  Uses signIn.sso() / signUp.sso() — the Clerk Core 3 API on SignInFutureResource / SignUpFutureResource. */
  const handleOAuth = async (provider: 'oauth_google' | 'oauth_linkedin_oidc' | 'oauth_github') => {
    setOAuthPending(provider);
    const resumeTarget = normalizeOAuthRedirectUrl(
      new URLSearchParams(window.location.search).get('redirect_url')
      || readPendingOAuthRedirect()
    );
    if (resumeTarget) {
      writePendingOAuthRedirect(resumeTarget);
    }
    const callback = resumeTarget
      ? `${window.location.origin}/sso-callback?redirect_url=${encodeURIComponent(resumeTarget)}`
      : `${window.location.origin}/sso-callback`;

    if (isSignUp) {
      if (!signUp) return;
      const { error } = await signUp.sso({
        strategy: provider,
        redirectUrl: resumeTarget ?? '/',
        redirectCallbackUrl: callback,
      });
      if (error) {
        console.error('[AuthGate] signUp.sso error:', error);
        setErrorHeader(error.longMessage || error.message || 'OAuth sign-up failed.');
      }
    } else {
      if (!signIn) return;
      const { error } = await signIn.sso({
        strategy: provider,
        redirectUrl: resumeTarget ?? '/',
        redirectCallbackUrl: callback,
      });
      if (error) {
        console.error('[AuthGate] signIn.sso error:', error);
        setErrorHeader(error.longMessage || error.message || 'OAuth sign-in failed.');
      }
    }
  };

  useEffect(() => {
    console.log('[AuthGate] Clerk SDK state:', { 
      clerkReady, signIn: !!signIn, signUp: !!signUp,
    });
  }, [clerkReady, signIn, signUp]);

  useEffect(() => {
    if (!clerkReady || !signIn) return;

    const params = new URLSearchParams(window.location.search);
    const ticket = params.get('__clerk_ticket');
    if (ticket) {
      console.log('[AuthGate] Found __clerk_ticket in URL. Attempting auto sign-in...');
      setIsLoading(true);
      setErrorHeader('');
      
      signIn.ticket({ ticket })
      .then(async ({ error }) => {
        if (error) {
          console.error('[AuthGate] Ticket sign-in failed:', error);
          setErrorHeader(error.longMessage || error.message || 'Failed to authenticate via login link.');
          return;
        }
        console.log('[AuthGate] Ticket sign-in attempt status:', signIn.status);
        if (signIn.status === 'complete') {
          await signIn.finalize();
          console.log('[AuthGate] Ticket sign-in complete. Session activated.');
          // Clean the URL
          window.history.replaceState({}, document.title, '/');
        } else {
          setErrorHeader(`Ticket sign-in status is incomplete: ${signIn.status}`);
        }
      })
      .catch((err: any) => {
        console.error('[AuthGate] Ticket sign-in failed:', err);
        setErrorHeader(err.message || 'Failed to authenticate via login link.');
      })
      .finally(() => {
        setIsLoading(false);
      });
    }
  }, [clerkReady, signIn, clerk]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      
      // Detect legacy email magic link tokens during the transition window
      if (params.has('__clerk_db_jwt') || params.has('__clerk_status') || params.has('__clerk_created_session')) {
        setLegacyMagicLinkDetected(true);
        setShowEmailForm(true);
      }

      const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      const isRegisterPath = pathname === '/register';
      const signupParam = params.get('signup') === 'true' || params.get('register') === 'true';
      const intentParam = params.get('intent');
      const hasPlanParam = !!params.get('plan');

      // Persist marketing site deep-link params for post-auth execution
      const viewParam = params.get('view');
      if (viewParam) {
        localStorage.setItem('fodda.pendingView', viewParam);
      }
      const actionParam = params.get('action');
      if (actionParam) {
        localStorage.setItem('fodda.pendingBillingAction', actionParam);
      }
      const tabParam = params.get('tab');
      if (tabParam) {
        localStorage.setItem('fodda.pendingBillingTab', tabParam);
      }

      // Persist expert context for post-auth routing
      const expertPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      const expertPathMatch = expertPath.match(/^\/expert\/(.+)$/);
      const expertSlug = expertPathMatch ? expertPathMatch[1] : params.get('expert');
      if (expertSlug) {
        localStorage.setItem('fodda.pendingExpert', expertSlug);
        const qParam = params.get('q');
        if (qParam) localStorage.setItem('fodda.pendingQ', qParam);
      }

      // Map legacy ?intent= param to the corresponding apiUse value
      if (intentParam) {
        const intentMap: Record<string, string> = { demo: 'Self-Demo', sell: 'Graph Seller', api: 'Mainly API Access', account: 'Mainly Claude' };
        if (intentMap[intentParam]) setApiUse(intentMap[intentParam]);
      }

      if (emailParam || isRegisterPath || signupParam || hasPlanParam) {
        if (emailParam) {
          setEmail(emailParam);
          setShowEmailForm(true);
        }
        // Persist plan selection to localStorage so it survives authentication reloads
        if (hasPlanParam) {
          const planCode = params.get('plan') || '';
          const tier = params.get('tier') || '';
          const price = params.get('price') || '';
          if (planCode) localStorage.setItem('fodda.pendingPlanCode', planCode);
          if (tier) localStorage.setItem('fodda.pendingTier', tier);
          if (price) localStorage.setItem('fodda.pendingPrice', price);
        }
        if (isRegisterPath || signupParam || hasPlanParam) {
          setIsSignUp(true);
          setStep(1);
          setIsJoinTeam(false);
          setReturningFromConfirm(false);
        } else {
          setIsSignUp(false);
          setIsJoinTeam(false);
          setReturningFromConfirm(true);
          setShowEmailForm(true);
        }
        window.history.replaceState({}, document.title, '/');
      }
    }
  }, []);

  const resetState = () => {
    signOut().catch(err => console.error("[AuthGate] Signout failed:", err));
    clearPendingOAuthRedirect();
    setStep(1); setIsSignUp(false); setIsJoinTeam(false);
    setErrorHeader(''); setCompanyContextRaw(''); setIsProfessionalServices(false); setUserContextRaw('');
    setSignupCode(''); setIsWaitingForConfirmation(false); setIsUnconfirmed(false); setResendStatus('idle');
    setOtpCode('');
    setFieldErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { setErrorHeader('Invalid Email Format'); setTimeout(() => setErrorHeader(''), 5000); return; }
    if (isSignUp) {
      if (step === 1) {
        if (!firstName.trim() || !lastName.trim() || !jobTitle.trim()) { setErrorHeader('All Fields Required'); setTimeout(() => setErrorHeader(''), 5000); return; }
        if (isJoinTeam) {
          if (!signupCode.trim()) { setErrorHeader('Signup Code Required'); setTimeout(() => setErrorHeader(''), 5000); return; }
        } else {
          if (!company.trim()) { setErrorHeader('Company Name Required'); setTimeout(() => setErrorHeader(''), 5000); return; }
          setStep(2); return;
        }
      }
    }
    
    setIsLoading(true);
    setErrorHeader('');
    try {
      if (isSignUp) {
        if (!signUp) {
          setErrorHeader('Connecting to auth service — please wait a moment and try again.');
          setIsLoading(false);
          return;
        }
        
        // Start Clerk Sign Up (Core 3 API — methods return { error } rather than throwing)
        console.log('[AuthGate] Starting signUp.create for:', email);
        const { error: createError } = await signUp.create({
          emailAddress: email,
          firstName,
          lastName,
          unsafeMetadata: {
            company: isJoinTeam ? "" : company,
            jobTitle,
            apiUse,
            signupIntent: isJoinTeam ? "account" : deriveIntent(apiUse),
            referralGraph: referralGraph || 'all',
            isProfessionalServices,
            promoTag,
            signupCode: isJoinTeam ? signupCode : "",
            // Pricing page "Buy Now" context — triggers post-signup Stripe checkout
            ...(selectedPlanCode ? { selectedPlanCode, selectedTier, selectedPrice } : {})
          }
        });
        if (createError) {
          setErrorHeader(createError.longMessage || createError.message || 'Sign-up failed. Please verify your details.');
          return;
        }

        // Send 6-digit verification code via email using Future API
        const { error: prepError } = await signUp.verifications.sendEmailCode();
        if (prepError) {
          setErrorHeader(prepError.longMessage || prepError.message || 'Could not send verification code. Please try again.');
          return;
        }
        console.log('[AuthGate] Sign-up email code sent');
        setOtpCode('');
        setIsWaitingForConfirmation(true);
      } else {
        if (!signIn) {
          setErrorHeader('Connecting to auth service — please wait a moment and try again.');
          setIsLoading(false);
          return;
        }
        
        // Start Clerk Sign In (Core 3 API — methods return { error } rather than throwing)
        console.log('[AuthGate] Starting signIn.create for:', email);
        const { error: createError } = await signIn.create({
          identifier: email,
        });
        if (createError) {
          // User not found in Clerk — prompt them to register
          const errorCode = getClerkErrorCode(createError);
          if (errorCode === 'form_identifier_not_found') {
            setIsSignUp(true);
            setStep(1);
            setErrorHeader('');
            setIsWaitingForConfirmation(false);
            return;
          }
          setErrorHeader(createError.longMessage || createError.message || 'Verification Failed. Please verify credentials.');
          return;
        }

        // Send 6-digit verification code via email using Future API
        const { error: prepError } = await signIn.emailCode.sendCode();
        if (prepError) {
          setErrorHeader(prepError.longMessage || prepError.message || 'Could not send verification code. Please try again.');
          return;
        }
        console.log('[AuthGate] Sign-in email code sent');
        setOtpCode('');
        setIsWaitingForConfirmation(true);
      }
    } catch (err: any) {
      console.error("[Clerk Auth] Verification Failed:", err);
      setErrorHeader(err.message || 'Verification Failed. Please verify credentials.');
      setIsWaitingForConfirmation(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorHeader('Please enter the 6-digit verification code.');
      return;
    }
    setIsLoading(true);
    setErrorHeader('');
    try {
      if (isSignUp) {
        if (!signUp) {
          setErrorHeader('Sign up helper is not loaded yet.');
          return;
        }
        const { error: verifyError } = await signUp.verifications.verifyEmailCode({
          code: otpCode.trim(),
        });
        if (verifyError) {
          setErrorHeader(verifyError.longMessage || verifyError.message || 'Invalid or expired code. Please try again.');
          return;
        }
        if (signUp.status === 'complete') {
          console.log('[AuthGate] Sign-up verified! Activating session...');
          await signUp.finalize();
          // Explicit navigation to resume OAuth or app home
          const pendingResume = readPendingOAuthRedirect();
          if (pendingResume) {
            window.location.href = pendingResume;
          } else {
            window.location.href = '/';
          }
        }
      } else {
        if (!signIn) {
          setErrorHeader('Sign in helper is not loaded yet.');
          return;
        }
        const { error: verifyError } = await signIn.emailCode.verifyCode({
          code: otpCode.trim(),
        });
        if (verifyError) {
          setErrorHeader(verifyError.longMessage || verifyError.message || 'Invalid or expired code. Please try again.');
          return;
        }
        if (signIn.status === 'complete') {
          console.log('[AuthGate] Sign-in verified! Activating session...');
          await signIn.finalize();
          // Explicit navigation to resume OAuth or app home
          const pendingResume = readPendingOAuthRedirect();
          if (pendingResume) {
            window.location.href = pendingResume;
          } else {
            window.location.href = '/';
          }
        }
      }
    } catch (err: any) {
      console.error('[AuthGate] Code verification failed:', err);
      setErrorHeader(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus('sending');
    setErrorHeader('');
    try {
      if (isSignUp) {
        if (!signUp) {
          throw new Error("Sign up helper is not loaded yet.");
        }
        const { error } = await signUp.verifications.sendEmailCode();
        if (error) throw error;
      } else {
        if (!signIn) {
          throw new Error("Sign in helper is not loaded yet.");
        }
        const { error } = await signIn.emailCode.sendCode();
        if (error) throw error;
      }
      setResendStatus('sent');
      setTimeout(() => setResendStatus('idle'), 5000);
    } catch (err: any) {
      console.error("[Clerk Auth] Resend failed:", err);
      setErrorHeader(err.longMessage || err.message || 'Failed to resend code.');
      setResendStatus('idle');
    }
  };

  const footer = <GateFooter onAdminOpen={onAdminOpen} />;
  const loginMarginalia = (
    <>
      <Margin n="i." label="What is Fodda?" body={"A structured context layer\nthat lets your AI cite real,\ntrusted source graphs."} />
      <Margin n="ii." label="No password, ever." body={"We mail a 6-digit code.\nIt expires in 15 minutes."} />
      <Margin n="iii." label="Trouble?" body="hello@fodda.ai" />
      <Margin n="iv." label="Setup Guide" body="Quickstart for Claude, Notion, Copilot, API & more" href="/Fodda_Quickstart.md" />
      <Margin n="v." label="Integration Auditor Skill" body="Audit your codebase for Fodda opportunities" href="/Fodda_Integration_Auditor.md" />
    </>
  );

  // ═══ SCREEN 05: Code Sent / Verification ═══
  if (isWaitingForConfirmation) {
    const intentLine = isSignUp ? "You're almost ready to start using Fodda." : "Enter the 6-digit code sent to your email to log in securely.";
    return (
      <GateFrame footer={footer}>
        <Eyebrow style={{ marginBottom: 18 }}>Verification</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18 }}>
              <ThinkingOrb
                state="listening"
                size={64}
                theme="light"
                aria-label="Waiting for verification code…"
              />
              <h2 className="font-serif italic" style={{ fontSize: 46, fontWeight: 400, margin: 0, lineHeight: 1.06, letterSpacing: '-0.015em' }}>We've emailed you a code.</h2>
            </div>
            <p className="font-serif italic" style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.65, maxWidth: 520 }}>
              We've emailed a 6-digit code to&nbsp;
              <span style={{ color: 'var(--ink)', borderBottom: '1px solid var(--ink)', fontStyle: 'normal' }}>{email}</span>. Enter it below to access your desk.
            </p>
            <div style={{ marginTop: 24, padding: '18px 20px', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderLeft: '3px solid var(--brand)', borderRadius: 4, maxWidth: 520 }}>
              <Eyebrow brand style={{ marginBottom: 6 }}>System Note</Eyebrow>
              <div className="font-serif italic" style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.45 }}>{intentLine}</div>
            </div>

            <form onSubmit={handleVerifyCode} style={{ maxWidth: 520, marginTop: 24 }}>
              <FieldRule
                label="6-Digit Verification Code"
                hint="from your email"
                value={otpCode}
                onChange={v => { setOtpCode(v); if (errorHeader) setErrorHeader(''); }}
                mono
                placeholder="123456"
                required
                autoFocus
                maxLength={6}
                disabled={isLoading}
                error={errorHeader || undefined}
              />
              <div className="flex items-center gap-3.5" style={{ marginTop: 20 }}>
                <Btn brand type="submit" disabled={isLoading || otpCode.trim().length === 0}>
                  {isLoading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <ThinkingOrb state="working" size={20} theme="dark" aria-label="Verifying…" />
                      Verifying…
                    </span>
                  ) : (
                    'Verify & Continue →'
                  )}
                </Btn>
              </div>
            </form>

            <div className="flex items-center gap-3" style={{ marginTop: 28 }}>
              <Btn ghost onClick={handleResend} disabled={resendStatus !== 'idle'}>
                {resendStatus === 'sending' ? 'Sending…' : resendStatus === 'sent' ? '✓ Resent' : 'Resend code'}
              </Btn>
              <Btn ghost onClick={resetState}>Use a different email</Btn>
              <span style={{ flex: 1 }} />
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.14em' }}>check spam · promotions folder</span>
            </div>
          </div>
          <WaxSeal />
        </div>
      </GateFrame>
    );
  }
  // (Screen 02 — Intent Picker — removed: consolidated into Step 2)

  // ═══ SCREEN 08: Referral Landing ═══
  if (referralGraph && isSignUp && step === 1 && !isJoinTeam) {
    const g = GRAPH_LOOKUP[referralGraph];
    const graphName = g?.name || referralGraph.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const graphOwner = g?.owner || 'Fodda';
    const graphHeadline = g?.headline || 'Expert-curated knowledge graph — sign up for free access.';
    return (
      <GateFrame footer={footer} margin={
        <>
          <Margin n="re:" label={graphName} body={`${graphOwner} · updated weekly`} />
          <Margin n="incl." label="What you get" body={"Free Base account access.\n100 queries/month."} />
          <Margin n="→" label="Already registered?" body={<a onClick={() => { setIsSignUp(false); setReferralGraph(null); }} className="cursor-pointer" style={{ color: 'var(--brand)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, fontSize: 12 }}>Sign in with Clerk →</a>} />
        </>
      }>
        <div className="inline-flex items-center gap-2.5" style={{ padding: '6px 12px', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderRadius: 999, marginBottom: 18 }}>
          {g?.portrait_url && <img src={g.portrait_url} alt={graphOwner} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />}
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }} />
          <span className="font-mono font-bold" style={{ fontSize: 10, color: 'var(--brand)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Free Access · via {graphOwner}</span>
        </div>
        <h2 className="font-serif italic" style={{ fontSize: 56, fontWeight: 400, margin: '0 0 14px', lineHeight: 1.02, letterSpacing: '-0.015em', maxWidth: 600 }}>
          {g ? `You've been sent the ${graphName}.` : `Try the ${graphName} graph.`}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', maxWidth: 500, lineHeight: 1.65, margin: '0 0 30px' }}>{graphHeadline}</p>
        {promoTag && <div className="font-mono font-bold" style={{ fontSize: 10, color: 'var(--brand)', marginBottom: 16 }}>✨ PROMO: {promoTag.toUpperCase()}</div>}

        {/* ── OAuth quick sign-in / sign-up via Clerk (LinkedIn-first) ── */}
        <div style={{ maxWidth: 480, marginBottom: 24 }}>
          <div className="flex flex-col gap-2.5">
            <OAuthBtn provider="oauth_linkedin_oidc" label="Continue with LinkedIn" onClick={() => handleOAuth('oauth_linkedin_oidc')} variant="primary" />
            <OAuthBtn provider="oauth_google" label="Continue with Google" onClick={() => handleOAuth('oauth_google')} variant="secondary" />
          </div>
          <div className="flex items-center justify-between" style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-3)' }}>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>OR WITH EMAIL</span>
            <button
              type="button"
              onClick={() => handleOAuth('oauth_github')}
              className="cursor-pointer hover:underline font-medium"
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-3)', fontSize: 12, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}
            >
              or continue with GitHub
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4" style={{ maxWidth: 480 }}>
            <div className="grid gap-5 gate-name-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <FieldRule label="First name" value={firstName} onChange={setFirstName} required />
              <FieldRule label="Last name" value={lastName} onChange={setLastName} required />
            </div>
            <FieldRule label="Company" value={company} onChange={setCompany} required />
            <FieldRule label="Job title" value={jobTitle} onChange={setJobTitle} required />
            <FieldRule label="Email" hint="we will send a code" value={email} onChange={v => { setEmail(v); if (errorHeader) setErrorHeader(''); }} type="email" autoComplete="email" required />
          </div>
          {/* Mount point for Clerk's bot-protection widget (required for headless signUp.create) */}
          <div id="clerk-captcha" />
          {errorHeader && <div style={{ marginTop: 12, fontSize: 12, color: '#b91c1c' }}><span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em' }}>Errata · </span>{errorHeader}</div>}
          <div className="flex items-center gap-3.5" style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--ink)' }}>
            <a onClick={() => { setIsSignUp(false); setReferralGraph(null); }} className="cursor-pointer" style={{ fontSize: 12, color: 'var(--ink-2)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}>Sign in with Clerk →</a>
            <span style={{ flex: 1 }} />
            <Btn brand type="submit" disabled={isLoading}>{isLoading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ThinkingOrb state="working" size={20} theme="dark" aria-label="Creating account…" />Creating Account…</span> : 'Continue with Email →'}</Btn>
          </div>
        </form>
      </GateFrame>
    );
  }

  // ═══ SCREEN 09: Join Team ═══
  if (isSignUp && isJoinTeam) {
    return (
      <GateFrame footer={footer}>
        <Eyebrow style={{ marginBottom: 12 }}>Joining</Eyebrow>
        <h2 className="font-serif italic" style={{ fontSize: 52, fontWeight: 400, margin: '0 0 12px', lineHeight: 1.04, letterSpacing: '-0.015em' }}>Join your team's desk.</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: 540, lineHeight: 1.6, margin: '0 0 30px' }}>
          Paste the eight-character signup code your admin shared — we'll attach you to the same workspace so you see the same graphs, billing, and history.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 22 }}>
            <FieldRule label="Team signup code" hint="8 chars · case-insensitive" value={signupCode} onChange={setSignupCode} mono placeholder="A1B2C3D4" required />
          </div>
          <div className="flex flex-col gap-4" style={{ maxWidth: 540 }}>
            <div className="grid gap-5 gate-name-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <FieldRule label="First name" value={firstName} onChange={setFirstName} required />
              <FieldRule label="Last name" value={lastName} onChange={setLastName} required />
            </div>
            <FieldRule label="Job title" value={jobTitle} onChange={setJobTitle} required />
            <FieldRule label="Work email" hint="must match team domain" value={email} onChange={v => { setEmail(v); if (errorHeader) setErrorHeader(''); }} type="email" autoComplete="email" required />
          </div>
          <div id="clerk-captcha" />
          {errorHeader && <div style={{ marginTop: 12, fontSize: 12, color: '#b91c1c' }}><span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em' }}>Errata · </span>{errorHeader}</div>}
          <div className="flex items-center gap-3.5" style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--ink)' }}>
            <a onClick={() => { resetState(); }} className="cursor-pointer" style={{ fontSize: 12, color: 'var(--ink-2)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}>← back to entrance</a>
            <span style={{ flex: 1 }} />
            <Btn brand type="submit" disabled={isLoading}>{isLoading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ThinkingOrb state="working" size={20} theme="dark" aria-label="Joining team…" />Joining Team…</span> : 'Join team'}</Btn>
          </div>
        </form>
      </GateFrame>
    );
  }
  // ═══ SCREEN 03: Step 1 — Basic Details ═══
  if (isSignUp && step === 1) {
    return (
      <GateFrame footer={footer} margin={
        <>
          <Margin n="01" label="Why we ask" body={"Your name appears as the\nbyline on briefings you generate."} />
          <Margin n="02" label="Why your title?" body={"Helps Fodda phrase results\nat the right altitude — operator\nvs. analyst vs. exec."} />
          <Margin n="03" label="Privacy" body={"Never sold. Never used to\ntrain models. PSFK Privacy v3."} />
          <Margin n="→" label="Already registered?" body={<a onClick={() => { setIsSignUp(false); }} className="cursor-pointer" style={{ color: 'var(--brand)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, fontSize: 12 }}>Sign in instead →</a>} />
        </>
      }>
        <StepBar currentStep={1} />
        {selectedPlanCode && selectedTier && (
          <div style={{ marginBottom: 18, padding: '12px 16px', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
            <div>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand)', fontWeight: 700 }}>Selected Plan</div>
              <div className="font-serif italic" style={{ fontSize: 18, color: 'var(--ink)' }}>{selectedTier}{selectedPrice ? ` · $${selectedPrice}/mo` : ''}</div>
            </div>
          </div>
        )}
        <h2 className="font-serif italic" style={{ fontSize: 44, fontWeight: 400, margin: '0 0 8px', lineHeight: 1.06, letterSpacing: '-0.01em' }}>Let's sign you up.</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 20px', maxWidth: 480 }}>Two short pages, then a confirmation link.</p>
        {promoTag && <div className="font-mono font-bold" style={{ fontSize: 10, color: 'var(--brand)', marginBottom: 16 }}>✨ PROMO: {promoTag.toUpperCase()}</div>}

        {/* ── OAuth quick sign-up — LinkedIn-first ── */}
        <div style={{ maxWidth: 480, marginBottom: 24 }}>
          <div className="flex flex-col gap-2.5">
            <OAuthBtn provider="oauth_linkedin_oidc" label="Sign up with LinkedIn" onClick={() => handleOAuth('oauth_linkedin_oidc')} variant="primary" />
            <OAuthBtn provider="oauth_google" label="Sign up with Google" onClick={() => handleOAuth('oauth_google')} variant="secondary" />
          </div>
          <div className="flex items-center justify-between" style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-3)' }}>
            <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>OR WITH EMAIL</span>
            <button
              type="button"
              onClick={() => handleOAuth('oauth_github')}
              className="cursor-pointer hover:underline font-medium"
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-3)', fontSize: 12, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}
            >
              or sign up with GitHub
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5">
            <div className="grid gap-6 gate-name-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <FieldRule label="First name" value={firstName} onChange={setFirstName} required />
              <FieldRule label="Last name" value={lastName} onChange={setLastName} required />
            </div>
            <FieldRule label="Company" value={company} onChange={setCompany} required />
            <FieldRule label="Job title" value={jobTitle} onChange={setJobTitle} required />
            <FieldRule label="Email" hint="we will send a code" value={email} onChange={v => { setEmail(v); if (errorHeader) setErrorHeader(''); }} type="email" autoComplete="email" required />
          </div>
          {errorHeader && <div style={{ marginTop: 12, fontSize: 12, color: '#b91c1c' }}><span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em' }}>Errata · </span>{errorHeader}</div>}
          <div className="flex items-center gap-3.5" style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid var(--ink)' }}>
            <Btn ghost onClick={() => { setIsSignUp(false); }}>← Back</Btn>
            <span style={{ flex: 1 }} />
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.14em' }}>Step 1 / 2</span>
            <Btn brand type="submit">Continue →</Btn>
          </div>
        </form>
      </GateFrame>
    );
  }

  // ═══ SCREEN 04: Step 2 — How Will You Query ═══
  if (isSignUp && step === 2) {
    return (
      <GateFrame footer={footer}>
        <StepBar currentStep={2} />
        <h2 className="font-serif italic" style={{ fontSize: 44, fontWeight: 400, margin: '0 0 8px', lineHeight: 1.06, letterSpacing: '-0.01em' }}>How will you use Fodda?</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 26px', maxWidth: 540 }}>Pick one — we'll set up the right account and show you the matching guide right after sign-up. You can change any time from your desk.</p>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', borderTop: '1px solid var(--ink)', paddingTop: 18 }}>
            {API_USE_OPTIONS.map(([label, value, desc]) => {
              const selected = apiUse === value;
              return (
                <div
                  key={value}
                  onClick={() => setApiUse(value)}
                  className="flex items-start gap-3.5 cursor-pointer p-3 rounded-lg border transition-all hover:bg-brand-softer"
                  style={{
                    background: selected ? 'var(--brand-softer)' : 'var(--cream)',
                    borderColor: selected ? 'var(--brand)' : 'var(--line)',
                    borderWidth: selected ? 1.5 : 1,
                  }}
                >
                  <span
                    className="flex items-center justify-center self-center"
                    style={{
                      width: 14,
                      height: 14,
                      border: '1.5px solid var(--ink)',
                      borderRadius: '50%',
                      background: selected ? 'var(--brand)' : 'transparent',
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <label className="flex items-start gap-3 cursor-pointer" style={{ marginTop: 22, padding: '14px 16px', background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 8 }}>
            <span className="flex items-center justify-center" style={{
              width: 14, height: 14, marginTop: 3, border: '1.5px solid var(--ink)', borderRadius: 2,
              background: isProfessionalServices ? 'var(--ink)' : 'transparent', color: 'var(--paper)',
              fontSize: 10, lineHeight: 1, fontWeight: 700,
            }}>{isProfessionalServices ? '✓' : ''}</span>
            <input type="checkbox" checked={isProfessionalServices} onChange={e => setIsProfessionalServices(e.target.checked)} className="sr-only" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>I research on behalf of clients</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Agency, consultancy, advisory or other professional-services firm.</div>
            </div>
          </label>
          <div id="clerk-captcha" />
          {errorHeader && <div style={{ marginTop: 12, fontSize: 12, color: '#b91c1c' }}><span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em' }}>Errata · </span>{errorHeader}</div>}
          <div className="flex items-center gap-3.5" style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--ink)' }}>
            <Btn ghost onClick={() => setStep(1)}>← Back</Btn>
            <span style={{ flex: 1 }} />
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.14em' }}>Step 2 / 2</span>
            <Btn brand type="submit" disabled={isLoading}>{isLoading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ThinkingOrb state="working" size={20} theme="dark" aria-label="Creating account…" />Creating Account…</span> : 'Create account'}</Btn>
          </div>
        </form>
      </GateFrame>
    );
  }

  // ═══ SCREEN 01: Login (default) ═══
  const hasRedirectUrl = typeof window !== 'undefined' && (
    (new URLSearchParams(window.location.search).has('redirect_url') && isValidRedirectUrl(new URLSearchParams(window.location.search).get('redirect_url'))) ||
    readPendingOAuthRedirect() !== null
  );

  if (hasRedirectUrl) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6" style={{ background: 'var(--cream, #faf9f6)' }}>
        <div
          className="w-full my-auto animate-fade-in-up"
          style={{
            maxWidth: 440,
            background: 'var(--paper, #ffffff)',
            border: '1px solid var(--line, #e2ded8)',
            borderRadius: 14,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)',
            padding: '36px 32px 28px',
            textAlign: 'center',
          }}
        >
          {/* Header icon row: Fodda <-> Assistant */}
          <div className="flex items-center justify-center gap-3.5" style={{ marginBottom: 20 }}>
            <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid var(--line)', background: '#fff' }}>
              <img src="https://ucarecdn.com/6e7893d7-6b14-426b-83bc-574a3f72d6bc/foddaminilogo.png" alt="Fodda" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: 16, color: 'var(--ink-3)' }}>⇄</span>
            <div className="flex items-center justify-center font-mono font-bold" style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand)', fontSize: 13 }}>
              MCP
            </div>
          </div>

          <h2 className="font-serif italic" style={{ fontSize: 28, fontWeight: 400, margin: '0 0 6px', color: 'var(--ink)', lineHeight: 1.15 }}>
            Connect Fodda
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 18px' }}>
            Sign in to let your AI assistant cite your Fodda knowledge graphs.
          </p>

          {legacyMagicLinkDetected && (
            <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderLeft: '3px solid var(--brand)', borderRadius: 4, textAlign: 'left' }}>
              <Eyebrow brand style={{ marginBottom: 4 }}>Notice</Eyebrow>
              <div className="font-serif italic" style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4 }}>
                Email link sign-in has been replaced. Please enter your email below to receive a 6-digit verification code.
              </div>
            </div>
          )}

          {/* Hero callout for OAuth */}
          <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderRadius: 6 }}>
            <span className="font-mono font-bold" style={{ fontSize: 10, color: 'var(--brand)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ⚡ FASTEST: Continue with LinkedIn — no email confirmation
            </span>
          </div>

          {/* Full-width OAuth buttons (LinkedIn-first hierarchy) */}
          <div className="flex flex-col gap-2.5" style={{ marginBottom: 16 }}>
            <OAuthBtn provider="oauth_linkedin_oidc" label="Continue with LinkedIn" onClick={() => handleOAuth('oauth_linkedin_oidc')} variant="primary" />
            <OAuthBtn provider="oauth_google" label="Continue with Google" onClick={() => handleOAuth('oauth_google')} variant="secondary" />
          </div>

          {/* Quiet text links or expandable email form */}
          {!showEmailForm && !email ? (
            <div className="flex items-center justify-center gap-3" style={{ fontSize: 12, color: 'var(--ink-3)', margin: '14px 0 6px' }}>
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="cursor-pointer hover:underline font-medium"
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-2)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}
              >
                or continue with email
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => handleOAuth('oauth_github')}
                className="cursor-pointer hover:underline font-medium"
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-3)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}
              >
                GitHub
              </button>
            </div>
          ) : (
            <div className="animate-fade-in-up" style={{ marginTop: 12 }}>
              {/* Divider */}
              <div className="flex items-center gap-3" style={{ marginBottom: 14, color: 'var(--ink-4)' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)' }}>OR WITH EMAIL</span>
                <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                <FieldRule
                  label="Your email"
                  hint="6-digit code"
                  value={email}
                  onChange={v => { setEmail(v); if (errorHeader) setErrorHeader(''); }}
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  error={errorHeader || undefined}
                />
                <div style={{ marginTop: 14 }}>
                  <Btn brand type="submit" disabled={isLoading} style={{ width: '100%', justifyContent: 'center' }}>
                    {isLoading ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <ThinkingOrb state="working" size={20} theme="dark" aria-label="Sending code…" />
                        Sending code…
                      </span>
                    ) : (
                      'Continue with Email →'
                    )}
                  </Btn>
                </div>
              </form>

              <div className="text-center" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => handleOAuth('oauth_github')}
                  className="cursor-pointer hover:underline font-medium"
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-3)', fontSize: 12, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}
                >
                  or continue with GitHub
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px dashed var(--line)', fontSize: 11, color: 'var(--ink-3)' }}>
            Powered by <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>Fodda</span> · PSFK Context Layer
          </div>
        </div>
      </div>
    );
  }

  return (
    <GateFrame footer={footer} margin={loginMarginalia}>
      <Eyebrow style={{ marginBottom: 12 }}>{dateEyebrow()}</Eyebrow>
      <h2 className="font-serif italic" style={{ fontSize: 56, fontWeight: 400, margin: '0 0 14px', lineHeight: 1.02, letterSpacing: '-0.015em', maxWidth: 540 }}>
        Welcome back to better insight.
      </h2>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', maxWidth: 520, lineHeight: 1.6, margin: '0 0 28px' }}>
        Enter the email you registered with. We'll send a 6-digit code to that address — no password to remember, no token to copy.
      </p>

      {legacyMagicLinkDetected && (
        <div style={{ marginBottom: 24, padding: '16px 18px', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderLeft: '3px solid var(--brand)', borderRadius: 4, maxWidth: 520 }}>
          <Eyebrow brand style={{ marginBottom: 4 }}>Notice</Eyebrow>
          <div className="font-serif italic" style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.45 }}>
            Email link sign-in has been replaced. Please enter your email below to receive a 6-digit verification code.
          </div>
        </div>
      )}

      {/* ── OAuth quick sign-in (LinkedIn-first hierarchy) ── */}
      <div style={{ maxWidth: 480, marginBottom: 24 }}>
        <div className="flex flex-col gap-2.5">
          <OAuthBtn provider="oauth_linkedin_oidc" label="Continue with LinkedIn" onClick={() => handleOAuth('oauth_linkedin_oidc')} variant="primary" />
          <OAuthBtn provider="oauth_google" label="Continue with Google" onClick={() => handleOAuth('oauth_google')} variant="secondary" />
        </div>

        {!showEmailForm && !email ? (
          <div className="flex items-center gap-3" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              className="cursor-pointer hover:underline font-medium"
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-2)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}
            >
              or continue with email
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleOAuth('oauth_github')}
              className="cursor-pointer hover:underline font-medium"
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-3)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}
            >
              GitHub
            </button>
          </div>
        ) : (
          <div className="animate-fade-in-up" style={{ marginTop: 18 }}>
            <div className="flex items-center gap-3" style={{ color: 'var(--ink-4)', marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--ink-3)' }}>OR VIA EMAIL</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <FieldRule label="Your email" hint="6-digit code · 15 min" value={email} onChange={v => { setEmail(v); if (errorHeader) setErrorHeader(''); }} type="email" autoComplete="email" required disabled={isLoading} error={errorHeader || undefined} />
                <div className="flex items-center gap-3.5" style={{ marginTop: 4 }}>
                  <Btn brand type="submit" disabled={isLoading}>{isLoading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ThinkingOrb state="working" size={20} theme="dark" aria-label="Sending code…" />Sending code…</span> : 'Continue with Email →'}</Btn>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>↩ press return</span>
                </div>
              </div>
            </form>

            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => handleOAuth('oauth_github')}
                className="cursor-pointer hover:underline font-medium"
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--ink-3)', fontSize: 12, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4 }}
              >
                or continue with GitHub
              </button>
            </div>
          </div>
        )}
      </div>

      {returningFromConfirm ? (
        /* Returning from email confirmation — show a helpful note instead of registration CTA */
        <div style={{ marginTop: 36, padding: '18px 20px', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderLeft: '3px solid var(--brand)', borderRadius: 4, maxWidth: 520 }}>
          <Eyebrow brand style={{ marginBottom: 6 }}>Email confirmed</Eyebrow>
          <div className="font-serif italic" style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.45 }}>Your email is verified. Enter your email above to receive a 6-digit sign-in code.</div>
        </div>
      ) : (
        /* New here? CTA */
        <div style={{ marginTop: 48, padding: '20px 22px', border: '1px solid var(--ink)', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 18, maxWidth: 520, position: 'relative' }}>
          <div style={{ position: 'absolute', top: -9, left: 16, background: 'var(--paper)', padding: '0 10px' }}>
            <Eyebrow brand>New here?</Eyebrow>
          </div>
          <div style={{ flex: 1 }}>
            <div className="font-serif italic" style={{ fontSize: 22, color: 'var(--ink)', lineHeight: 1.2 }}>Begin a registration.</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Tell us why you're visiting — we'll point you at the right entrance.</div>
          </div>
          <Btn brand onClick={() => setIsSignUp(true)}>Get started →</Btn>
        </div>
      )}
    </GateFrame>
  );
};

// ─── OAuthBtn ─────────────────────────────────────────────────────────────────
const OAuthBtn: React.FC<{
  provider: 'oauth_google' | 'oauth_linkedin_oidc' | 'oauth_github';
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  style?: React.CSSProperties;
}> = ({ provider, label, onClick, variant = 'secondary', style }) => {
  const [hovered, setHovered] = React.useState(false);

  const googleIcon = (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );

  const linkedinIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill={variant === 'primary' ? '#ffffff' : '#0A66C2'}/>
      <path d="M7.5 10h-3v9h3v-9zm-1.5-.9C5.1 9.1 4.5 8.5 4.5 7.7S5.1 6.3 6 6.3s1.5.6 1.5 1.4S6.9 9.1 6 9.1zm14 9.9h-3v-4.5c0-1.1-.4-1.8-1.4-1.8-.8 0-1.2.5-1.4 1v5.3h-3V10h3v1.3c.4-.6 1.2-1.5 2.8-1.5 2 0 3 1.3 3 4v5.2z" fill={variant === 'primary' ? '#0A66C2' : '#ffffff'}/>
    </svg>
  );

  const githubIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fill="var(--ink)"/>
    </svg>
  );

  const icon = provider === 'oauth_google' ? googleIcon : provider === 'oauth_github' ? githubIcon : linkedinIcon;

  if (variant === 'primary') {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="inline-flex items-center justify-center gap-2.5 font-semibold transition-all cursor-pointer shadow-sm"
        style={{
          width: '100%',
          padding: '12px 20px',
          borderRadius: 8,
          fontSize: 14,
          letterSpacing: '0.01em',
          border: '1px solid #08529d',
          background: hovered ? '#08529d' : '#0A66C2',
          color: '#ffffff',
          boxShadow: hovered ? '0 2px 8px rgba(10, 102, 194, 0.25)' : '0 1px 3px rgba(10, 102, 194, 0.15)',
          ...style,
        }}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer"
      style={{
        width: '100%',
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 13,
        letterSpacing: '0.01em',
        border: `1px solid ${hovered ? 'var(--ink)' : 'var(--line)'}`,
        background: hovered ? 'var(--cream)' : 'var(--paper)',
        color: 'var(--ink)',
        ...style,
      }}
    >
      {provider === 'oauth_google' ? googleIcon : provider === 'oauth_github' ? githubIcon : linkedinIcon}
      {label}
    </button>
  );
};
