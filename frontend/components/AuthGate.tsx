import React, { useState, useEffect } from 'react';

interface AuthGateProps {
  onUnlock: (email: string) => Promise<any>; // Changed to Promise to check response
  onRegister: (email: string, firstName: string, lastName: string, company: string, jobTitle: string, companyContextRaw?: string, userContextRaw?: string, apiUse?: string) => void;
  onJoin: (email: string, firstName: string, lastName: string, signupCode: string, jobTitle: string, userContextRaw?: string) => Promise<boolean>;
  onVerify?: (token: string) => Promise<boolean>; // New Prop
}

export const AuthGate: React.FC<AuthGateProps> = ({ onUnlock, onRegister, onJoin, onVerify }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isJoinTeam, setIsJoinTeam] = useState(false); // New state: Join Existing Team vs Create New Account
  const [step, setStep] = useState(1); // 1 = Basic Info, 2 = Context

  // Step 1 Fields
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [signupCode, setSignupCode] = useState(''); // New field for Joining

  // Step 2 Fields
  const [companyContextRaw, setCompanyContextRaw] = useState('');
  const [userContextRaw, setUserContextRaw] = useState('');
  const [apiUse, setApiUse] = useState('webapp');

  const [isLoading, setIsLoading] = useState(false);
  const [errorHeader, setErrorHeader] = useState('');
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] = useState(false); // Used for both Signup & Login Magic Link
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // Check for email confirmation redirect or Magic Link Token
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      const tokenParam = params.get('token');

      // Magic Link Verification
      if (tokenParam && onVerify) {
        setIsVerifying(true);
        onVerify(tokenParam).then(success => {
          if (!success) {
            setErrorHeader('Invalid or Expired Link');
            setIsVerifying(false);
          }
          // If success, parent (App) sets Unlocked, so this component unmounts.
        });
      }

      if (emailParam) {
        setEmail(emailParam);
        setIsSignUp(false);
        setIsJoinTeam(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [onVerify]);

  const resetState = () => {
    setStep(1);
    setIsSignUp(false);
    setIsJoinTeam(false);
    setErrorHeader('');
    setCompanyContextRaw('');
    setUserContextRaw('');
    setSignupCode('');
    setIsWaitingForConfirmation(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[AuthGate] Submitting form...", { isSignUp, isJoinTeam, step, email });

    if (!email.includes('@')) {
      setErrorHeader('Invalid Email Format');
      setTimeout(() => setErrorHeader(''), 2000);
      return;
    }

    if (isSignUp) {
      if (step === 1) {
        // Validate Step 1
        if (!firstName.trim() || !lastName.trim() || !jobTitle.trim()) {
          setErrorHeader('All Fields Required');
          setTimeout(() => setErrorHeader(''), 2000);
          return;
        }
        if (isJoinTeam) {
          if (!signupCode.trim()) {
            setErrorHeader('Signup Code Required');
            setTimeout(() => setErrorHeader(''), 2000);
            return;
          }
        } else {
          if (!company.trim()) {
            setErrorHeader('Company Name Required');
            setTimeout(() => setErrorHeader(''), 2000);
            return;
          }
        }
        setStep(2);
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        let success = false;
        if (isJoinTeam) {
          console.log("[AuthGate] Joining Team...");
          success = await onJoin(email, firstName, lastName, signupCode, jobTitle, userContextRaw);
        } else {
          console.log("[AuthGate] Registering New Account...");
          // Pass 'any' cast if strict checks fail, but signature matches
          success = await (onRegister as any)(email, firstName, lastName, company, jobTitle, companyContextRaw, userContextRaw, apiUse);
        }

        if (success) {
          setIsWaitingForConfirmation(true);
        }
      } else {
        console.log("[AuthGate] Calling onUnlock for:", email);
        const res = await onUnlock(email); // Expecting response object
        if (res && res.message && res.message.includes("email")) {
          setIsWaitingForConfirmation(true);
        } else if (res && !res.ok) {
          setErrorHeader(res.error || 'Login Failed');
        }
      }
    } catch (err: any) {
      console.error("[AuthGate] Auth Action Failed:", err);
      // Use the error message from the exception if available, fallback to Connection Failed
      setErrorHeader(err.message || 'Connection Failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <svg className="animate-spin h-8 w-8 text-fodda-accent mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-sm font-bold tracking-widest uppercase">Verifying Secure Token...</p>
          {errorHeader && <p className="text-red-500 mt-2">{errorHeader}</p>}
        </div>
      </div>
    );
  }

  if (isWaitingForConfirmation) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 p-12 rounded-[2.5rem] shadow-2xl border border-zinc-800 text-center animate-fade-in-up">
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-white tracking-tight mb-2">Check Your Email</h1>
            <div className="w-16 h-1 bg-fodda-accent mx-auto rounded-full mb-6"></div>
          </div>

          <p className="text-zinc-300 text-sm mb-6 leading-relaxed">
            We&apos;ve sent a secure link to <span className="text-white font-bold">{email}</span>.
          </p>

          <p className="text-zinc-500 text-xs mb-8 leading-relaxed">
            Please check your inbox (and spam folder) to {isSignUp ? "verify your account" : "log in securely"}.
          </p>

          <button
            onClick={resetState}
            className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-zinc-700 transition-all border border-zinc-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-zinc-900 p-12 rounded-[2.5rem] shadow-2xl border border-zinc-800 text-center animate-fade-in-up">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-white tracking-tight mb-2">Fodda</h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-bold">Contextual Intelligence for AI</p>
        </div>

        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          {isSignUp
            ? (step === 1 ? (isJoinTeam ? "Join your team using your Signup Code." : "Create your account to access the Fodda App.") : "Help our AI understand your goals.")
            : "Welcome to the Fodda App. Please enter your registered email or sign up"}
        </p>

        {/* Toggle between Create / Join when in SignUp mode Step 1 */}
        {isSignUp && step === 1 && (
          <div className="flex mb-6 bg-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setIsJoinTeam(false)}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${!isJoinTeam ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => setIsJoinTeam(true)}
              className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${isJoinTeam ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Join Team
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {isSignUp && step === 1 && (
            <>
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  className="w-1/2 px-6 py-4 bg-black border border-zinc-800 rounded-2xl focus:outline-none focus:border-fodda-accent focus:ring-1 focus:ring-fodda-accent text-center text-white placeholder:text-zinc-600 transition-all"
                  required
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className="w-1/2 px-6 py-4 bg-black border border-zinc-800 rounded-2xl focus:outline-none focus:border-fodda-accent focus:ring-1 focus:ring-fodda-accent text-center text-white placeholder:text-zinc-600 transition-all"
                  required
                />
              </div>

              {!isJoinTeam ? (
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company Name"
                  className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-2xl focus:outline-none focus:border-fodda-accent focus:ring-1 focus:ring-fodda-accent text-center text-white placeholder:text-zinc-600 transition-all"
                  required
                />
              ) : (
                <input
                  type="text"
                  value={signupCode}
                  onChange={(e) => setSignupCode(e.target.value)}
                  placeholder="Team Signup Code (e.g. A1B2C3D4)"
                  className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-2xl focus:outline-none focus:border-fodda-accent focus:ring-1 focus:ring-fodda-accent text-center text-white placeholder:text-zinc-600 transition-all font-mono tracking-widest uppercase"
                  required
                />
              )}

              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Job Title"
                className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-2xl focus:outline-none focus:border-fodda-accent focus:ring-1 focus:ring-fodda-accent text-center text-white placeholder:text-zinc-600 transition-all"
                required
              />
            </>
          )}

          {isSignUp && step === 2 && (
            <div className="space-y-4 text-left">
              {!isJoinTeam && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block ml-1">How will you query Fodda?</label>
                  <div className="relative">
                    <select
                      value={apiUse}
                      onChange={(e) => setApiUse(e.target.value)}
                      className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-2xl focus:outline-none focus:border-fodda-accent focus:ring-1 focus:ring-fodda-accent text-sm text-white appearance-none transition-all cursor-pointer"
                    >
                      <option value="Mainly API Access">Mainly API Access</option>
                      <option value="Mainly Chat Access">Mainly Chat Access</option>
                      <option value="Mix of API and Chat Access">Mix of API and Chat Access</option>
                      <option value="I Don't Know">I Don't Know</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>
              )}
              {!isJoinTeam && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block ml-1">Company Mission</label>
                  <textarea
                    value={companyContextRaw}
                    onChange={(e) => setCompanyContextRaw(e.target.value)}
                    placeholder="e.g. We are an advertising agency trying to make avant garde advertising..."
                    className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-2xl focus:outline-none focus:border-fodda-accent focus:ring-1 focus:ring-fodda-accent text-sm text-white placeholder:text-zinc-600 transition-all h-24 resize-none"
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block ml-1">Your Role & Goals</label>
                <textarea
                  value={userContextRaw}
                  onChange={(e) => setUserContextRaw(e.target.value)}
                  placeholder="e.g. I am a strategist who always looks for the brand new..."
                  className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-2xl focus:outline-none focus:border-fodda-accent focus:ring-1 focus:ring-fodda-accent text-sm text-white placeholder:text-zinc-600 transition-all h-24 resize-none"
                />
              </div>
            </div>
          )}

          {/* Email input only on step 1 or Login */}
          {(!isSignUp || step === 1) && (
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                disabled={isLoading}
                className="w-full px-6 py-4 bg-black border border-zinc-800 rounded-2xl focus:outline-none focus:border-fodda-accent focus:ring-1 focus:ring-fodda-accent text-center text-white placeholder:text-zinc-600 transition-all disabled:opacity-50"
                required
              />
              {errorHeader && (
                <p className="absolute -bottom-6 left-0 right-0 text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                  {errorHeader}
                </p>
              )}
            </div>
          )}

          <div className="flex space-x-2">
            {isSignUp && step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 py-4 bg-zinc-800 text-zinc-400 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-zinc-700 transition-all"
              >
                Back
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`flex-1 py-4 bg-fodda-accent text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-fodda-accent/90 transition-all shadow-lg shadow-fodda-accent/20 active:scale-[0.98] mt-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isSignUp ? 'Creating Account...' : 'Verifying...'}
                </span>
              ) : (isSignUp ? (step === 1 ? 'Next Step' : (isJoinTeam ? 'Join Team' : 'Create Account')) : 'Enter App')}
            </button>
          </div>
        </form>

        <div className="mt-4">
          <button
            onClick={() => { resetState(); setIsSignUp(!isSignUp); }}
            className="text-xs text-zinc-500 hover:text-white underline decoration-zinc-700 hover:decoration-white transition-all"
          >
            {isSignUp ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </div>

        <div className="mt-6 pt-8 border-t border-zinc-800">
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest leading-loose">
            Powered by PSFK<br />
            Secure Environment
          </p>
        </div>
      </div>
    </div >
  );
};
