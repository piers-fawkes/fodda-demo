import React, { useState } from 'react';
import { Vertical, Message } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { dataService } from './services/dataService';
import { generateResponse } from './services/geminiService';

const App: React.FC = () => {
  const [currentVertical, setCurrentVertical] = useState<Vertical>(Vertical.Retail);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State for mobile visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  
  // State for anchoring/highlighting evidence
  const [highlightedItem, setHighlightedItem] = useState<{ type: 'trend' | 'article', id: string } | null>(null);
  
  // State for the Evidence Drawer
  // Logic: Show evidence for the latest assistant message. 
  // If processing a new query, we treat the evidence as 'loading' or empty to indicate refresh.
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  
  // If processing, we don't show the OLD evidence, we show loading state in the drawer.
  const currentEvidence = isProcessing ? [] : (lastAssistantMessage?.evidence || []);
  const currentTrends = isProcessing ? [] : (lastAssistantMessage?.relatedTrends || []);

  const handleVerticalChange = (vertical: Vertical) => {
    setCurrentVertical(vertical);
    setMessages([]); // Clear chat on mode switch for clean demo
    setHighlightedItem(null);
    setIsSidebarOpen(false); // Close sidebar on selection
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    setHighlightedItem(null); // Reset highlight on new query
    // On mobile, if sending message, we typically stay in chat, but Evidence might be relevant soon.
    
    try {
      // 1. Retrieve Context
      const retrievedData = dataService.retrieve(text, currentVertical);
      
      // 2. Generate Answer via Gemini
      const responseText = await generateResponse(text, currentVertical, retrievedData);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        evidence: retrievedData.articles,
        relatedTrends: retrievedData.trends
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      // Fallback error message
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble accessing the dataset right now.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Triggered when user clicks "Learn More" in the Evidence Drawer
  const handleTrendLearnMore = (trendName: string) => {
    handleSendMessage(`Tell me more about the trend "${trendName}" and share examples.`);
    // On mobile, close evidence to show chat response
    setIsEvidenceOpen(false);
  };

  // Triggered when user clicks a link in the Chat Interface
  const handleAnchorClick = (type: 'trend' | 'article', id: string) => {
    setHighlightedItem({ type, id });
    setIsEvidenceOpen(true); // Open drawer on click (crucial for mobile)
    
    // Auto-clear highlight after 3 seconds for visual cleanliness, 
    // though the scroll position remains.
    setTimeout(() => setHighlightedItem(null), 3000);
  };

  return (
    <div className="flex h-screen w-screen bg-stone-100 overflow-hidden font-sans relative">
      <Sidebar 
        currentVertical={currentVertical} 
        onVerticalChange={handleVerticalChange}
        onQuestionClick={(q) => {
          handleSendMessage(q);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      <main className="flex-1 flex h-full relative shadow-2xl z-0 overflow-hidden">
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
          isOpen={isEvidenceOpen}
          onClose={() => setIsEvidenceOpen(false)}
          isLoading={isProcessing}
          onTrendLearnMore={handleTrendLearnMore}
          highlightedItem={highlightedItem}
        />
      </main>
    </div>
  );
};

export default App;