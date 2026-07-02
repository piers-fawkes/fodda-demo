import React from 'react';
import { ReasoningMode } from '../../shared/types';

interface ReasoningModeSelectorProps {
    currentMode: ReasoningMode;
    onChange: (mode: ReasoningMode) => void;
    disabled?: boolean;
}

const MODES: { key: ReasoningMode; label: string; icon: React.ReactNode; description: string }[] = [
    {
        key: 'graph',
        label: 'PSFK Graph',
        description: 'Graph retrieval + synthesis',
        icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="4" cy="4" r="2" />
                <circle cx="12" cy="4" r="2" />
                <circle cx="8" cy="12" r="2" />
                <line x1="5.5" y1="5.5" x2="7" y2="10.5" />
                <line x1="10.5" y1="5.5" x2="9" y2="10.5" />
                <line x1="6" y1="4" x2="10" y2="4" />
            </svg>
        )
    },
    {
        key: 'gemini',
        label: 'Gemini Only',
        description: 'Web search grounding',
        icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 1v4M8 11v4M1 8h4M11 8h4M3.5 3.5l2.5 2.5M10 10l2.5 2.5M12.5 3.5l-2.5 2.5M6 10l-2.5 2.5" />
            </svg>
        )
    },
    {
        key: 'blended',
        label: 'Blended',
        description: 'Graph + web synthesis',
        icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 3v10M12 3v10" />
                <path d="M4 6c4 0 4 4 8 4" />
                <path d="M4 10c4 0 4-4 8-4" />
            </svg>
        )
    }
];

export const ReasoningModeSelector: React.FC<ReasoningModeSelectorProps> = ({
    currentMode,
    onChange,
    disabled = false
}) => {
    return (
        <div className="flex items-center gap-0.5 bg-cream border border-line rounded-md p-0.5">
            {MODES.map((mode) => {
                const isActive = currentMode === mode.key;
                return (
                    <button
                        key={mode.key}
                        onClick={() => !disabled && onChange(mode.key)}
                        disabled={disabled}
                        title={mode.description}
                        className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider
              transition-all duration-200 whitespace-nowrap
              ${isActive
                                ? 'bg-paper text-ink border border-line shadow-sm'
                                : 'text-ink-4 hover:text-ink-2 hover:bg-line-soft border border-transparent'
                            }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
                    >
                        <span className={`${isActive ? 'text-brand' : 'text-ink-4'} transition-colors`}>
                            {mode.icon}
                        </span>
                        <span className="hidden sm:inline">{mode.label}</span>
                    </button>
                );
            })}
        </div>
    );
};
