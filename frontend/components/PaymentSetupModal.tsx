import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;


interface PaymentSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    accountId: string;
    userEmail: string;
    onSuccess: () => void;
}

interface CardSetupFormProps {
    accountId: string;
    userEmail: string;
    onSuccess: () => void;
    onClose: () => void;
}

const CardSetupForm: React.FC<CardSetupFormProps> = ({ accountId, userEmail, onSuccess, onClose }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [nameOnCard, setNameOnCard] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSetupIntent = async () => {
            try {
                const sessionToken = localStorage.getItem('fodda_session_token') || '';
                const res = await fetch('/api/account/setup-payment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(sessionToken ? { 'x-session-token': sessionToken } : {})
                    },
                    body: JSON.stringify({ accountId }),
                });
                const data = await res.json();
                if (data.clientSecret) {
                    setClientSecret(data.clientSecret);
                } else {
                    setError(data.error || 'Failed to initialize payment setup.');
                }
            } catch (e: any) {
                setError(e.message || 'Network error. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchSetupIntent();
    }, [accountId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements || !clientSecret) return;

        setSubmitting(true);
        setError(null);

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
            setError('Card element not found.');
            setSubmitting(false);
            return;
        }

        const { error: confirmError } = await stripe.confirmCardSetup(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: nameOnCard || undefined,
                    email: userEmail,
                },
            },
        });

        if (confirmError) {
            setError(confirmError.message || 'Card setup failed. Please try again.');
            setSubmitting(false);
            return;
        }

        try {
            const sessionToken = localStorage.getItem('fodda_session_token') || '';
            const activateRes = await fetch('/api/account/activate-overage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(sessionToken ? { 'x-session-token': sessionToken } : {})
                },
                body: JSON.stringify({ accountId }),
            });
            const activateData = await activateRes.json();
            if (!activateRes.ok) {
                setError(activateData.error || 'Card saved but failed to activate overage billing.');
                setSubmitting(false);
                return;
            }
        } catch (e: any) {
            setError(e.message || 'Card saved but failed to activate overage billing.');
            setSubmitting(false);
            return;
        }

        setSubmitting(false);
        onSuccess();
        onClose();
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand"></div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-1.5">
                    Name on Card
                </label>
                <input
                    type="text"
                    value={nameOnCard}
                    onChange={(e) => setNameOnCard(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-1.5">
                    Card Details
                </label>
                <div className="p-4 bg-paper rounded-xl border border-line">
                    <CardElement
                        options={{
                            style: {
                                base: {
                                    fontSize: '14px',
                                    color: '#1a1a1a',
                                    fontFamily: 'inherit',
                                    '::placeholder': { color: '#999' },
                                },
                                invalid: { color: '#dc2626' },
                            },
                        }}
                    />
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || submitting || !clientSecret}
                className="w-full px-6 py-3.5 bg-brand text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-brand-dark transition-all duration-200 shadow-lg shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
                {submitting ? (
                    <>
                        <div className="animate-spin h-3.5 w-3.5 border border-white/30 border-t-white rounded-full" />
                        Saving…
                    </>
                ) : (
                    'Save Card'
                )}
            </button>

            <p className="text-[11px] text-ink-4 text-center leading-relaxed">
                Your card will only be charged for usage beyond your included monthly API calls.
            </p>
        </form>
    );
};

export const PaymentSetupModal: React.FC<PaymentSetupModalProps> = ({ isOpen, onClose, accountId, userEmail, onSuccess }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/40 backdrop-blur-md p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-line flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-up">
                <div className="p-8 border-b border-line flex justify-between items-start bg-cream">
                    <div>
                        <h2 className="font-serif italic text-2xl text-ink mb-2">Add Payment Method</h2>
                        <p className="text-ink-3 text-sm leading-relaxed">
                            Save a card to enable overage billing at $0.50/API call beyond your monthly limit.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-ink-4 hover:text-ink transition-colors p-2 rounded-lg hover:bg-paper shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-8 bg-white overflow-y-auto">
                    {stripePromise ? (
                        <Elements stripe={stripePromise} options={{ appearance: { theme: 'stripe' } }}>
                            <CardSetupForm
                                accountId={accountId}
                                userEmail={userEmail}
                                onSuccess={onSuccess}
                                onClose={onClose}
                            />
                        </Elements>
                    ) : (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            Stripe billing is not configured. Please verify that VITE_STRIPE_PUBLISHABLE_KEY is set.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
