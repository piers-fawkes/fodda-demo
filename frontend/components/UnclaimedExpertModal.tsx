
import React, { useState, useEffect } from 'react';

interface UnclaimedExpertModalProps {
  isOpen: boolean;
  onClose: () => void;
  expert: {
    id: string;
    name: string;
    portraitUrl?: string;
  };
  currentUser?: {
    id: string;
    email: string;
    name?: string;
  };
}

type ModalState = 'default' | 'notifying' | 'notified' | 'claiming' | 'claimed' | 'error';

export const UnclaimedExpertModal: React.FC<UnclaimedExpertModalProps> = ({ isOpen, onClose, expert, currentUser }) => {
  const [modalState, setModalState] = useState<ModalState>('default');
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimerName, setClaimerName] = useState('');
  const [claimerEmail, setClaimerEmail] = useState('');
  const [claimerMessage, setClaimerMessage] = useState('');

  // Pre-fill claim message when expert changes
  useEffect(() => {
    setClaimerMessage(`I am ${expert.name} and would like to claim my profile on Fodda`);
  }, [expert.name]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setModalState('default');
      setShowClaimForm(false);
      setClaimerName('');
      setClaimerEmail('');
      setClaimerMessage(`I am ${expert.name} and would like to claim my profile on Fodda`);
    }
  }, [isOpen, expert.name]);

  if (!isOpen) return null;

  const firstName = expert.name.split(' ')[0];

  const handleNotify = async () => {
    setModalState('notifying');
    try {
      const res = await fetch('/api/unclaimed/notify-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expertId: expert.id,
          expertName: expert.name,
          userId: currentUser?.id,
          userName: currentUser?.name,
          userEmail: currentUser?.email,
        }),
      });
      if (!res.ok) throw new Error('notify failed');
      setModalState('notified');
    } catch {
      setModalState('error');
    }
  };

  const handleClaimSubmit = async () => {
    setModalState('claiming');
    try {
      const res = await fetch('/api/unclaimed/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expertId: expert.id,
          expertName: expert.name,
          claimerName,
          claimerEmail,
          message: claimerMessage,
        }),
      });
      if (!res.ok) throw new Error('claim failed');
      setModalState('claimed');
    } catch {
      setModalState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up border border-line flex flex-col max-h-[90vh]">
        {/* ─── Header ─── */}
        <div className="p-6 border-b border-line flex justify-between items-center bg-cream shrink-0">
          <div className="flex items-center gap-3">
            {expert.portraitUrl && (
              <img
                src={expert.portraitUrl}
                alt={expert.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div className="flex items-center gap-2">
              <h3 className="font-serif italic text-xl text-ink">{expert.name}</h3>
              <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">Unclaimed</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-ink-3 hover:text-ink transition-colors">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="p-8 space-y-5 overflow-y-auto text-ink-2 leading-relaxed text-sm">

          {/* Default state */}
          {modalState === 'default' && (
            <>
              <p>{expert.name} isn't available on Fodda yet — but you can help change that.</p>
              <p>We'll let them know you're interested and invite them to join.</p>
              <button
                onClick={handleNotify}
                className="w-full py-3 px-6 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-colors"
              >
                Notify {firstName} of your interest
              </button>
            </>
          )}

          {/* Notifying state */}
          {modalState === 'notifying' && (
            <>
              <p>Sending...</p>
              <button
                disabled
                className="w-full py-3 px-6 bg-brand/60 text-white font-semibold rounded-xl cursor-not-allowed"
              >
                Sending...
              </button>
            </>
          )}

          {/* Notified state */}
          {modalState === 'notified' && (
            <>
              <div className="flex items-center gap-2 text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className="font-medium">Interest sent!</span>
              </div>
              <p>Thanks! We'll reach out to {firstName} on your behalf. We'll notify you if they join.</p>
              <button
                onClick={onClose}
                className="w-full py-3 px-6 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-colors"
              >
                Close
              </button>
            </>
          )}

          {/* Error state */}
          {modalState === 'error' && (
            <>
              <p className="text-red-600">Something went wrong. Please try again.</p>
              <button
                onClick={() => setModalState('default')}
                className="w-full py-3 px-6 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-colors"
              >
                Try Again
              </button>
            </>
          )}

          {/* Claimed state */}
          {modalState === 'claimed' && (
            <>
              <div className="flex items-center gap-2 text-green-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className="font-medium">Claim submitted!</span>
              </div>
              <p>Thanks — we'll verify your identity and be in touch.</p>
              <button
                onClick={onClose}
                className="w-full py-3 px-6 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-colors"
              >
                Close
              </button>
            </>
          )}

          {/* Claim form (inline, replaces default body when toggled) */}
          {showClaimForm && modalState === 'default' && (
            <div className="space-y-4 pt-4 border-t border-line">
              <h4 className="font-medium text-ink text-sm">Claim this profile</h4>
              <div>
                <label className="block text-xs text-ink-3 mb-1">Name</label>
                <input
                  type="text"
                  value={claimerName}
                  onChange={e => setClaimerName(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-3 mb-1">Email</label>
                <input
                  type="email"
                  value={claimerEmail}
                  onChange={e => setClaimerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="Your email address"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-3 mb-1">Message</label>
                <textarea
                  value={claimerMessage}
                  onChange={e => setClaimerMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <button
                onClick={handleClaimSubmit}
                disabled={modalState === 'claiming'}
                className="w-full py-3 px-6 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-colors"
              >
                Submit Claim
              </button>
            </div>
          )}

          {/* Claiming state (submitting form) */}
          {modalState === 'claiming' && (
            <>
              <p>Submitting your claim...</p>
              <button
                disabled
                className="w-full py-3 px-6 bg-brand/60 text-white font-semibold rounded-xl cursor-not-allowed"
              >
                Submitting...
              </button>
            </>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="p-4 bg-cream border-t border-line text-center shrink-0">
          {(modalState === 'default' || modalState === 'notified') && !showClaimForm && (
            <p
              className="text-xs text-ink-3 hover:text-brand cursor-pointer transition-colors"
              onClick={() => setShowClaimForm(true)}
            >
              Are you {expert.name}? <span className="underline">Claim this profile</span>
            </p>
          )}
          {showClaimForm && modalState === 'default' && (
            <p
              className="text-xs text-ink-3 hover:text-brand cursor-pointer transition-colors"
              onClick={() => setShowClaimForm(false)}
            >
              Cancel claim
            </p>
          )}
          {(modalState === 'notifying' || modalState === 'error' || modalState === 'claiming' || modalState === 'claimed') && (
            <span className="text-xs text-ink-3">&nbsp;</span>
          )}
        </div>
      </div>
    </div>
  );
};
