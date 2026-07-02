
import React from 'react';

interface SecurityModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up border border-line flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-line flex justify-between items-center bg-cream shrink-0">
                    <div className="flex items-center space-x-3">
                        <div className="bg-brand-soft p-2 rounded-lg border border-brand/10">
                            <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <h3 className="font-serif italic text-xl text-ink">Security & Hardening</h3>
                    </div>
                    <button onClick={onClose} className="p-2 text-ink-4 hover:text-ink transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto text-ink-2 leading-relaxed text-sm scrollbar-hide bg-white">
                    <section>
                        <h4 className="eyebrow mb-4">Executive Summary</h4>
                        <p className="text-ink-2">
                            Fodda is a privacy-first intelligence layer. We provide deterministic access to proprietary Knowledge Graphs, ensuring that AI responses are grounded in verified data, not synthetic generation.
                        </p>
                    </section>

                    <section className="pt-6 border-t border-line">
                        <h4 className="eyebrow mb-4">Where Google Fits (and Doesn't)</h4>
                        <p className="mb-4 text-ink-2">
                            Fodda is hosted on Google Cloud Platform, but Google does not have access to your queries or data.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-ink-2">
                                <thead>
                                    <tr className="border-b border-line">
                                        <th className="py-2 eyebrow font-bold text-ink">Access Method</th>
                                        <th className="py-2 eyebrow font-bold text-ink">Google Involvement</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    <tr>
                                        <td className="py-3 pr-4 font-bold text-ink align-top">API</td>
                                        <td className="py-3 align-top text-ink-3">None. Queries go directly to Neo4j. No Google software is in the path.</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 pr-4 font-bold text-ink align-top">App / MCP</td>
                                        <td className="py-3 align-top text-ink-3">A lightweight orchestration agent runs via Gemini, but receives task instructions only &mdash; not your underlying data.</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 pr-4 font-bold text-ink align-top">BYOK (Roadmap)</td>
                                        <td className="py-3 align-top text-ink-3">Enterprise clients will be able to supply their own Gemini API key, so any LLM interaction runs under their own Google agreement.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-4 text-xs italic text-ink-4 leading-relaxed">
                            We've architected Fodda so that shifting to a different LLM provider would require zero changes to the data layer. Google is an infrastructure choice, not a data dependency.
                        </p>
                    </section>

                    <section className="pt-6 border-t border-line">
                        <h4 className="eyebrow mb-4">Technical Hardening</h4>
                        <ul className="space-y-6">
                            <li className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-ink">Strict Authentication &amp; API Key Handling</span>
                                    <p className="text-xs text-ink-3 mt-1 leading-relaxed">All API access requires a valid <code className="bg-cream px-1.5 py-0.5 rounded text-ink-2 font-mono border border-line">X-API-Key</code>. Raw API keys are never stored &mdash; they're SHA-256 hashed into fingerprints. Fingerprints are used for audit trails, never the raw key. Keys are scoped to specific accounts and data verticals.</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-ink">Identity Separation</span>
                                    <p className="text-xs text-ink-3 mt-1 leading-relaxed">Audit logs distinguish between System Identity (Service Accounts/API Keys) and Human Identity (User interactions).</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-ink">Structured Audit Logging</span>
                                    <p className="text-xs text-ink-3 mt-1 leading-relaxed">Tracking of <code className="bg-cream px-1.5 py-0.5 rounded text-ink-2 font-mono border border-line">requestId</code>, <code className="bg-cream px-1.5 py-0.5 rounded text-ink-2 font-mono border border-line">latency</code>, and <code className="bg-cream px-1.5 py-0.5 rounded text-ink-2 font-mono border border-line">graphId</code>.</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-ink">Prompt Injection Prevention</span>
                                    <p className="text-xs text-ink-3 mt-1 leading-relaxed">The API rejects any request body containing prompt fields at the schema level. Fodda is a structured data retrieval layer &mdash; there is no prompt surface to exploit.</p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                                <div>
                                    <span className="font-bold text-ink">Depth & Expansion Guardrails</span>
                                    <p className="text-xs text-ink-3 mt-1 leading-relaxed">Hard server-side limits on query depth, expansion rates, and result counts. Rate limiting on public endpoints. All caps are enforced at the database driver level and cannot be overridden by client parameters.</p>
                                </div>
                            </li>
                        </ul>
                    </section>

                    <section className="pt-6 border-t border-line">
                        <h4 className="eyebrow mb-4">Compliance &amp; Roadmap</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-5 bg-paper rounded-xl border border-line">
                                <span className="text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-2 block">Today</span>
                                <p className="text-xs text-ink-2 leading-relaxed">NIST CSF 2.0 aligned, GDPR/CCPA compliant, metadata-only audit logging, DPA available.</p>
                            </div>
                            <div className="p-5 bg-paper rounded-xl border border-line border-brand/20 shadow-sm shadow-brand/5">
                                <span className="text-[10px] font-bold text-brand uppercase tracking-widest mb-2 block">Enterprise Stack</span>
                                <p className="text-xs text-ink-2 leading-relaxed">SOC 2 Type II readiness, SAML 2.0 / OIDC for enterprise SSO, BYOK model for LLM grounding calls.</p>
                            </div>
                        </div>
                    </section>

                    <section className="pt-6 border-t border-line">
                        <h4 className="eyebrow mb-4">Architectural Isolation</h4>
                        <p className="mb-4 text-ink-2">
                            Fodda maintains a strict separation between the deterministic data retrieval layer (API/Neo4j) and the orchestration layer.
                        </p>
                        <div className="bg-cream p-4 rounded-xl border border-line font-mono text-[10px] text-ink-3 whitespace-pre overflow-x-auto shadow-inner">
                            {`Client → HTTPS/TLS → Fodda API → Neo4j Graph DB
                         ↓ (App/MCP only)
                    Gemini Agent (task instructions only, no data)`}
                        </div>
                    </section>
                </div>

                <div className="p-5 bg-ink flex justify-between items-center shrink-0">
                    <p className="text-[10px] text-cream/40 font-bold uppercase tracking-widest px-4">Contact: security@fodda.ai</p>
                    <button onClick={onClose} className="px-8 py-2.5 bg-brand text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand/20">Close</button>
                </div>
            </div>
        </div>
    );
};
