
import React, { useState } from 'react';

interface AuthGateProps {
  onUnlock: (email: string, mode: 'psfk' | 'waldo') => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError(true);
      setTimeout(() => setError(false), 2000);
      return;
    }

    const lowerPass = password.toLowerCase();
    if (lowerPass === 'psfk' || lowerPass === 'waldo') {
      onUnlock(email, lowerPass as 'psfk' | 'waldo');
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-stone-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-12 rounded-[2.5rem] shadow-2xl border border-stone-200 text-center animate-fade-in-up">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight mb-2">Fodda</h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-bold">Contextual Intelligence Demo</p>
        </div>
        
        <p className="text-stone-500 text-sm mb-8 leading-relaxed">
          This is a private preview of the Fodda perspective marketplace — a set of expert-built context graphs designed to plug into AI systems. Please identify yourself to query the graphs.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <input 
            type="email" 
            name="fodda_user_email_identity"
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="Work Email" 
            autoComplete="off"
            spellCheck={false}
            className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-fodda-accent/30 focus:ring-4 focus:ring-fodda-accent/5 text-center transition-all"
            required
          />
          <div className="relative">
            <input 
              type="password" 
              name="fodda_access_key_session"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Access Key" 
              autoComplete="new-password"
              className={`w-full px-6 py-4 bg-stone-50 border rounded-2xl focus:outline-none text-center transition-all ${error ? 'border-red-300 ring-2 ring-red-50' : 'border-stone-200 focus:border-fodda-accent/30 focus:ring-4 focus:ring-fodda-accent/5'}`}
              required
            />
            {error && (
              <p className="absolute -bottom-6 left-0 right-0 text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                Verification Failed
              </p>
            )}
          </div>
          
          <button 
            type="submit" 
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-fodda-accent transition-all shadow-lg hover:shadow-purple-900/10 active:scale-[0.98] mt-2"
          >
            Unlock Graphs
          </button>
        </form>

        <p className="mt-8 text-stone-500 text-[11px] leading-relaxed font-medium px-4">
          Explore how AI behaves when it’s grounded in specific human judgment, not generic data.
        </p>

        <div className="mt-10 pt-8 border-t border-stone-100">
          <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest leading-loose">
            Powered by expert-curated perspective graphs<br/>
            Grounded in curated, opinionated context
          </p>
        </div>
      </div>
    </div>
  );
};
