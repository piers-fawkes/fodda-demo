import React, { useRef, useEffect, useState, useMemo } from 'react';

// Generate a paste-ready cURL command from the transaction
function generateCurlCommand(transaction: { request: any; headers?: any; response?: any }): string {
    const headers = (transaction as any).headers || (transaction.request as any).headers || {};
    const body = transaction.request;
    // Derive URL from request if available, otherwise use placeholder
    const url = (transaction.request as any).url || 'https://api.fodda.ai/v1/graphs/{graph_id}/search';
    const lines = [`curl -X POST '${url}' \\`];
    lines.push(`  -H 'Content-Type: application/json' \\`);
    if (headers['X-API-Key'] || headers['x-api-key']) {
        lines.push(`  -H 'X-API-Key: ${headers['X-API-Key'] || headers['x-api-key']}' \\`);
    }
    // Remove internal-only fields from body copy
    const cleanBody = { ...body };
    delete cleanBody.url;
    delete cleanBody.headers;
    lines.push(`  -d '${JSON.stringify(cleanBody, null, 2)}'`);
    return lines.join('\n');
}

// Generate a paste-ready Python snippet from the transaction
function generatePythonSnippet(transaction: { request: any; headers?: any; response?: any }): string {
    const headers = (transaction as any).headers || (transaction.request as any).headers || {};
    const body = transaction.request;
    const url = (transaction.request as any).url || 'https://api.fodda.ai/v1/graphs/{graph_id}/search';
    const cleanBody = { ...body };
    delete cleanBody.url;
    delete cleanBody.headers;
    const apiKey = headers['X-API-Key'] || headers['x-api-key'] || 'YOUR_API_KEY';
    return `import requests\n\nresponse = requests.post(\n    "${url}",\n    headers={\n        "Content-Type": "application/json",\n        "X-API-Key": "${apiKey}"\n    },\n    json=${JSON.stringify(cleanBody, null, 4)}\n)\n\nprint(response.json())`;
}

interface DevToolsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: {
        request: any;
        response: any;
        durationMs: number;
        timestamp: number;
    } | null;
    isMcpMode: boolean;
    onToggleMcpMode: () => void;
    simulationMode: string | null;
    onSimulationChange: (mode: string | null) => void;
    reasoningMode?: 'graph' | 'gemini' | 'blended';
}

const CopyButton: React.FC<{ data: any; label?: string; size?: 'sm' | 'md' }> = ({ data, label = 'Copy', size = 'sm' }) => {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(typeof data === 'string' ? data : JSON.stringify(data, null, 2)).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                });
            }}
            className={`rounded-lg font-bold uppercase tracking-widest font-mono border transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm
                ${copied ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-ink-3 border-line hover:text-ink hover:border-line-strong active:scale-95'}
                ${size === 'md' ? 'px-4 py-2 text-[9px]' : 'px-2 py-1 text-[8px]'}`}
        >
            {copied ? (
                <svg className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
                <svg className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
            {copied ? 'Copied' : label}
        </button>
    );
};

