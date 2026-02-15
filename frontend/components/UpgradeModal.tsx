import React, { useEffect, useState } from 'react';
import { dataService } from '../../shared/dataService';
import { Plan } from '../../shared/types';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlanName?: string;
    userEmail?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, currentPlanName, userEmail }) => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            dataService.getPlans()
                .then(res => {
                    if (res.ok) setPlans(res.plans);
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="bg-zinc-900 rounded-3xl shadow-2xl max-w-4xl w-full border border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-up">

                <div className="p-8 border-b border-zinc-800 flex justify-between items-start bg-gradient-to-r from-red-500/10 to-transparent">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">Usage Limit Reached</h2>
                        <p className="text-zinc-400 text-sm">You have exhausted the queries included in your <span className="text-white font-bold">{currentPlanName || 'Current'}</span> plan for this month.</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-8 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-fodda-accent"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {plans.map(plan => {
                                const isCurrent = plan.name === currentPlanName;
                                return (
                                    <div key={plan.id} className={`relative flex flex-col p-6 rounded-2xl border ${isCurrent ? 'bg-zinc-800/50 border-zinc-700' : 'bg-transparent border-zinc-800'}`}>
                                        {isCurrent && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Current Plan</span>
                                        )}
                                        <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                                        <div className="text-2xl font-bold text-fodda-accent mb-4">{plan.price}<span className="text-xs text-zinc-500 font-normal ml-1">/mo</span></div>

                                        <ul className="space-y-3 mb-8 flex-1">
                                            {plan.features.map((f, i) => (
                                                <li key={i} className="text-xs text-zinc-400 flex items-start">
                                                    <svg className="w-4 h-4 text-green-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>

                                        {plan.stripeLink ? (
                                            <a
                                                href={`${plan.stripeLink}?prefilled_email=${encodeURIComponent(userEmail || '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-3 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-colors text-center block"
                                            >
                                                Upgrade
                                            </a>
                                        ) : (
                                            <button
                                                disabled
                                                className="w-full py-3 bg-zinc-800 text-zinc-500 font-bold text-xs uppercase tracking-widest rounded-xl cursor-not-allowed"
                                            >
                                                {isCurrent ? 'Active' : 'Contact Sales'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-8 p-4 bg-zinc-800/30 rounded-xl border border-zinc-800/50 text-center">
                        <p className="text-xs text-zinc-500">Need a custom enterprise solution? <a href="mailto:sales@fodda.ai" className="text-fodda-accent hover:underline">Contact our sales team</a>.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
