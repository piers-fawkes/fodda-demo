
import React, { useState, useEffect } from 'react';
import { Message, KnowledgeGraph, Vertical } from '../shared/types';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { AdminPortal } from './components/AdminPortal';
import { AboutModal } from './components/AboutModal';
import { dataService } from '../shared/dataService';
import { generateResponse } from './services/geminiService';

const MaintenanceGate: React.FC<{ onAuthorize: () => void }> = ({ onAuthorize }) => {
  const [pass, setPass] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pass.toLowerCase() === 'psfk') {
      onAuthorize();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-stone-50 flex items-center justify-center p-6">
      <div className={`max-w-md w-full bg-white p-10 rounded-3xl shadow-2xl border border-stone-200 text-center transition-transform duration-300 ${error ? 'animate-shake' : 'animate-fade-in-up'}`}>
        <div className="inline-block px-3 py-1 rounded-full bg-fodda-accent/10 border border-fodda-accent/20 text-fodda-accent text-[10px] font-bold uppercase tracking-widest mb-6">
          🚧 Under Reconstruction
        </div>
        <h1 className="font-serif text-3xl font-bold text-stone-900 mb-3 tracking-tight">Fodda Graph</h1>
        <p className="text-stone-500 text-sm mb-8 leading-relaxed">
          The intelligence engine and dataset indexes are currently being updated. Access is restricted to authorized partners.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="password" 
            value={pass} 
            onChange={(e) => setPass(e.target.value)} 
            placeholder="Enter access key" 
            className={`w-full px-5 py-4 bg-stone-50 border rounded-xl focus:outline-none text-center transition-colors ${error ? 'border-red-300' : 'border-stone-200 focus:border-fodda-accent'}`}
            autoFocus 
          />
          <button 
            type="submit" 
            className="w-full py-4 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors shadow-lg shadow-stone-200"
          >
            Enter Demo
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-stone-100">
          <p className="text-[10px] text-stone-400 font-medium uppercase tracking-tighter">
            Contact hello@psfk.com for access
          </p>
        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return sessionStorage.getItem('fodda_authorized') === 'true';
  });
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([]);
  const [currentVertical, setCurrentVertical] = useState<Vertical>(Vertical.Retail);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [highlightedItem, setHighlightedItem] = useState<{ type: 'trend' | 'article', id: string } | null>(null);
  const [view, setView] = useState<'chat' | 'admin'>('chat');
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  useEffect(() => {
    if (!isAuthorized) return;
    setGraphs(dataService.getGraphs());
    
    dataService.checkHealth().then(status => {
      console.log(`[API Connection] ${status.ok ? '✅ Operational' : '❌ Failed to reach context backend'}`);
    });
  }, [view, isAuthorized]);

  const handleAuthorize = () => {
    setIsAuthorized(true);
    sessionStorage.setItem('fodda_authorized', 'true');
  };

  // Derive evidence based on which message's evidence the user is looking at
  const activeMessage = messages.find(m => m.id === activeEvidenceId);
  const currentEvidence = isProcessing ? [] : (activeMessage?.evidence || []);
  const currentTrends = isProcessing ? [] : (activeMessage?.relatedTrends || []);

  const handleVerticalChange = (verticalId: string) => {
    setCurrentVertical(verticalId as Vertical);
    setMessages([]);
    setHighlightedItem(null);
    setActiveEvidenceId(null);
    setIsSidebarOpen(false);
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = { id: Math.random().toString(36).substring(7), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    setHighlightedItem(null); 
    
    try {
      const retrievedData = await dataService.retrieve(text, currentVertical);
      const responseText = await generateResponse(text, currentVertical, retrievedData);
      
      const assistantId = Math.random().toString(36).substring(7);
      const assistantMsg: Message = { 
        id: assistantId, 
        role: 'assistant', 
        content: responseText, 
        timestamp: Date.now(), 
        evidence: retrievedData.articles, 
        relatedTrends: retrievedData.trends 
      };

      setMessages(prev => [...prev, assistantMsg]);
      setActiveEvidenceId(assistantId);
      
      if (retrievedData.trends.length > 0 || retrievedData.articles.length > 0) {
        setIsEvidenceOpen(true);
      }
      
    } catch (err) {
      console.error("Intelligence Error:", err);
      setMessages(prev => [...prev, { 
        id: 'err-' + Date.now(), 
        role: 'assistant', 
        content: "The reconstruction process is currently affecting graph retrieval. Please try again or check back later.", 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnchorClick = (messageId: string, type: 'trend' | 'article', id: string) => {
    setActiveEvidenceId(messageId);
    setHighlightedItem({ type, id });
    setIsEvidenceOpen(true); 
    setTimeout(() => setHighlightedItem(null), 3000);
  };

  if (!isAuthorized) {
    return <MaintenanceGate onAuthorize={handleAuthorize} />;
  }

  if (view === 'admin') return <AdminPortal onBack={() => setView('chat')} />;

  return (
    <div className="flex h-screen w-screen bg-stone-100 overflow-hidden font-sans relative">
      <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />
      <Sidebar 
        currentVertical={currentVertical} 
        onVerticalChange={handleVerticalChange} 
        onQuestionClick={handleSendMessage} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        onAdminClick={() => setView('admin')}
      />
      <main className="flex-1 flex h-full relative z-0 overflow-hidden">
        <ChatInterface 
          messages={messages} 
          isProcessing={isProcessing} 
          vertical={currentVertical} 
          onSendMessage={handleSendMessage} 
          onAnchorClick={handleAnchorClick} 
          onToggleSidebar={() => setIsSidebarOpen(true)} 
          onToggleEvidence={() => setIsEvidenceOpen(!isEvidenceOpen)} 
        />
        <EvidenceDrawer 
          articles={currentEvidence} 
          trends={currentTrends} 
          vertical={currentVertical} 
          isOpen={isEvidenceOpen} 
          onClose={() => setIsEvidenceOpen(false)} 
          isLoading={isProcessing} 
          onTrendLearnMore={(name) => handleSendMessage(`Deep dive into trend: ${name}`)} 
          onOpenAbout={() => setIsAboutModalOpen(true)}
          highlightedItem={highlightedItem} 
          hasMessages={messages.length > 0} 
        />
      </main>
    </div>
  );
};

export default App;
