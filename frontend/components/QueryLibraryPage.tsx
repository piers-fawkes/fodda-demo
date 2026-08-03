import React, { useEffect, useState } from 'react';
import { User, Account } from '../../shared/types';

interface QueryLibraryPageProps {
  user: User;
  account: Account;
  onTryPrompt: (promptText: string, graphId?: string) => void;
}

interface JobCategory {
  id: string;
  label: string;
  tool: string;
  estimatedCalls: string;
  description: string;
}

interface PromptItem {
  id: string;
  text: string;
  graphId: string;
  buyerType?: string;
}

export const QueryLibraryPage: React.FC<QueryLibraryPageProps> = ({ user, account, onTryPrompt }) => {
  const [jobs, setJobs] = useState<JobCategory[]>([]);
  const [promptsByJob, setPromptsByJob] = useState<Record<string, PromptItem[]>>({});
  const [activeJobId, setActiveJobId] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/prompts')
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.ok) {
          setJobs(data.jobs || []);
          setPromptsByJob(data.promptsByJob || {});
        }
      })
      .catch(err => console.error('[QueryLibraryPage] Failed to fetch prompts:', err))
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, []);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredJobs = activeJobId === 'all' ? jobs : jobs.filter(j => j.id === activeJobId);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <p className="eyebrow mb-1">Sample Prompts & Research Workflows</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Query & Prompt Library</h1>
        <p className="text-sm text-ink-3 mt-1 max-w-2xl">
          Pre-tested research queries organized by work goal. Select a work category below to copy prompt templates or run them directly in the sandbox against your Fodda knowledge graphs.
        </p>
      </div>

      <div className="px-8 pb-8 space-y-8 max-w-6xl">
        {/* Job Category Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto custom-scrollbar pb-2 border-b border-line">
          <button
            onClick={() => setActiveJobId('all')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
              activeJobId === 'all'
                ? 'bg-ink text-white shadow-sm'
                : 'bg-paper text-ink-3 hover:bg-cream hover:text-ink border border-line'
            }`}
          >
            All Jobs ({jobs.length})
          </button>
          {jobs.map(job => {
            const count = (promptsByJob[job.id] || []).length;
            return (
              <button
                key={job.id}
                onClick={() => setActiveJobId(job.id)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                  activeJobId === job.id
                    ? 'bg-ink text-white shadow-sm'
                    : 'bg-paper text-ink-3 hover:bg-cream hover:text-ink border border-line'
                }`}
              >
                {job.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand"></div>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredJobs.map(job => {
              const promptList = promptsByJob[job.id] || [];
              if (promptList.length === 0) return null;

              return (
                <div key={job.id} className="space-y-4">
                  {/* Job Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-line/60 gap-2">
                    <div>
                      <h2 className="font-serif italic text-2xl text-ink">{job.label}</h2>
                      <p className="text-xs text-ink-3 mt-0.5">{job.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full">
                        Runs {job.tool}
                      </span>
                      <span className="text-[11px] font-bold text-ink-3 bg-cream border border-line px-3 py-1 rounded-full">
                        {job.estimatedCalls}
                      </span>
                    </div>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {promptList.map(item => (
                      <div
                        key={item.id}
                        className="p-6 bg-paper border border-line rounded-2xl shadow-sm hover:border-brand/40 transition-all duration-200 flex flex-col justify-between space-y-4"
                      >
                        <p className="text-sm font-medium text-ink leading-relaxed font-serif italic">
                          "{item.text}"
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t border-line/40">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3 font-mono">
                            Domain: {item.graphId}
                          </span>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleCopy(item.id, item.text)}
                              className="px-3 py-1.5 bg-white border border-line hover:border-ink text-ink text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all"
                            >
                              {copiedId === item.id ? 'Copied!' : 'Copy'}
                            </button>
                            <button
                              onClick={() => onTryPrompt(item.text, item.graphId)}
                              className="px-3.5 py-1.5 bg-brand hover:bg-brand-dark text-white text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all shadow-sm"
                            >
                              Try in Test Bench
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
