
import React from 'react';

interface SecurityModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up border border-stone-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="bg-fodda-accent/10 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-fodda-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <h3 className="font-serif text-xl font-bold text-stone-900">Security & Hardening</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto text-stone-600 leading-relaxed text-sm scrollbar-hide">
                    <section>
                        <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Executive Summary</h4>
                        <p>
                            Fodda is a privacy-first intelligence layer. We provide deterministic access to proprietary Knowledge Graphs, ensuring that AI responses are grounded in verified data, not synthetic generation.
                        </p>
                    </section>

                    <section className="pt-6 border-t border-stone-100">
                        <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Technical Hardening</h4>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-fodda-accent mt-1.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-stone-900">Strict Authentication</span>
                                    <p className="text-xs text-stone-500 mt-0.5">All API access requires a valid <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">X-API-Key</code>.</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-fodda-accent mt-1.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-stone-900">Identity Separation</span>
                                    <p className="text-xs text-stone-500 mt-0.5">Audit logs distinguish between System Identity (Service Accounts/API Keys) and Human Identity (User interactions).</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-fodda-accent mt-1.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-stone-900">Structured Audit Logging</span>
                                    <p className="text-xs text-stone-500 mt-0.5">Tracking of <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">requestId</code>, <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">latency</code>, and <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-800">graphId</code>.</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-fodda-accent mt-1.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-stone-900">Retention Mode</span>
                                    <p className="text-xs text-stone-500 mt-0.5">Hardware-level support for Privacy-First logging ("Metadata Only") as default.</p>
                                </div>
                            </li>
                        </ul>
                    </section>

                    <section className="pt-6 border-t border-stone-100">
                        <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Data Privacy & Governance</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                <p className="text-xs font-bold text-stone-900 mb-1">Zero Retention</p>
                                <p className="text-[10px] text-stone-500">We do not store prompt content or client query data by default.</p>
                            </div>
                            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                <p className="text-xs font-bold text-stone-900 mb-1">No Training</p>
                                <p className="text-[10px] text-stone-500">We do not use client queries to train underlying models.</p>
                            </div>
                        </div>
                    </section>

                    <section className="pt-6 border-t border-stone-100">
                        <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Architectural Isolation</h4>
                        <p>
                            Fodda maintains a strict separation between the deterministic data retrieval layer (API/Neo4j) and the orchestration layer (MCP/Frontend). This ensures that data access is always auditable and restricted to authorized tenants.
                        </p>
                    </section>
                </div>

                <div className="p-4 bg-stone-900 flex justify-between items-center shrink-0">
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest px-4">Contact: security@fodda.ai</p>
                    <button onClick={onClose} className="px-6 py-2 bg-stone-800 text-stone-100 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-fodda-accent transition-colors">Close</button>
                </div>
            </div>
        </div>
    );
};
