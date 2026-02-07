
import { Vertical, Message, RetrievalResult } from '../shared/types';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { AdminPortal } from './components/AdminPortal';
import { ApiModal } from './components/ApiModal';
import { AuthGate } from './components/AuthGate';
import { dataService } from '../shared/dataService';
import { generateResponse } from './services/geminiService';
import { GoogleGenAI, Type } from "@google/genai";
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BASELINE_QUESTIONS } from '../shared/constants';

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [accessMode, setAccessMode] = useState<'psfk' | 'waldo'>('psfk');
  const [currentVertical, setCurrentVertical] = useState<Vertical>(Vertical.Retail);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [highlightedItem, setHighlightedItem] = useState<{ type: 'trend' | 'article', id: string } | null>(null);

  useEffect(() => {
    const unlocked = sessionStorage.getItem('fodda_unlocked') === 'true';
    const email = sessionStorage.getItem('fodda_user_email');
    const mode = sessionStorage.getItem('fodda_access_mode') as 'psfk' | 'waldo';
    if (unlocked && email) {
      setIsUnlocked(true);
      setUserEmail(email);
      if (mode) {
        setAccessMode(mode);
        if (mode === 'waldo') {
          setCurrentVertical(Vertical.Waldo);
        }
      }
    }
  }, []);

  // UI State Reset on Vertical Switch (Fix for evidence contamination)
  useEffect(() => {
    setMessages([]);
    setInputValue('');
    setHighlightedItem(null);
    setIsEvidenceOpen(false); // Close drawer to prevent showing stale data
  }, [currentVertical, accessMode]);

  const handleUnlock = (email: string, mode: 'psfk' | 'waldo') => {
    setIsUnlocked(true);
    setUserEmail(email);
    setAccessMode(mode);
    if (mode === 'waldo') {
      setCurrentVertical(Vertical.Waldo);
    }
    sessionStorage.setItem('fodda_unlocked', 'true');
    sessionStorage.setItem('fodda_user_email', email);
    sessionStorage.setItem('fodda_access_mode', mode);
    dataService.logPrompt(email, "[SESSION_START]", mode === 'waldo' ? Vertical.Waldo : currentVertical, "ACCESS_GRANTED");
    dataService.logToAirtable(email, "[SESSION_START]", mode === 'waldo' ? Vertical.Waldo : currentVertical, mode);
  };

  const inferBaselineQuestion = async (query: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const questionList = BASELINE_QUESTIONS.map(q => `${q.id}: ${q.label}`).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Mapping Request: "${query}"\n\nSurvey Schema:\n${questionList}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questionId: { type: Type.STRING }
          },
          required: ["questionId"]
        },
        systemInstruction: `You are a machine-to-machine mapping agent for the Public Beliefs Baseline. Identify the best survey questionId.
        Common intents:
        - "tiktok", "instagram", "youtube" usage -> SMUSE_TT, SMUSE_IG, SMUSE_YT
        - "internet", "broadband", "speed" -> BBHOME, INTMOB
        - "safety", "crime" -> CRIMESAFE
        - "financial", "money", "personal economy" -> FIN_SIT, ECON1BMOD
        If no mapping exists, return 'BBHOME'.`
      }
    });

    try {
      const json = JSON.parse(response.text || '{}');
      return json.questionId || 'BBHOME';
    } catch {
      return 'BBHOME';
    }
  };

  const handleSendMessage = useCallback(async (text: string, manualTerms?: string[]) => {
    if (!text.trim()) return;

    const userMsgId = Date.now().toString();
    const userMsg: Message = { id: userMsgId, role: 'user', content: text, timestamp: Date.now() };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    setInputValue('');
    setHighlightedItem(null);

    // Async log to Airtable without blocking UI
    dataService.logToAirtable(userEmail, text, currentVertical, accessMode);

    try {
      let result: RetrievalResult;

      if (currentVertical === Vertical.Baseline) {
        const qId = await inferBaselineQuestion(text);
        result = await dataService.retrieve(text, Vertical.Baseline, 200, {
          questionId: qId,
          segmentType: 'AGEGRP',
          excludeBlank: true
        });
      } else {
        result = await dataService.retrieve(text, currentVertical, 40, { manualTerms });
      }

      if (result?.meta?.decision === "REFUSE") {
        const requiredTerms = result?.meta?.coverage?.requiredTerms ?? [];
        const scopeLabel = requiredTerms.join(", ") || "this specific request";

        dataService.logPrompt(userEmail, text, currentVertical, "REFUSED_NO_COVERAGE");

        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `This graph doesn’t currently include **${scopeLabel} evidence**, so I can’t produce a grounded answer.`,
          timestamp: Date.now(),
          evidence: [],
          relatedTrends: []
        };

        setMessages(prev => [...prev, assistantMsg]);
        setIsProcessing(false);
        return;
      }

      dataService.logPrompt(userEmail, text, currentVertical, result.dataStatus);
      const responseText = await generateResponse(text, currentVertical, result);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        evidence: result.articles,
        relatedTrends: result.trends,
        baselineRows: currentVertical === Vertical.Baseline ? result.rows : undefined,
        diagnostic: {
          dataStatus: result.dataStatus,
          termsUsed: result.termsUsed
        }
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("Fodda System Failure:", err);
      const errorMessage = err.message || "Traceability engine encountered a connection error.";
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: `${errorMessage} Please ensure the Fodda API is reachable and your environment is correctly configured.`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [currentVertical, userEmail, accessMode]);

  const handleVerticalChange = (newVertical: string) => {
    const v = newVertical as Vertical;
    if (v === currentVertical) return;
    setCurrentVertical(v);
    // State reset is handled by useEffect dependency on currentVertical
  };

  const handleAnchorClick = (messageId: string, type: 'trend' | 'article', id: string) => {
    setHighlightedItem({ type, id });
    setIsEvidenceOpen(true);
    setTimeout(() => setHighlightedItem(null), 4000);
  };

  const lastAssistantMsg = useMemo(() =>
    [...messages].reverse().find(m => m.role === 'assistant'),
    [messages]
  );

  const currentEvidence = useMemo(() =>
    (lastAssistantMsg?.evidence || []),
    [lastAssistantMsg]
  );

  const currentTrends = useMemo(() =>
    (lastAssistantMsg?.relatedTrends || []),
    [lastAssistantMsg]
  );

  const currentBaselineRows = useMemo(() =>
    (lastAssistantMsg?.baselineRows || []),
    [lastAssistantMsg]
  );

  if (!isUnlocked) {
    return <AuthGate onUnlock={handleUnlock} />;
  }

  return (
    <div className="flex h-screen w-screen bg-stone-100 overflow-hidden font-sans relative">
      {isAdminOpen && <AdminPortal onBack={() => setIsAdminOpen(false)} />}
      <ApiModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />

      <Sidebar
        currentVertical={currentVertical}
        onVerticalChange={handleVerticalChange}
        onQuestionClick={handleSendMessage}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onAdminClick={() => setIsAdminOpen(true)}
        onApiClick={() => setIsApiModalOpen(true)}
        accessMode={accessMode}
      />
      <main className="flex-1 flex h-full relative overflow-hidden">
        <ChatInterface
          messages={messages}
          isProcessing={isProcessing}
          vertical={currentVertical}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSendMessage={handleSendMessage}
          onAnchorClick={handleAnchorClick}
          onToggleSidebar={() => setIsSidebarOpen(true)}
          onToggleEvidence={() => setIsEvidenceOpen(!isEvidenceOpen)}
        />
        <EvidenceDrawer
          articles={currentEvidence}
          trends={currentTrends}
          baselineRows={currentBaselineRows}
          vertical={currentVertical}
          isOpen={isEvidenceOpen}
          onClose={() => setIsEvidenceOpen(false)}
          isLoading={isProcessing}
          onTrendLearnMore={(n) => handleSendMessage(`Deep dive into ${n}`)}
          highlightedItem={highlightedItem}
          hasMessages={messages.length > 0}
        />
      </main>
    </div>
  );
};

export default App;
