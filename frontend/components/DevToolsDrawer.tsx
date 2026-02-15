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
}

export const DevToolsDrawer: React.FC<DevToolsDrawerProps> = ({
    isOpen,
    onClose,
    transaction,
    isMcpMode,
    onToggleMcpMode
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



    return (
        <div className="fixed inset-0 z-50 flex justify-end transition-opacity duration-300">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />

            <div
                ref={drawerRef}
                className="relative h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-slide-in-right w-full max-w-2xl"
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


                        <div className="flex items-center gap-3">
                            {/* Simulation Indicator */}
                            {transaction?.response?.meta?.simulation?.active && (
                                <div className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border bg-blue-900/20 text-blue-400 border-blue-500/30 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                                    Sim: {transaction.response.meta.simulation.type || 'Generic'}
                                </div>
                            )}

                            {/* Mode Indicator (Read-only) */}
                            <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${isMcpMode ? 'bg-purple-900/20 text-purple-400 border-purple-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                                {isMcpMode ? 'MCP Mode' : 'API Mode'}
                            </div>

                            <button
                                onClick={onClose}
                                className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto font-mono text-xs bg-black">
                    {/* Standard Single View */}
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
                                                {isMcpMode ? 'MCP' : 'API'} Request Headers
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
                                            {isMcpMode ? 'MCP' : 'API'} Request Payload
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
                                            {isMcpMode ? 'MCP' : 'API'} Response Body
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
                </div>
            </div>
        </div>
    );
};
