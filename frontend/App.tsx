
import { Vertical, Message, RetrievalResult, User, Account, AuthResponse } from '../shared/types';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { AdminPortal } from './components/AdminPortal';
import { ApiModal } from './components/ApiModal';
import { SecurityModal } from './components/SecurityModal';
import { DeterministicModal } from './components/DeterministicModal';
import { Dashboard } from './components/Dashboard';
import { AuthGate } from './components/AuthGate';
import { ContextChips } from './components/ContextChips';
import { DevToolsDrawer } from './components/DevToolsDrawer';
import { UpgradeModal } from './components/UpgradeModal';
import { dataService, ApiError } from '../shared/dataService';
import { generateResponse } from './services/geminiService';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDiscovery } from './hooks/useDiscovery';
import { BASELINE_QUESTIONS } from '../shared/constants';

// Simple UUID generator for browser
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [accessMode, setAccessMode] = useState<'psfk' | 'waldo'>('psfk');
  const [currentVertical, setCurrentVertical] = useState<Vertical>(Vertical.Retail);

  // Context & Identity State
  const [userContext, setUserContext] = useState('');
  const [accountContext, setAccountContext] = useState('');
  const [userId, setUserId] = useState('');
  const [demoApiKey, setDemoApiKey] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isDeterministicModalOpen, setIsDeterministicModalOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const [isDevMode, setIsDevMode] = useState(false);
  const [isMcpMode, setIsMcpMode] = useState(false); // New State for MCP Simulation
  const [apiTransaction, setApiTransaction] = useState<{ request: any, headers?: any, response: any, durationMs: number, timestamp: number } | null>(null);

  const [inputValue, setInputValue] = useState('');
  const [highlightedItem, setHighlightedItem] = useState<{ type: 'trend' | 'article', id: string } | null>(null);



  // Initialize Dynamic Discovery for filters
  // Initialize Dynamic Discovery for filters
  useDiscovery(
    accessMode === 'psfk' ? 'psfk' : (accessMode === 'waldo' ? 'waldo' : 'sic'),
    ['RetailerType', 'Technology', 'Audience']
  );

  useEffect(() => {
    const restoreSession = async () => {
      console.log("[App] Component Mounted. Restoring Session...");

      // 1. Try Token-based Restoration (Persistent)
      const token = localStorage.getItem('fodda_session_token');
      if (token) {
        console.log("[App] Found session token, validating...");
        try {
          const res = await dataService.validateSession(token);
          if (res.ok && res.user && res.account) {
            console.log("[App] Session valid. Restoring...");
            // We manually trigger session start but avoid duplicate logging if possible?
            // Actually handleSessionStart logs to Airtable. Maybe we want that for a "fresh" open.
            handleSessionStart({ ...res, sessionToken: token } as Required<AuthResponse>);

            // Restore Contexts
            const uCtx = localStorage.getItem('fodda.userContext');
            const aCtx = localStorage.getItem('fodda.accountContext');
            if (uCtx) setUserContext(uCtx);
            if (aCtx) setAccountContext(aCtx);

            // Restore Demo API Key
            const storedApiKey = localStorage.getItem('fodda.apiKey');
            if (storedApiKey) setDemoApiKey(storedApiKey);

            return;
          } else {
            console.warn("[App] Session expired/invalid. Clearing token.");
            localStorage.removeItem('fodda_session_token');
          }
        } catch (e) {
          console.error("Session validation error", e);
        }
      }

      // Restore Session from LocalStorage (with expiry check)
      const storedUser = localStorage.getItem('fodda_user');
      const storedAccount = localStorage.getItem('fodda_account');
      const storedExpiry = localStorage.getItem('fodda_session_expiry');
      const unlocked = localStorage.getItem('fodda_unlocked') === 'true';

      // Check Expiry
      const now = Date.now();
      if (storedExpiry && parseInt(storedExpiry) < now) {
        console.log("[App] Session Expired. Clearing storage.");
        localStorage.removeItem('fodda_user');
        localStorage.removeItem('fodda_account');
        localStorage.removeItem('fodda_unlocked');
        localStorage.removeItem('fodda_session_expiry');
        // Force Login
        return;
      }

      if (unlocked && storedUser && storedAccount) {
        console.log("[App] Restoring unlocked session for user:", JSON.parse(storedUser).email);
        const user = JSON.parse(storedUser);
        const account = JSON.parse(storedAccount);
        setCurrentUser(user);
        setCurrentAccount(account);
        setAccessMode('psfk');
        setIsUnlocked(true);
      }
    };
    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist Identity & Contexts
  useEffect(() => {
    localStorage.setItem('fodda.userContext', userContext);
  }, [userContext]);

  useEffect(() => {
    localStorage.setItem('fodda.accountContext', accountContext);
  }, [accountContext]);

  useEffect(() => {
    if (userId) localStorage.setItem('fodda.userId', userId);
  }, [userId]);

  useEffect(() => {
    localStorage.setItem('fodda.apiKey', demoApiKey);
  }, [demoApiKey]);

  // UI State Reset on Vertical/Mode Switch (Fix for evidence contamination & chat refresh)
  useEffect(() => {
    setMessages([]);
    setInputValue('');
    setHighlightedItem(null);
    setIsEvidenceOpen(false); // Close drawer to prevent showing stale data
    setApiTransaction(null);
  }, [currentVertical, accessMode, isMcpMode]);

  // Enforce Auth Policy Dynamically
  useEffect(() => {
    if (currentAccount?.authPolicy === 'STRICT') {
      const existing = localStorage.getItem('fodda_session_token');
      if (existing) {
        console.log("[App] Auth Policy changed to STRICT. Removing persistent session token.");
        localStorage.removeItem('fodda_session_token');
      }
    }
  }, [currentAccount?.authPolicy]);

  const handleSessionStart = (auth: Required<AuthResponse>) => {
    console.log("[App] Session Start. Setting State components...");
    setCurrentUser(auth.user);
    setCurrentAccount(auth.account);
    setIsUnlocked(true);

    // Sync userId with userName if available
    if (auth.user.userName) {
      setUserId(auth.user.userName);
      localStorage.setItem('fodda.userId', auth.user.userName);
    }

    console.log("[App] Saving to localStorage with 24h expiry...");
    localStorage.setItem('fodda_unlocked', 'true');
    localStorage.setItem('fodda_user', JSON.stringify(auth.user));
    localStorage.setItem('fodda_account', JSON.stringify(auth.account));
    // Set Expiry: 24 hours from now
    const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
    localStorage.setItem('fodda_session_expiry', expiryTime.toString());

    // Save Persistent Session Token based on Policy
    if (auth.sessionToken) {
      const policy = auth.account.authPolicy || 'RELAXED';
      if (policy === 'STRICT') {
        console.log("[App] Auth Policy is STRICT. Session token invalid after tab close.");
        localStorage.removeItem('fodda_session_token');
      } else {
        localStorage.setItem('fodda_session_token', auth.sessionToken);
      }
    }

    // Always adopt contexts from DB on login to ensure sync
    if (auth.user.userContext) {
      console.log("[App] Syncing userContext from DB");
      setUserContext(auth.user.userContext);
    }
    if (auth.account.accountContext) {
      console.log("[App] Syncing accountContext from DB");
      setAccountContext(auth.account.accountContext);
    }

    console.log("[App] Login State Update Complete. UI should now unlock.");

    console.log("[App] Logging session to Airtable...");
    // Log Login
    dataService.logToAirtable(
      auth.user.userName || auth.user.email,
      auth.user.email,
      "[SESSION_START]",
      currentVertical,
      auth.account.apiKey || 'unknown',
      {
        userContext: auth.user.userContext || '',
        accountContext: auth.account.accountContext || ''
      }
    ).then(() => console.log("[App] Airtable log sent."));
  };

  const handleVerify = async (token: string): Promise<boolean> => {
    console.log("[App] handleVerify called with token");
    try {
      const response = await dataService.verifyLogin(token);
      if (response.ok && response.user && response.account) {
        handleSessionStart(response as Required<AuthResponse>);
        // Clean URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
      }
      return false;
    } catch (e) {
      console.error("[App] Verification Failed", e);
      return false;
    }
  };

  const handleLogin = async (email: string) => {
    console.log("[App] handleLogin called for:", email);
    // Async Login (Requests Magic Link)
    try {
      const response = await dataService.login(email);
      // We wait for user to click email link.
      if (!response.ok) {
        throw new Error(response.error || "Login request failed");
      }
      return response;
    } catch (e: any) {
      console.error("[App] Login Failed:", e);
      throw e;
    }
  }

  const handleRegister = async (email: string, firstName: string, lastName: string, company: string, jobTitle: string, companyContextRaw?: string, userContextRaw?: string, apiUse?: string) => {
    console.log("[App] handleRegister called for:", email, { firstName, lastName, company });
    try {
      const response = await dataService.register(email, firstName, lastName, company, jobTitle, companyContextRaw, userContextRaw, apiUse);
      console.log("[App] dataService.register response:", { ok: response.ok, hasUser: !!(response as AuthResponse).user });

      if (response.ok) {
        // Stop auto-login. Require manual login after email check.
        setIsUnlocked(false);
        setCurrentUser(null);
        setCurrentAccount(null);
        // Clean up any temporary session data
        if (typeof window !== 'undefined') {
          sessionStorage.clear();
        }
        return true; // Signal success to AuthGate
      } else {
        console.warn("[App] Registration failed or returned incomplete data:", response);
        alert(response.error || "Registration failed.");
        return false;
      }
    } catch (err) {
      console.error("[App] handleRegister Exception:", err);
      alert("System Error during registration. Check console.");
      return false;
    }
  };

  const handleJoin = async (email: string, firstName: string, lastName: string, signupCode: string, jobTitle: string, userContextRaw?: string) => {
    console.log("[App] handleJoin called for:", email);
    try {
      const response = await dataService.joinTeam(email, firstName, lastName, signupCode, jobTitle, userContextRaw);

      if (response.ok) {
        // Stop auto-login. Require manual login after email check.
        setIsUnlocked(false);
        setCurrentUser(null);
        setCurrentAccount(null);
        if (typeof window !== 'undefined') {
          sessionStorage.clear();
        }
        return true; // Signal success to AuthGate
      } else {
        console.warn("[App] Join failed:", response);
        alert(response.error || "Join failed.");
        return false;
      }
    } catch (err) {
      console.error("[App] handleJoin Exception:", err);
      return false;
    }
  };

  const inferBaselineQuestion = useCallback(async (query: string): Promise<string> => {
    try {
      // Use server proxy to avoid exposing API key
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Key': demoApiKey || '' // Pass user-selected key if present
        },
        body: JSON.stringify({
          model: 'gemini-2.0-flash',
          contents: `Mapping Request: "${query}"\n\nSurvey Schema:\n${BASELINE_QUESTIONS.map(q => `${q.id}: ${q.label}`).join('\n')}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                questionId: { type: "STRING" }
              },
              required: ["questionId"]
            },
            systemInstruction: `You are a machine-to-machine mapping agent. Identify the best survey questionId.
            Common intents:
            - "tiktok", "instagram" -> SMUSE_TT, SMUSE_IG
            - "internet", "broadband" -> BBHOME
            - "safety", "crime" -> CRIMESAFE
            - "financial" -> FIN_SIT
            If no mapping exists, return 'BBHOME'.`
          }
        })
      });

      if (!response.ok) return 'BBHOME';

      const data = await response.json();
      // data is the full Gemini response object
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return 'BBHOME';

      const json = JSON.parse(text);
      return json.questionId || 'BBHOME';
    } catch (e) {
      console.error("Baseline inference failed", e);
      return 'BBHOME';
    }
  }, [demoApiKey]);

  const handleSendMessage = useCallback(async (text: string, manualTerms?: string[]) => {
    if (!text.trim()) return;

    const userMsgId = Date.now().toString();
    const userMsg: Message = { id: userMsgId, role: 'user', content: text, timestamp: Date.now() };

    setMessages((prev: Message[]) => [...prev, userMsg]);
    setIsProcessing(true);
    setInputValue('');
    setHighlightedItem(null);

    // Prepare Tracking Info
    const trackingInfo = {
      userId,
      apiKey: currentAccount?.apiKey || '',
      userContext,
      accountContext
    };

    // Async log to Airtable without blocking UI
    console.log("[App] Logging message to Airtable...");
    dataService.logToAirtable(
      userId,
      currentUser?.email || 'unknown',
      text,
      currentVertical,
      currentAccount?.apiKey || 'unknown',
      { userContext, accountContext }
    );

    try {
      let result: RetrievalResult;

      if (currentVertical === Vertical.Baseline) {
        const qId = await inferBaselineQuestion(text);
        result = await dataService.retrieve(text, Vertical.Baseline, 200, {
          questionId: qId,
          segmentType: 'AGEGRP',
          excludeBlank: true
        }, trackingInfo);
      } else {
        result = await dataService.retrieve(text, currentVertical, 40, { manualTerms }, trackingInfo, isMcpMode ? 'mcp' : 'direct');
      }

      // DEV MODE: Capture transaction
      if (result.debug) {
        setApiTransaction({
          request: result.debug.request,
          headers: result.debug.headers, // STABILIZATION: Pass headers to DevTools
          response: result.debug.response,
          durationMs: result.debug.durationMs,
          timestamp: Date.now()
        });
      }

      // Generate AI Response Synthesis
      const generationResult = await generateResponse(
        text,
        currentVertical,
        result,
        userContext,
        accountContext
      );

      // Process result
      const assistantMsg: Message = {
        id: generateUUID(),
        role: 'assistant',
        content: generationResult.answer,
        timestamp: Date.now(),
        evidence: result.articles || [],
        relatedTrends: result.trends || [],
        suggestedQuestions: generationResult.suggestedQuestions,
        diagnostic: {
          dataStatus: result.dataStatus,
          termsUsed: result.termsUsed
        }
      };

      setMessages((prev: Message[]) => [...prev, assistantMsg]);
      setIsEvidenceOpen(true);
    } catch (err: any) {
      console.error("[App] Search Failed:", err);

      // Handle Plan Limits
      if (err.code === 'PLAN_LIMIT_EXCEEDED' || err.message?.includes('PLAN_LIMIT_EXCEEDED')) {
        setIsUpgradeModalOpen(true);
        setIsProcessing(false);
        return;
      }

      const errorMsg: Message = {
        id: generateUUID(),
        role: 'assistant',
        content: `Error: ${err.message || "Failed to connect to research agent."}`,
        timestamp: Date.now()
      };
      setMessages((prev: Message[]) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  }, [currentVertical, currentUser, currentAccount, userContext, accountContext, userId, inferBaselineQuestion]);



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
    return <AuthGate onUnlock={handleLogin} onRegister={handleRegister} onJoin={handleJoin} onVerify={handleVerify} />;
  }

  const handleUpdateUserContext = (ctx: string, saveToDb: boolean) => {
    setUserContext(ctx);
    if (saveToDb && currentUser?.email) {
      dataService.updateUserContext(currentUser.email, ctx);
    }
  };

  const handleUpdateAccountContext = (ctx: string, saveToDb: boolean) => {
    setAccountContext(ctx);
    if (saveToDb && currentAccount?.id) {
      dataService.updateAccountContext(currentAccount.id, ctx);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-black text-white overflow-hidden font-sans relative">
      {isAdminOpen && (
        <AdminPortal
          onBack={() => setIsAdminOpen(false)}
          userId={userId}
        />
      )}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentPlanName={currentAccount?.planLevel || 'Free'}
        userEmail={currentUser?.email}
      />
      <ApiModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />
      <SecurityModal isOpen={isSecurityModalOpen} onClose={() => setIsSecurityModalOpen(false)} />
      <DeterministicModal isOpen={isDeterministicModalOpen} onClose={() => setIsDeterministicModalOpen(false)} />
      <DevToolsDrawer
        isOpen={isDevMode}
        onClose={() => setIsDevMode(false)}
        transaction={apiTransaction}
        isMcpMode={isMcpMode}
        onToggleMcpMode={() => setIsMcpMode(!isMcpMode)}
      />
      {currentUser && currentAccount && (
        <Dashboard
          isOpen={isDashboardOpen}
          onClose={() => setIsDashboardOpen(false)}
          user={currentUser}
          account={currentAccount}
          accessMode={accessMode}
          onViewModeChange={setAccessMode}
          userId={userId}
          onUserIdChange={setUserId}
          demoApiKey={demoApiKey}
          onDemoApiKeyChange={setDemoApiKey}
          onUpdate={(updatedUser, updatedAccount) => {
            if (updatedUser) {
              setCurrentUser(updatedUser);
              if (updatedUser.userContext) setUserContext(updatedUser.userContext);
            }
            if (updatedAccount) {
              setCurrentAccount(updatedAccount);
              if (updatedAccount.accountContext) setAccountContext(updatedAccount.accountContext);
            }
          }}
        />
      )}

      <Sidebar
        currentVertical={currentVertical}
        onVerticalChange={handleVerticalChange}
        onQuestionClick={handleSendMessage}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onAdminClick={() => setIsAdminOpen(true)}
        onApiClick={() => setIsApiModalOpen(true)}
        onSecurityClick={() => window.open('/Fodda_Enterprise_Security_Architecture_README_FEB132026.md', '_blank')}
        onDeterministicClick={() => setIsDeterministicModalOpen(true)}
        onDashboardClick={() => setIsDashboardOpen(true)}
        onDevModeClick={() => setIsDevMode(!isDevMode)}
        accessMode={accessMode}
        isMcpMode={isMcpMode}
        onToggleMcpMode={() => setIsMcpMode(!isMcpMode)}
      />
      <main className="flex-1 flex flex-row h-full relative overflow-hidden ml-0 md:ml-64">
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
          contextChips={
            <ContextChips
              userContext={userContext}
              accountContext={accountContext}
              onUpdateUserContext={handleUpdateUserContext}
              onUpdateAccountContext={handleUpdateAccountContext}
            />
          }
        />
        <EvidenceDrawer
          articles={currentEvidence}
          trends={currentTrends}
          baselineRows={currentBaselineRows}
          vertical={currentVertical}
          isOpen={isEvidenceOpen}
          onClose={() => setIsEvidenceOpen(false)}
          isLoading={isProcessing}
          onTrendLearnMore={(n: string) => handleSendMessage(`Deep dive into ${n} `)}
          highlightedItem={highlightedItem}
          hasMessages={messages.length > 0}
        />
      </main>
    </div>
  );
};

export default App;
