import React from 'react';

interface PageShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Chat views fill the width; everything else uses the 1000px column. */
  full?: boolean;
  children: React.ReactNode;
}

/**
 * The only page wrapper. Owns scroll, width, gutters, and the header block.
 * Pages must not set their own outer padding or max-width.
 *
 * Rhythm: 24px above the header, 16px header to first block, 12px between blocks.
 * Use <div className="space-y-3"> (12px) for the children stack.
 */
export const PageShell: React.FC<PageShellProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
  full = false,
  children,
}) => (
  <div className="flex-1 overflow-y-auto custom-scrollbar bg-cream">
    <div className={`mx-auto px-[26px] pt-6 pb-8 ${full ? 'max-w-none' : 'max-w-[1000px]'}`}>
      <header className="flex items-end justify-between gap-6 mb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-ink-3 mb-1">
            {eyebrow}
          </p>
          <h1 className="font-serif italic text-[27px] leading-[1.1] tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] text-ink-3 mt-[3px] truncate font-medium">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </header>

      <div className="space-y-3">{children}</div>
    </div>
  </div>
);
