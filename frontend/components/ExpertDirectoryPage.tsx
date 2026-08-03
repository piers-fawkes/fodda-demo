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

  // Categorization: Human Expert Twins vs. Synthetic Role Personas vs. Supplemental Data
  const isExpertPersona = (g: KnowledgeGraph) => {
    return g.graph_type === 'expert' || !!g.expert_slug || (g as any).isExpert === true;
  };

  const humanExperts = filtered.filter(g => {
    if (!isExpertPersona(g)) return false;
    const subType = (g.graph_sub_type || (g as any).graphSubType || '').toLowerCase().trim();
    return subType === 'human agent' || subType === 'digital twin' || (g as any).isVerifiedRealPerson === true;
  });

  const syntheticPersonas = filtered.filter(g => {
    if (!isExpertPersona(g)) return false;
    if (humanExperts.some(h => h.id === g.id)) return false;
    return true;
  });

  const supplementalGraphs = filtered.filter(g => {
    return !isExpertPersona(g);
  });

  const renderCard = (g: KnowledgeGraph) => {
    const portraitUrl = (g as any).portrait_url || g.image_url || 'https://ucarecdn.com/6e7893d7-6b14-426b-83bc-574a3f72d6bc/foddaminilogo.png';
    const name = g.name || g.domain || g.verticalName || 'Expert Twin';
    const headline = g.headline || g.description || 'Domain Intelligence & Expert Advice';
    const niche = (g as any).niche || (g as any).expertise || (g as any)['Niche Expertise'] || (g as any)['Niche']
      || (Array.isArray(g.topics) && g.topics.length > 0 ? g.topics.join(' · ') : null)
      || g.domain
      || g.headline
      || 'Domain Intelligence';

    const askLine = (g as any).askLine || (g as any).ask_line || (g as any)['Ask Line'] || (g as any)['Ask']
      || (Array.isArray(g.example_queries) && g.example_queries.length > 0 ? g.example_queries[0] : null)
      || (g.description ? `What is ${name}'s perspective on ${g.description.slice(0, 45)}?` : `Ask ${name}...`);
    
    const isHuman = humanExperts.some(h => h.id === g.id);
    const isSynthetic = syntheticPersonas.some(s => s.id === g.id);
    const isSupplemental = supplementalGraphs.some(s => s.id === g.id);

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
                {isHuman ? (
                  <span className="text-[9px] font-mono font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                    Verified Human
                  </span>
                ) : isSynthetic ? (
                  <span className="text-[9px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full shrink-0">
                    Synthetic Persona
                  </span>
                ) : (
                  <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full shrink-0">
                    Supplemental Data
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-3 mt-0.5 font-medium line-clamp-2">{headline}</p>
            </div>
          </div>

          {/* Niche & Blind Spots */}
          <div className="p-3 bg-white border border-line rounded-xl space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-ink-4">Niche Expertise</p>
            <p className="text-xs font-bold text-ink">{niche}</p>
          </div>

          {/* Ask Line */}
          <div className="p-3 bg-cream/60 rounded-xl border border-line/60">
            <p className="text-[11px] font-serif italic text-ink-2 truncate">"{askLine}"</p>
          </div>
        </div>

        {/* CTA */}
        <div>
          <button
            onClick={() => onAskExpert(g.id, askLine)}
            className="w-full px-4 py-3 bg-ink text-white font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-brand transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <span>Ask This Expert</span>
            <span>→</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <p className="eyebrow mb-1">Expert Roster</p>
          <h1 className="font-serif italic text-3xl text-ink font-normal">Expert Directory</h1>
          <p className="text-sm text-ink-3 mt-1">
            Pitch human expert twins, synthetic role personas, or supplemental data sources with domain expertise, turnaround times, and verified deliverables.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search experts by topic, niche, or keyword (e.g. cycling, GTM, alc-bev)..."
            className="w-full px-5 py-3.5 bg-paper border border-line rounded-2xl text-sm text-ink focus:outline-none focus:border-brand transition-colors pr-10 shadow-sm"
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

            {/* Supplemental Data & Knowledge Graphs */}
            {supplementalGraphs.length > 0 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <h2 className="font-serif italic text-2xl text-ink">Supplemental Data & Knowledge Graphs</h2>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                    Data & Benchmark Feeds ({supplementalGraphs.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {supplementalGraphs.map(renderCard)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
