import React, { useEffect, useState } from 'react';

interface ToolCallTrace {
  tool: string;
  args: Record<string, any>;
  durationMs: number;
  resultPreview: string;
}

export interface ReceiptData {
  id: string;
  question: string;
  userEmail: string;
  graphId: string;
  timestamp: string;
  responseTimeMs: number | null;
  stepCount: number;
  source: string;
  evidenceDateRange?: string;
  humanExpertAttribution?: string | null;
  failureType?: string | null;
  toolCalls?: ToolCallTrace[];
}

interface AnswerReceiptDrawerProps {
  receiptId: string | null;
  receiptData?: ReceiptData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AnswerReceiptDrawer: React.FC<AnswerReceiptDrawerProps> = ({
  receiptId,
  receiptData: initialData,
  isOpen,
  onClose
}) => {
  const [data, setData] = useState<ReceiptData | null>(initialData || null);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      return;
    }

    if (receiptId && isOpen) {
      setLoading(true);
      fetch(`/api/account/receipt/${receiptId}`)
        .then(res => res.json())
        .then(res => {
          if (res.ok && res.receipt) {
            setData(res.receipt);
          }
        })
        .catch(err => console.error('[AnswerReceiptDrawer] Failed to fetch receipt:', err))
        .finally(() => setLoading(false));
    }
  }, [receiptId, initialData, isOpen]);

  if (!isOpen) return null;

  const shareableUrl = `${window.location.origin}/receipt/${data?.id || receiptId || ''}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10 border-l border-line">
        {/* Drawer Header */}
        <div className="p-6 border-b border-line flex items-center justify-between bg-paper">
          <div>
            <span className="eyebrow mb-1">Process Audit</span>
            <h2 className="font-serif italic text-2xl text-ink">Answer Receipt</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-ink-3 hover:text-ink hover:bg-cream rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand"></div>
            </div>
          ) : !data ? (
            <div className="p-8 text-center text-xs text-ink-3 italic bg-cream/40 rounded-2xl border border-line">
              Receipt data unavailable.
            </div>
          ) : (
            <>
              {/* Receipt Overview Card */}
              <div className="p-5 bg-paper border border-line rounded-2xl space-y-3">
                <p className="text-sm font-serif italic text-ink font-bold">"{data.question}"</p>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-line/60 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3 block">Domain Scope</span>
                    <span className="font-mono text-ink font-medium">{data.graphId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3 block">Executed Steps</span>
                    <span className="font-mono text-ink font-medium">{data.stepCount} steps ({data.source})</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3 block">Latency</span>
                    <span className="font-mono text-ink font-medium">{data.responseTimeMs ? `${data.responseTimeMs} ms` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3 block">Timestamp</span>
                    <span className="text-ink-2 font-medium">{new Date(data.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* 120-Day Evidence Recency Discipline */}
              <div className="p-5 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">120-Day Evidence Recency</span>
                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Active Recency Window
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Evidence range: <strong className="font-mono">{data.evidenceDateRange || '120-day active window'}</strong>. Fodda strictly enforces a 120-day evidence discipline so query answers never rely on stale historical assumptions.
                </p>
              </div>

              {/* Human Expert Attribution Banner */}
              {data.humanExpertAttribution && (
                <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 block">Human Agent Attribution</span>
                  <p className="text-xs text-purple-800">
                    Contributed by Human Expert Graph: <strong className="font-bold text-purple-900 font-mono">{data.humanExpertAttribution}</strong>. Revenue share attribution recorded.
                  </p>
                </div>
              )}

              {/* Tool Execution Trace */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider">Execution Tool Trace</h3>
                {(!data.toolCalls || data.toolCalls.length === 0) ? (
                  <div className="p-4 bg-cream/40 border border-line rounded-xl text-xs text-ink-3 italic">
                    Single-step direct retrieval call executed.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.toolCalls.map((tc, idx) => (
                      <div key={idx} className="p-4 bg-white border border-line rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            Step {idx + 1}: {tc.tool}
                          </span>
                          <span className="font-mono text-ink-3 text-[11px]">{tc.durationMs} ms</span>
                        </div>
                        {tc.args && Object.keys(tc.args).length > 0 && (
                          <div className="text-[11px] font-mono text-ink-3 bg-cream p-2 rounded border border-line/40 truncate">
                            Args: {JSON.stringify(tc.args)}
                          </div>
                        )}
                        {tc.resultPreview && (
                          <div className="text-xs text-ink-2 font-mono bg-paper p-2.5 rounded border border-line/60 line-clamp-3">
                            {tc.resultPreview}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Share Link */}
        <div className="p-4 border-t border-line bg-paper flex items-center justify-between">
          <span className="text-xs font-mono text-ink-3 truncate max-w-xs">{shareableUrl}</span>
          <button
            onClick={handleCopyLink}
            className="px-4 py-2 bg-brand text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-brand-dark transition-colors shadow-sm"
          >
            {copiedLink ? 'Copied Link!' : 'Copy Share URL'}
          </button>
        </div>
      </div>
    </div>
  );
};
