
import React, { useState } from 'react';
// Import from shared/types to align with dataService and resolve reported errors
import { Vertical, Message } from './shared/types';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { EvidenceDrawer } from './components/EvidenceDrawer';
// Fix: Import from shared/dataService as recommended by the deprecation warning in services/dataService
import { dataService } from './shared/dataService';
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
    setHighlightedItem(null); 
    
    try {
      // 1. Retrieve Context
      // Fix: Await the asynchronous retrieve call from the shared DataService
      const retrievedData = await dataService.retrieve(text, currentVertical);
      // 🚨 Guardrail: do not ask Gemini to answer if coverage is insufficient
if (retrievedData?.meta?.decision === "REFUSE") {
  const refusalMessage: Message = {
    id: (Date.now() + 1).toString(),
    role: "assistant",
    content: 
      "I don’t currently have evidence in this graph that matches that specific request.\n\n" +
      "This dataset does not include country-specific football coverage for Jordan or population-to-club metrics.\n\n" +
      "You could try:\n" +
      "• Removing the country constraint\n" +
      "• Asking about global football culture or merchandising\n" +
      "• Switching to a different vertical",
    timestamp: Date.now(),
  };

  setMessages(prev => [...prev, refusalMessage]);
  setIsProcessing(false);
  return;
}

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

  const handleTrendLearnMore = (trendName: string) => {
    handleSendMessage(`Tell me more about the trend "${trendName}" and share examples.`);
    setIsEvidenceOpen(false);
  };

  const handleAnchorClick = (type: 'trend' | 'article', id: string) => {
    setHighlightedItem({ type, id });
    setIsEvidenceOpen(true); 
    
    setTimeout(() => setHighlightedItem(null), 3000);
  };

  return (
    <div className="flex h-screen h-[100dvh] w-screen bg-stone-100 overflow-hidden font-sans relative">
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
          vertical={currentVertical}
          isOpen={isEvidenceOpen}
          onClose={() => setIsEvidenceOpen(false)}
          isLoading={isProcessing}
          onTrendLearnMore={handleTrendLearnMore}
          highlightedItem={highlightedItem}
          hasMessages={messages.length > 0}
        />
      </main>
    </div>
  );
};

export default App;
