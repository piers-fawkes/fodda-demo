import React, { useRef, useEffect, useState } from 'react';

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
    onCompare?: () => void;
    comparisonStatus?: 'idle' | 'running' | 'success' | 'error';
    comparisonResults?: { direct: any; mcp: any } | null;
    onClearComparison?: () => void;
}

export const DevToolsDrawer: React.FC<DevToolsDrawerProps> = ({
    isOpen,
    onClose,
    transaction,
    isMcpMode,
    onToggleMcpMode,
    onCompare,
    comparisonStatus = 'idle',
    comparisonResults,
    onClearComparison
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

    const isComparisonView = comparisonStatus === 'success';

    return (
        <div className="fixed inset-0 z-50 flex justify-end transition-opacity duration-300">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />

            <div
                ref={drawerRef}
                className={`relative h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-slide-in-right ${isComparisonView ? 'w-full max-w-5xl' : 'w-full max-w-2xl'}`} // Wider for comparison
            >
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`p-1.5 rounded-md ${systemStatus?.ok ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white tracking-tight">MCP Test Harness</h2>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-mono ${systemStatus?.deterministic_mode_status === 'ENFORCED' ? 'text-green-400' : 'text-zinc-500'}`}>
                                    Deterministic: {systemStatus?.deterministic_mode_status || 'UNKNOWN'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Comparison Controls */}
                        {onCompare && transaction && (
                            <div className="flex items-center gap-2 mr-4 border-r border-zinc-800 pr-4">
                                {isComparisonView ? (
                                    <button
                                        onClick={onClearComparison}
                                        className="text-[10px] font-bold text-zinc-400 hover:text-white uppercase tracking-wider"
                                    >
                                        Close Comparison
                                    </button>
                                ) : (
                                    <button
                                        onClick={onCompare}
                                        disabled={comparisonStatus === 'running'}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-bold rounded-md border border-zinc-800 transition-all uppercase tracking-wider"
                                    >
                                        {comparisonStatus === 'running' ? (
                                            <span className="w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                        )}
                                        Compare Modes
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="flex items-center space-x-2 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                            <button
                                onClick={() => isMcpMode && onToggleMcpMode()}
                                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${!isMcpMode ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Direct
                            </button>
                            <button
                                onClick={() => !isMcpMode && onToggleMcpMode()}
                                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${isMcpMode ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                MCP Agent
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto font-mono text-xs bg-black">
                    {comparisonStatus === 'success' && comparisonResults ? (
                        <div className="grid grid-cols-2 h-full divide-x divide-zinc-800">
                            {/* Direct Column */}
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                    <h3 className="text-zinc-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-zinc-600"></span>
                                        Direct API
                                    </h3>
                                    <span className="text-[10px] text-zinc-600">{comparisonResults.direct?.requestId}</span>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded">
                                            <div className="text-[9px] text-zinc-500 uppercase">Usage</div>
                                            <div className="text-white font-bold text-lg">{comparisonResults.direct?.meta?.usage?.billable_units ?? '-'}</div>
                                        </div>
                                        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded">
                                            <div className="text-[9px] text-zinc-500 uppercase">Latency</div>
                                            <div className="text-white font-bold">{transaction?.durationMs}ms</div> {/* Approve logic: might not match comparison run exact latency unless we tracked it */}
                                        </div>
                                    </div>
                                    <pre className="text-[10px] text-zinc-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(comparisonResults.direct, null, 2)}</pre>
                                </div>
                            </div>

                            {/* MCP Column */}
                            <div className="p-6 space-y-6 bg-purple-900/5">
                                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                    <h3 className="text-purple-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                        MCP Agent
                                    </h3>
                                    <span className="text-[10px] text-purple-400/60">{comparisonResults.mcp?.requestId}</span>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className={`p-3 border rounded ${comparisonResults.mcp?.meta?.usage?.billable_units === comparisonResults.direct?.meta?.usage?.billable_units ? 'bg-green-900/20 border-green-900/50' : 'bg-red-900/20 border-red-900/50'}`}>
                                            <div className="text-[9px] text-zinc-500 uppercase">Usage</div>
                                            <div className="text-white font-bold text-lg">{comparisonResults.mcp?.meta?.usage?.billable_units ?? '-'}</div>
                                        </div>
                                        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded">
                                            <div className="text-[9px] text-zinc-500 uppercase">Latency</div>
                                            <div className="text-white font-bold">-</div>
                                        </div>
                                    </div>
                                    <pre className="text-[10px] text-purple-200/80 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(comparisonResults.mcp, null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Standard Single View
                        <div className="p-6 space-y-8">
                            {!transaction ? (
                                <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-600 space-y-4">
                                    <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    <p>Waiting for API requests...</p>
                                    <p className="text-[10px] text-zinc-700">Make a query in the chat to see traffic.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Limits & Status */}
                                    {systemStatus && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider">System Constraints</div>
                                                    <span className="text-[9px] text-green-500 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/50">Active</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-zinc-500">Schema</span>
                                                        <span className="text-zinc-300 font-mono">{systemStatus.schema_version}</span>
                                                    </div>
                                                    {systemStatus.limits && Object.entries(systemStatus.limits).map(([k, v]) => (
                                                        <div key={k} className="flex justify-between text-[10px]">
                                                            <span className="text-zinc-500 capitalize">{k.replace(/_/g, ' ').toLowerCase()}</span>
                                                            <span className="text-zinc-300 font-mono">{String(v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                                                <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-2">Transaction Metadata</div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-zinc-500">Latency</span>
                                                        <span className="text-white font-mono">{transaction.durationMs}ms</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-zinc-500">Status</span>
                                                        <span className="text-green-400 font-mono">200 OK</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-zinc-500">Timestamp</span>
                                                        <span className="text-zinc-400 font-mono">{new Date(transaction.timestamp).toLocaleTimeString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Request Headers */}
                                    {(transaction.request as any).headers || (transaction as any).headers ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                                    Request Headers
                                                </h3>
                                            </div>
                                            <div className="relative group">
                                                <pre className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 overflow-x-auto text-orange-200/80 leading-relaxed whitespace-pre-wrap text-[11px]">
                                                    {JSON.stringify((transaction as any).headers || (transaction.request as any).headers, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Request Payload */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                Request Payload
                                            </h3>
                                            <span className="text-[10px] bg-zinc-900 px-2 py-1 rounded text-zinc-500">POST /api/query</span>
                                        </div>
                                        <div className="relative group">
                                            <pre className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 overflow-x-auto text-zinc-300 leading-relaxed whitespace-pre-wrap text-[11px]">
                                                {JSON.stringify(transaction.request, null, 2)}
                                            </pre>
                                        </div>
                                    </div>

                                    {/* Response Body */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                                Response Body
                                            </h3>
                                            <span className="text-[10px] text-zinc-600">Raw JSON</span>
                                        </div>
                                        <div className="relative group">
                                            <pre className="bg-zinc-900/80 p-5 rounded-2xl border border-zinc-800 overflow-x-auto text-green-400/90 leading-relaxed whitespace-pre-wrap text-[11px]">
                                                {JSON.stringify(transaction.response, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
