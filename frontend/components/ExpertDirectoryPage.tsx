import React, { useEffect, useState } from 'react';
import { User, Account, KnowledgeGraph } from '../../shared/types';
import { dataService } from '../../shared/dataService';

interface ExpertDirectoryPageProps {
  user: User;
  account: Account;
  onAskExpert: (expertSlug: string, defaultQuery?: string) => void;
}

export const ExpertDirectoryPage: React.FC<ExpertDirectoryPageProps> = ({ user, account, onAskExpert }) => {
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    dataService.fetchGraphs(account?.apiKey || '')
      .then(res => {
        if (isMounted) {
          setGraphs(res || []);
        }
      })
      .catch(err => console.error('[ExpertDirectoryPage] Failed to fetch experts:', err))
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [account?.apiKey]);

  // Client-side deduplication by ID
  const uniqueGraphs = Array.from(
    new Map(graphs.map(g => [g.id.toLowerCase(), g])).values()
  );

  // Topic search matching across niche, topics, headline, domain, and curator name
  const filtered = uniqueGraphs.filter(g => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const name = (g.name || g.domain || g.verticalName || '').toLowerCase();
    const desc = (g.description || g.headline || '').toLowerCase();
    const niche = ((g as any).niche || (g as any).expertise || '').toLowerCase();
    const topics = Array.isArray((g as any).topics) ? (g as any).topics.join(' ').toLowerCase() : '';
    const curator = ((g as any).curatorName || (g as any).author || '').toLowerCase();

    return name.includes(q) || desc.includes(q) || niche.includes(q) || topics.includes(q) || curator.includes(q);
  });

  // Separate Human Expert Twins vs. Synthetic Role Personas
  const humanExperts = filtered.filter(g => {
    const isSynthetic = (g as any).isVerifiedRealPerson === false || (g as any).graphSubType === 'synthetic' || g.id.startsWith('synthetic-');
    return !isSynthetic;
  });

  const syntheticPersonas = filtered.filter(g => {
    const isSynthetic = (g as any).isVerifiedRealPerson === false || (g as any).graphSubType === 'synthetic' || g.id.startsWith('synthetic-');
    return isSynthetic;
  });

  const renderCard = (g: KnowledgeGraph) => {
    const portraitUrl = (g as any).portrait_url || g.image_url || 'https://ucarecdn.com/6e7893d7-6b14-426b-83bc-574a3f72d6bc/foddaminilogo.png';
    const name = g.name || g.domain || g.verticalName || 'Expert Twin';
    const headline = g.headline || g.description || 'Domain Intelligence & Expert Advice';
    const niche = (g as any).niche || (g as any).expertise || 'Sector & Strategic Analysis';
    const priceDisplay = (g as any).monthlyPriceUSD ? `$${(g as any).monthlyPriceUSD} / mo` : (g as any).tokenCost ? `${(g as any).tokenCost} calls` : '5–10 calls';
    const turnaround = (g as any).turnaroundTime || 'Real-time via MCP';
    const exampleQuery = g.example_queries?.[0] || `Show me emerging signals in ${name}`;
    const isSynthetic = (g as any).isVerifiedRealPerson === false || (g as any).graphSubType === 'synthetic' || g.id.startsWith('synthetic-');

    return (
      <div key={g.id} className="p-6 bg-paper border border-line rounded-3xl shadow-sm hover:border-brand/40 transition-all flex flex-col justify-between space-y-5">
        <div className="space-y-4">
          {/* Header & Portrait */}
          <div className="flex items-start space-x-4">
            <img
              src={portraitUrl}
              alt={name}
              className="w-14 h-14 rounded-2xl object-cover border border-line shadow-sm shrink-0 bg-cream"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-serif italic text-xl text-ink font-bold truncate">{name}</h3>
                {!isSynthetic ? (
                  <span className="text-[9px] font-mono font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                    Verified Human
                  </span>
                ) : (
                  <span className="text-[9px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full shrink-0">
                    Synthetic Persona
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-3 mt-0.5 font-medium line-clamp-2">{headline}</p>
            </div>
          </div>

          {/* Niche & Blind Spots */}
          <div className="p-3.5 bg-white border border-line/60 rounded-xl space-y-1.5 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-3 block">Niche Expertise</span>
              <span className="text-ink-2 font-medium">{niche}</span>
            </div>
            {(g as any).blindSpots && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Published Blind Spots</span>
                <span className="text-amber-900 text-[11px]">{(g as any).blindSpots}</span>
              </div>
            )}
          </div>

          {/* Deliverables & Pricing */}
          <div className="flex items-center justify-between text-xs pt-1 font-mono">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-ink-4 block font-sans">Turnaround</span>
              <span className="text-ink-2 font-bold">{turnaround}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold uppercase tracking-wider text-ink-4 block font-sans">Cost</span>
              <span className="text-brand font-bold">{priceDisplay}</span>
            </div>
          </div>

          {/* Example Query String */}
          <div className="p-3 bg-cream/60 border border-line/40 rounded-xl text-xs italic font-serif text-ink-2">
            "{exampleQuery}"
          </div>

          {/* Plain Cross-Referral Notice */}
          <p className="text-[10px] text-ink-4 leading-relaxed font-sans border-t border-line/40 pt-2">
            *If this expert cannot answer, your query is automatically handed to another expert or the underlying domain graphs.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onAskExpert(g.id, exampleQuery)}
          className="w-full py-2.5 bg-ink hover:bg-ink-2 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-sm"
        >
          Ask This Expert →
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
      {/* Header */}
      <div className="px-8 pt-8 pb-4">
        <p className="eyebrow mb-1">Expert Roster</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Expert Directory</h1>
        <p className="text-sm text-ink-3 mt-1 max-w-2xl">
          Pitch human expert twins or synthetic role personas with domain expertise, turnaround times, and verified deliverables.
        </p>
      </div>

      <div className="px-8 pb-8 space-y-10 max-w-6xl">
        {/* Topic Search Bar */}
        <div className="relative max-w-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search experts by topic, niche, or keyword (e.g. cycling, GTM, alc-bev)..."
            className="w-full bg-paper border border-line rounded-2xl px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand/40 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-4 hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand"></div>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Human Expert Twins */}
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 className="font-serif italic text-2xl text-ink">Human Expert Twins</h2>
                <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                  Verified Real Persons ({humanExperts.length})
                </span>
              </div>

              {humanExperts.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-3 italic bg-cream/40 rounded-2xl border border-line">
                  No human experts match "{searchQuery}".
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {humanExperts.map(renderCard)}
                </div>
              )}
            </div>

            {/* Synthetic Role Personas */}
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 className="font-serif italic text-2xl text-ink">Synthetic Role Personas</h2>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full">
                  AI Domain Personas ({syntheticPersonas.length})
                </span>
              </div>

              {syntheticPersonas.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-3 italic bg-cream/40 rounded-2xl border border-line">
                  No synthetic role personas match "{searchQuery}".
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {syntheticPersonas.map(renderCard)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
