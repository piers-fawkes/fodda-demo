import React, { useState, useRef, useEffect } from 'react';

// ─── Eyebrow ─────────────────────────────────────────────────────
export const Eyebrow: React.FC<{
  children: React.ReactNode;
  brand?: boolean;
  error?: boolean;
  style?: React.CSSProperties;
}> = ({ children, brand, error, style }) => (
  <div
    className="font-mono font-bold uppercase"
    style={{
      fontSize: 10, letterSpacing: '0.24em',
      color: error ? '#b91c1c' : brand ? 'var(--brand)' : 'var(--ink-3)',
      ...style,
    }}
  >{children}</div>
);

// ─── Masthead ────────────────────────────────────────────────────
export const Masthead: React.FC = () => (
  <div
    className="flex items-baseline gap-3.5"
    style={{ paddingBottom: 14, marginBottom: 26, borderBottom: '1px solid var(--ink)' }}
  >
    <img
      src="https://ucarecdn.com/6e7893d7-6b14-426b-83bc-574a3f72d6bc/foddaminilogo.png"
      alt="Fodda"
      className="w-7 h-7 object-contain self-center"
      style={{ marginRight: 2 }}
    />
    <div className="font-serif italic" style={{ fontSize: 32, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.01em' }}>
      Fodda
    </div>
    <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--ink-4)' }} />
    <div className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.16em', textTransform: 'uppercase', flex: 1, lineHeight: 1.4 }}>
      Turns your AI into a domain expert
    </div>
  </div>
);

// ─── FieldRule (underline input) ─────────────────────────────────
export const FieldRule: React.FC<{
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  error?: string;
  maxLength?: number;
  autoFocus?: boolean;
}> = ({ label, hint, value, onChange, type = 'text', mono, placeholder, required, disabled, autoComplete, error, maxLength, autoFocus }) => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label className="block cursor-text" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
        <Eyebrow>{label}</Eyebrow>
        {hint && <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{hint}</span>}
      </div>
      {error && (
        <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 4 }}>
          <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.12em' }}>Errata · </span>
          {error}
        </div>
      )}
      <div
        className="flex items-baseline gap-2.5 transition-colors"
        style={{
          borderBottom: focused ? '1px solid var(--brand)' : error ? '1px solid #b91c1c' : '1px solid var(--ink-4)',
          padding: '6px 2px',
        }}
      >
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          maxLength={maxLength}
          autoFocus={autoFocus}
          className="bg-transparent outline-none flex-1 placeholder:italic"
          style={{
            color: 'var(--ink)',
            fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit',
            fontSize: mono ? 13 : 15,
            letterSpacing: mono ? '0.08em' : 0,
            textTransform: mono ? 'uppercase' : 'none' as any,
            border: 'none',
            padding: 0,
          }}
        />
      </div>
    </label>
  );
};

// ─── Marginalia note ─────────────────────────────────────────────
export const Margin: React.FC<{
  n: string;
  label: string;
  body: React.ReactNode;
  href?: string;
}> = ({ n, label, body, href }) => (
  <div style={{ paddingBottom: 12, marginBottom: 14, borderBottom: '1px dashed var(--line)' }}>
    <div className="font-mono font-bold" style={{ color: 'var(--brand)', fontSize: 11, marginBottom: 4 }}>{n}</div>
    <div className="font-serif italic" style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>
      {href ? <a href={href} download rel="nofollow" className="underline decoration-dotted underline-offset-4 hover:text-brand">{label}</a> : label}
    </div>
    <div className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{body}</div>
  </div>
);

