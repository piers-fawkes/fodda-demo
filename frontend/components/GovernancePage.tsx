import React from 'react';

/**
 * GovernancePage — mock-up of governance categories.
 * This is a placeholder for future implementation.
 */
export const GovernancePage: React.FC = () => {
  const categories = [
    {
      title: 'Data Access Controls',
      description: 'Manage which teams and roles can access specific knowledge graphs, supplemental data sources, and API endpoints.',
      status: 'Coming Soon',
      items: ['Graph-level permissions', 'Team-based access groups', 'IP allowlisting', 'API key scoping']
    },
    {
      title: 'User Permissions',
      description: 'Define fine-grained permissions for organization members across the platform.',
      status: 'Coming Soon',
      items: ['Role hierarchy (Owner → Admin → Analyst → Viewer)', 'Custom roles', 'Permission inheritance', 'Delegated admin']
    },
    {
      title: 'Audit & Compliance',
      description: 'Track all data access, queries, and administrative actions across your organization.',
      status: 'Coming Soon',
      items: ['Full query audit trail', 'Admin action log', 'Export audit reports', 'Compliance dashboards']
    },
    {
      title: 'Data Retention',
      description: 'Configure how long query logs, session data, and analytics are retained.',
      status: 'Coming Soon',
      items: ['Configurable retention periods', 'Auto-purge policies', 'Data export before deletion', 'GDPR compliance']
    },
    {
      title: 'Content Policies',
      description: 'Set guardrails around what content can be queried, how responses are synthesized, and output formatting rules.',
      status: 'Coming Soon',
      items: ['Query content filters', 'Response style guidelines', 'Brand voice enforcement', 'Citation requirements']
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 pt-8 pb-4">
        <p className="eyebrow mb-1">Account</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Governance.</h1>
        <p className="text-sm text-ink-3 mt-1">Control how your organization accesses and interacts with Fodda's intelligence layer.</p>
      </div>
      <div className="px-8 pb-8 max-w-4xl space-y-8">

        {/* Status Banner */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0">⚡</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-700">Governance Features — Preview</p>
            <p className="text-xs text-amber-600 mt-0.5">These controls are currently in development. Below is a preview of the governance capabilities planned for your account.</p>
          </div>
        </div>

        {/* Category Cards */}
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat.title} className="bg-paper border border-line rounded-xl p-6 hover:border-line-strong transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-ink">{cat.title}</h3>
                      <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-md">{cat.status}</span>
                    </div>
                    <p className="text-xs text-ink-3 leading-relaxed">{cat.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {cat.items.map(item => (
                        <span key={item} className="px-2 py-0.5 text-[9px] font-medium text-ink-2 bg-cream border border-line rounded-md">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Disabled toggle */}
                <div className="relative w-10 h-5 rounded-full bg-ink-5 opacity-40 cursor-not-allowed shrink-0">
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-ink-4 rounded-full shadow" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center py-4">
          <p className="text-xs text-ink-3">Want early access to Governance features? <a href="mailto:support@fodda.ai" className="text-brand hover:underline font-bold">Contact us</a></p>
        </div>
      </div>
    </div>
  );
};