export const DevToolsDrawer: React.FC<DevToolsDrawerProps> = ({
    isOpen,
    onClose,
    transaction,
    isMcpMode,
    onToggleMcpMode,
    simulationMode,
    onSimulationChange,
    reasoningMode = 'graph'
}) => {
    const drawerRef = useRef<HTMLDivElement>(null);
    const [systemStatus, setSystemStatus] = useState<any>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // Fetch System Validation
            fetch('/v1/system/validation')
                .then(res => res.json())
                .then(setSystemStatus)
                .catch(err => console.error("System validation fetch failed", err));
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const isGemini = reasoningMode === 'gemini';
    const mode = isGemini ? 'Gemini' : isMcpMode ? 'MCP' : 'API';

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-md" onClick={onClose} />

            <div
                ref={drawerRef}
                className="relative h-full bg-white border-l border-line shadow-2xl flex flex-col animate-slide-in-right w-full max-w-3xl"
            >
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-8 border-b border-line bg-cream shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${systemStatus?.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                        <h2 className="eyebrow mt-0.5">Diagnostic Console</h2>
                        <div className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${isGemini ? 'bg-blue-50 text-blue-700 border-blue-200' : isMcpMode ? 'bg-brand-soft text-brand border-brand/20' : 'bg-paper text-ink-3 border-line'}`}>
                            {mode}
                        </div>
                        
                        {!isGemini && isMcpMode && (
                            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-line">
                                <button
                                    onClick={() => onSimulationChange(simulationMode === 'gemini_echo' ? null : 'gemini_echo')}
                                    className={`relative inline-flex items-center h-4.5 w-9 rounded-full transition-colors duration-200 focus:outline-none border border-line shadow-inner ${simulationMode === 'gemini_echo' ? 'bg-brand' : 'bg-cream'}`}
                                >
                                    <span className={`inline-block w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${simulationMode === 'gemini_echo' ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${simulationMode === 'gemini_echo' ? 'text-brand' : 'text-ink-4'}`}>
                                    {simulationMode === 'gemini_echo' ? 'Echo Simulation' : 'Live Stream'}
                                </span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-ink-4 hover:text-ink transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto font-mono text-xs bg-white custom-scrollbar">
                    <div className="p-8 space-y-10">
                        {!transaction ? (
                            <div className="h-[60vh] flex flex-col items-center justify-center text-ink-4 space-y-6">
                                <div className="w-20 h-20 bg-cream/50 rounded-3xl flex items-center justify-center border border-line shadow-sm border-dashed">
                                    <svg className="w-10 h-10 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                                <div className="text-center max-w-xs space-y-2">
                                    {isGemini ? (
                                        <>
                                            <p className="text-sm font-bold text-ink">Bypassing Fodda API</p>
                                            <p className="text-[10px] text-ink-3 leading-relaxed">Direct Google Gemini grounding active. Switch to PSFK Graph mode to inspect structured RAG traffic.</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-bold text-ink">Waiting for Ingress</p>
                                            <p className="text-[10px] text-ink-3 leading-relaxed">Submit a query in the sandbox to monitor real-time graph traversal and LLM synthesis payloads.</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Metadata Row */}
                                <div className="flex items-center justify-between bg-paper rounded-2xl px-6 py-4 border border-line shadow-sm">
                                    <div className="flex items-center gap-8 text-[10px]">
                                        <div>
                                            <span className="eyebrow block mb-1">Latency</span>
                                            <span className="text-ink font-bold font-mono tracking-tight">{transaction.durationMs}ms</span>
                                        </div>
                                        <div>
                                            <span className="eyebrow block mb-1">HTTP / Status</span>
                                            <span className="text-green-600 font-bold font-mono tracking-tight">200 OK</span>
                                        </div>
                                        <div>
                                            <span className="eyebrow block mb-1">Timestamp</span>
                                            <span className="text-ink-2 font-mono tracking-tight">{new Date(transaction.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                        {systemStatus?.build_fingerprint && (
                                            <div>
                                                <span className="eyebrow block mb-1">Build Hash</span>
                                                <span className="text-brand font-mono tracking-tight">{systemStatus.build_fingerprint}</span>
                                            </div>
                                        )}
                                    </div>
                                    <CopyButton
                                        data={{
                                            headers: (transaction as any).headers || (transaction.request as any).headers,
                                            request: transaction.request,
                                            response: transaction.response,
                                            durationMs: transaction.durationMs,
                                            timestamp: transaction.timestamp
                                        }}
                                        label="Export Suite"
                                        size="md"
                                    />
                                </div>

                                {/* System Constraints */}
                                {systemStatus && (
                                    <details className="group">
                                        <summary className="flex items-center gap-3 cursor-pointer text-ink hover:text-brand transition-colors py-2 border-b border-line">
                                            <svg className="w-4 h-4 transition-transform duration-200 group-open:rotate-90 text-ink-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                            <span className="eyebrow">Environment Constants</span>
                                            <div className="flex-1" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100 italic">Active Runtime</span>
                                        </summary>
                                        <div className="mt-4 p-6 bg-paper rounded-2xl border border-line shadow-inner grid grid-cols-2 gap-x-12 gap-y-2">
                                            {['schema_version', 'graph_version', 'api_version', 'mcp_tool_version', 'app_version'].map(key => (
                                                systemStatus[key] ? (
                                                    <div key={key} className="flex justify-between items-center text-[10px] py-1 border-b border-line last:border-0 border-dashed">
                                                        <span className="text-ink-4 font-bold uppercase tracking-wider">{key.replace(/_/g, ' ')}</span>
                                                        <span className="text-ink font-mono font-bold tracking-tight">{systemStatus[key]}</span>
                                                    </div>
                                                ) : null
                                            ))}
                                            {systemStatus.max_limits && Object.entries(systemStatus.max_limits).map(([k, v]) => (
                                                <div key={k} className="flex justify-between items-center text-[10px] py-1 border-b border-line last:border-0 border-dashed">
                                                    <span className="text-ink-4 font-bold uppercase tracking-wider">{k.replace(/_/g, ' ')}</span>
                                                    <span className="text-ink font-mono font-bold tracking-tight">{String(v)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}

                                {/* Request Stack */}
                                <div className="space-y-8">
                                    {/* Headers */}
                                    {((transaction.request as any).headers || (transaction as any).headers) && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-brand" />
                                                    <h3 className="eyebrow">Request Foundation</h3>
                                                </div>
                                                <CopyButton data={(transaction as any).headers || (transaction.request as any).headers} label="Headers" size="md" />
                                            </div>
                                            <div className="relative group">
                                                <pre className="bg-ink p-5 rounded-2xl border border-line-strong overflow-x-auto text-cream/80 leading-relaxed text-[11px] max-h-[300px] shadow-lg shadow-ink/10">
                                                    {JSON.stringify((transaction as any).headers || (transaction.request as any).headers, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payload */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                <h3 className="eyebrow">Ingress Payload</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <CopyButton data={generateCurlCommand(transaction)} label="cURL" size="md" />
                                                <CopyButton data={generatePythonSnippet(transaction)} label="Python" size="md" />
                                                <CopyButton data={transaction.request} label="JSON" size="md" />
                                            </div>
                                        </div>
                                        <pre className="bg-ink p-6 rounded-2xl border border-line-strong overflow-x-auto text-cream/90 leading-relaxed text-[11px] max-h-[400px] shadow-lg shadow-ink/10">
                                            {JSON.stringify(transaction.request, null, 2)}
                                        </pre>
                                    </div>

                                    {/* Response Body */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                                <h3 className="eyebrow">Egress Synthesis</h3>
                                            </div>
                                            <CopyButton data={transaction.response} label="Response" size="md" />
                                        </div>
                                        <pre className="bg-ink p-6 rounded-2xl border border-line-strong overflow-x-auto text-green-400/90 leading-relaxed text-[11px] max-h-[500px] shadow-lg shadow-ink/10">
                                            {JSON.stringify(transaction.response, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Footer / Status Bar */}
                <div className="h-10 bg-paper border-t border-line flex items-center justify-between px-8 shrink-0">
                    <span className="text-[9px] font-black text-ink-4 uppercase tracking-[0.2em]">Diagnostic Mode [Enabled]</span>
                    <span className="text-[9px] font-mono font-bold text-ink-3">CTRL + SHIFT + D to toggle</span>
                </div>
            </div>
        </div>
    );
};