// ─── Gate Frame ──────────────────────────────────────────────────
export const GateFrame: React.FC<{
  children: React.ReactNode;
  margin?: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ children, margin, footer }) => (
  <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6" style={{ background: 'var(--cream, #fcfcfc)' }}>
    <div
      className="w-full my-auto animate-fade-in-up"
      style={{
        maxWidth: 980,
        minHeight: 500,
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 6,
        boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 30px 60px -40px rgba(40,30,20,0.25)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="gate-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: margin ? '1fr 220px' : '1fr',
          gap: margin ? 44 : 0,
          padding: '52px 56px 40px',
        }}
      >
        <div>
          <Masthead />
          {children}
        </div>
        {margin && (
          <aside
            className="hidden lg:block"
            style={{ paddingTop: 56, borderLeft: '1px dashed var(--line)', paddingLeft: 28 }}
          >
            <Eyebrow style={{ marginBottom: 14 }}>Marginalia</Eyebrow>
            {margin}
          </aside>
        )}
      </div>
      {footer && (
        <div
          className="flex items-center justify-between"
          style={{
            padding: '12px 56px 16px',
            borderTop: '1px dashed var(--line)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
    {/* Responsive: collapse marginalia below lg */}
    <style>{`
      @media (max-width: 860px) {
        .gate-grid { grid-template-columns: 1fr !important; padding: 32px 24px 28px !important; }
      }
      @media (max-width: 600px) {
        .gate-grid { padding: 24px 16px 20px !important; }
        .gate-name-grid { grid-template-columns: 1fr !important; }
      }
      @keyframes cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
    `}</style>
  </div>
);

// ─── Buttons ─────────────────────────────────────────────────────
export const Btn: React.FC<{
  children: React.ReactNode;
  brand?: boolean;
  ghost?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  style?: React.CSSProperties;
}> = ({ children, brand, ghost, onClick, type = 'button', disabled, style }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-1.5 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    style={{
      padding: '10px 18px',
      borderRadius: 10,
      fontSize: 12,
      letterSpacing: '0.04em',
      border: ghost ? '1px solid var(--ink-4)' : brand ? '1px solid var(--brand)' : '1px solid var(--line)',
      background: ghost ? 'transparent' : brand ? 'var(--brand)' : 'var(--paper)',
      color: ghost ? 'var(--ink-2)' : brand ? '#fff' : 'var(--ink)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style,
    }}
  >{children}</button>
);

// ─── Step Bar ────────────────────────────────────────────────────
export const StepBar: React.FC<{ currentStep: number }> = ({ currentStep }) => (
  <div className="flex items-center gap-3.5" style={{ marginBottom: 18 }}>
    <Eyebrow brand={currentStep === 1} style={currentStep !== 1 ? { color: 'var(--ink-3)' } : undefined}>
      Step 1 · Basic details
    </Eyebrow>
    <div style={{ flex: 1, height: 1, background: 'var(--brand)' }} />
    <Eyebrow brand={currentStep === 2} style={currentStep !== 2 ? { color: 'var(--ink-4)' } : undefined}>
      Step 2 · Setup
    </Eyebrow>
    <div style={{
      flex: 1, height: currentStep === 2 ? 1 : 0,
      background: currentStep === 2 ? 'var(--brand)' : 'transparent',
      borderTop: currentStep === 2 ? 'none' : '1px dashed var(--ink-4)',
    }} />
  </div>
);

// ─── Wax Seal ────────────────────────────────────────────────────
export const WaxSeal: React.FC = () => {
  const now = new Date();
  const timeStr = `${now.toLocaleString('en-US', { month: 'short' })} ${now.getDate()}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;
  return (
    <div className="hidden md:flex flex-col items-center gap-3.5" style={{ marginTop: 8 }} aria-hidden="true">
      <div
        className="flex items-center justify-center font-serif italic"
        style={{
          width: 130, height: 130, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #8b56c4, var(--brand) 55%, var(--brand-dark))',
          boxShadow: 'inset -6px -8px 14px rgba(0,0,0,0.35), inset 4px 6px 10px rgba(255,255,255,0.18), 0 8px 20px -6px rgba(74,36,112,0.4)',
          color: 'rgba(255,255,255,0.85)',
          fontSize: 38, fontWeight: 400,
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          position: 'relative',
        }}
      >
        F
        <span style={{ position: 'absolute', inset: 8, border: '1px dashed rgba(255,255,255,0.35)', borderRadius: '50%' }} />
      </div>
      <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.16em' }}>
        sent · {timeStr}
      </span>
    </div>
  );
};

// ─── Gate Footer ─────────────────────────────────────────────────
export const GateFooter: React.FC<{ onAdminOpen?: () => void }> = ({ onAdminOpen }) => (
  <>
    <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>
      Powered by{' '}
      <a href="https://www.psfk.com" target="_blank" rel="noopener noreferrer nofollow"
        className="underline decoration-dotted underline-offset-4 hover:text-ink"
        style={{ color: 'var(--ink-2)' }}
      >PSFK</a>
    </span>
    {onAdminOpen && (
      <button
        onClick={onAdminOpen}
        className="font-mono underline decoration-dotted underline-offset-4 hover:text-ink transition-colors cursor-pointer"
        style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', background: 'none', border: 'none', padding: 0 }}
      >
        Graph Admin
      </button>
    )}
  </>
);
