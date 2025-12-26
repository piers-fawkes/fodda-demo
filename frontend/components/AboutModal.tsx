
import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up border border-stone-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 shrink-0">
          <h3 className="font-serif text-xl font-bold text-stone-900">About the Fodda Intelligence Demo</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-8 space-y-5 overflow-y-auto text-stone-600 leading-relaxed text-sm">
          <p>
            This demo is designed to show how Fodda grounds large language models in curated, human-built context.
          </p>
          <p>
            Rather than answering from general web-scale training data, the system first retrieves relevant trends and source articles from a defined dataset. Responses are generated only from that material and include direct links back to the supporting evidence.
          </p>
          <p>
            The current demo focuses on three verticals (Retail, Sports, and Beauty) and uses a limited dataset to keep the experience fast and transparent.
          </p>
          <p>
            While the interface simulates querying a knowledge graph, this version uses dataset-based retrieval rather than a full graph database. In production, Fodda will connect to expert-built context graphs that capture richer relationships across topics and domains.
          </p>

          <p className="pt-4 border-t border-stone-100 text-stone-900 font-medium">
            Built by Piers Fawkes and the team at PSFK — inquire via <a href="mailto:hello@psfk.com" className="text-fodda-accent hover:underline">hello@psfk.com</a>.
          </p>
          
          <div className="pt-2">
            <p className="text-[11px] text-stone-400 italic leading-tight">
              This demo is meant to illustrate the approach, not the full scope of the Fodda platform.
            </p>
          </div>
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-100 text-center shrink-0">
           <button onClick={onClose} className="text-xs font-bold text-fodda-accent uppercase tracking-widest">Close</button>
        </div>
      </div>
    </div>
  );
};
