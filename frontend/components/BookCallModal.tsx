import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle2, Video, Loader2, LogIn } from 'lucide-react';
import { trackEvent } from '../services/analytics';
import { useUser, useAuth, useClerk } from '@clerk/react';

export interface BookCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  expertId: string;      // Analyst ID
  expertName: string;
  expertIn?: string;      // Domain topics
  expertSlug?: string;    // URL slug
  callPrice?: string;
  bookUrl?: string;
  isUnclaimed?: boolean;
}

export const BookCallModal: React.FC<BookCallModalProps> = ({
  isOpen,
  onClose,
  expertId,
  expertName,
  expertIn,
  expertSlug,
  callPrice = '$750',
  bookUrl,
  isUnclaimed = false,
}) => {
  const { user, isLoaded } = useUser();
  const { getToken, isSignedIn } = useAuth();
  const clerk = useClerk();

  const [email, setEmail] = useState('');
  const [requestedQuestion, setRequestedQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const firstName = expertName.split(' ')[0] || 'Expert';

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      setEmail(user.primaryEmailAddress.emailAddress);
    } else if (typeof window !== 'undefined') {
      const clerkUser = (window as any).Clerk?.user;
      const clerkEmail = clerkUser?.primaryEmailAddress?.emailAddress;
      if (clerkEmail) {
        setEmail(clerkEmail);
      }
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const isUserSignedIn = Boolean(isSignedIn || user || (typeof window !== 'undefined' && (window as any).Clerk?.user));

  const handleSignInRedirect = () => {
    trackEvent('expert_book_modal_sign_in_click', { expert_id: expertId, is_unclaimed: isUnclaimed });
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (clerk && typeof clerk.openSignIn === 'function') {
      clerk.openSignIn({
        forceRedirectUrl: currentUrl,
        fallbackRedirectUrl: currentUrl,
      });
    } else {
      const returnParam = currentUrl ? `?redirect_url=${encodeURIComponent(currentUrl)}` : '';
      window.location.href = `/login${returnParam}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      trackEvent('expert_book_call_submit', { expert_id: expertId, email, is_unclaimed: isUnclaimed });

      const clerkUser = user || (typeof window !== 'undefined' ? (window as any).Clerk?.user : null);
      const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || email;

      // Extract bearer token if signed in
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const token = await getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch {
        // Fall through
      }

      // Payload parameters
      const intent_event = isUnclaimed ? 'unclaimed_expert_request' : 'expert_video_call_booking';
      const parameters = isUnclaimed
        ? {
            expertId,          // Analyst ID
            expertName,
            expertSlug: expertSlug || expertId,
            expertIn,
            requesterName: clerkUser?.fullName || clerkUser?.firstName || undefined,
            clerkUserId: clerkUser?.id || undefined,
            requestedQuestion: requestedQuestion.trim() || undefined,
          }
        : {
            expertId,          // Analyst ID
            expertName,
            expertIn,          // Drives Sales Agent alignment check
            expertSlug: expertSlug || expertId,
            callPrice,
            bookUrl,
            requesterName: clerkUser?.fullName || clerkUser?.firstName || undefined,
            clerkUserId: clerkUser?.id || undefined,
          };

      // Post intent payload to backend API proxy
      const res = await fetch('/api/intent', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          intent_event,
          email: userEmail,
          parameters,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data?.error || 'Unable to submit request. Please contact team@fodda.ai directly.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error sending request to team@fodda.ai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs text-left"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-amber-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          /* Thank You Screen */
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-2xl font-normal text-gray-900">Request Received</h3>
            <p className="text-[14px] text-gray-600 font-light max-w-sm mx-auto leading-relaxed">
              {isUnclaimed ? (
                <>Request received. We've reached out to <span className="font-semibold text-gray-900">{firstName}</span> to invite them onto Fodda. We'll email you the moment they're live.</>
              ) : (
                <>Look out for an email from <span className="font-semibold text-gray-900">team@fodda.ai</span></>
              )}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-semibold hover:bg-black transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Booking / Request Form */
          <div>
            <div className="flex items-center gap-2 mb-2 text-[#b45309]">
              {isUnclaimed ? <Send className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              <span className="text-[11px] font-bold uppercase tracking-[0.16em]">
                {isUnclaimed ? 'Expert Request' : 'Direct Engagement'}
              </span>
            </div>

            <h3 className="font-serif text-2xl text-gray-900 mb-2">
              {isUnclaimed ? `Connect with ${firstName}` : `Book ${firstName}`}
            </h3>

            <p className="text-[13px] text-gray-600 font-light mb-6 leading-relaxed">
              {isUnclaimed ? (
                <>{firstName} isn't on Fodda yet. Request to connect and we'll invite them — you'll be notified the moment they're available.</>
              ) : (
                <>Direct 1-on-1 session or speaking engagement ({callPrice}).</>
              )}
            </p>

            {!isUserSignedIn && isLoaded ? (
              /* Signed-out state: Clean single Sign in/Sign up button */
              <button
                type="button"
                onClick={handleSignInRedirect}
                className="w-full py-3.5 rounded-xl bg-[#663399] text-white text-[14px] font-bold hover:bg-[#4a2470] transition inline-flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#663399]/20"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in or Sign up to Request</span>
              </button>
            ) : (
              /* Signed-in state: Pre-filled Email & Submit */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="account-email" className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    Your Account Email
                  </label>
                  <input
                    id="account-email"
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-[14px] text-gray-700 font-medium cursor-not-allowed"
                  />
                </div>

                {isUnclaimed && (
                  <div>
                    <label htmlFor="requested-question" className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                      What would you ask {firstName}? <span className="font-normal text-gray-400 font-sans lowercase">(optional)</span>
                    </label>
                    <textarea
                      id="requested-question"
                      rows={3}
                      value={requestedQuestion}
                      onChange={(e) => setRequestedQuestion(e.target.value)}
                      placeholder={`e.g. What are your core predictions for ${expertIn || 'this space'}?`}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#663399] transition resize-none font-light"
                    />
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[13px] leading-snug">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl bg-[#663399] text-white text-[14px] font-bold hover:bg-[#4a2470] disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#663399]/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting…</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{isUnclaimed ? 'Request to Connect' : `Request Contact (${callPrice})`}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookCallModal;
