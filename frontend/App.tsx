
import { Vertical, Message, RetrievalResult, User, Account, AuthResponse, KnowledgeGraph } from '../shared/types';
import { Sidebar, AppView } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { AdminPortal } from './components/AdminPortal';
import { AccountPortal } from './components/AccountPortal';
import { ApiModal } from './components/ApiModal';
import { SecurityModal } from './components/SecurityModal';
import { DeterministicModal } from './components/DeterministicModal';
import { Dashboard } from './components/Dashboard';
import { AuthGate } from './components/AuthGate';
import { SsoCallbackPage } from './components/SsoCallbackPage';
import { ContextChips } from './components/ContextChips';
import { DevToolsDrawer } from './components/DevToolsDrawer';
import { UpgradeModal } from './components/UpgradeModal';
import { ProfilePage } from './components/ProfilePage';
import { ConnectionsPage } from './components/ConnectionsPage';
import { MyGraphsPage } from './components/MyGraphsPage';
import { CoverageMapPage } from './components/CoverageMapPage';
import { KnowledgePage } from './components/KnowledgePage';
import { GovernancePage } from './components/GovernancePage';
import { BillingPage } from './components/BillingPage';
import { ProfileContextWiki } from './components/ProfileContextWiki';
import { AccountContextWiki } from './components/AccountContextWiki';
import { ProfileUsagePage } from './components/ProfileUsagePage';
import { PaymentSetupModal } from './components/PaymentSetupModal';
import { UsageWarningBanner } from './components/UsageWarningBanner';
import { QueryLibraryPage } from './components/QueryLibraryPage';
import { ExpertTwinPage } from './components/ExpertTwinPage';
import { UnclaimedExpertModal } from './components/UnclaimedExpertModal';
import { dataService, ApiError } from '../shared/dataService';
import { generateResponse } from './services/geminiService';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDiscovery } from './hooks/useDiscovery';
import { useAuth, useOrganizationList } from '@clerk/react';
import { WelcomeContextPopup, shouldShowWelcomePopup } from './components/WelcomeContextPopup';
import { BASELINE_QUESTIONS } from '../shared/constants';

// Global fetch interceptor to inject Clerk JWT Bearer Token
const originalFetch = window.fetch;
let globalGetToken: (() => Promise<string | null>) | null = null;

window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);

  if (url.includes('/api/')) {
    const token = globalGetToken ? await globalGetToken() : null;
    if (token) {
      init = init || {};
      const headers = new Headers(init.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      init.headers = headers;
    }
  }
  return originalFetch.call(this, input, init);
};

// Simple UUID generator for browser
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const App: React.FC = () => {
  const { userId: clerkUserId, getToken, signOut, isLoaded: isAuthLoaded } = useAuth();
  const { setActive } = useOrganizationList();

  // Set globalGetToken during render so API calls can include the Clerk JWT
  globalGetToken = getToken;

  // Detect ?graph= referral param from URL (e.g. https://app.fodda.ai?graph=retail)
  const [initialReferralGraph] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('graph');
    }
    return null;
  });

  // Detect /expert/<slug> or ?expert=<slug> deep-link for expert chat auto-selection
  const [initialExpertSlug, setInitialExpertSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      // Check pathname first: /expert/<slug>
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      const expertMatch = path.match(/^\/expert\/(.+)$/);
      if (expertMatch) return expertMatch[1];
      // Fallback: ?expert=<slug> query param
      const paramSlug = new URLSearchParams(window.location.search).get('expert');
      if (paramSlug) return paramSlug.toLowerCase();
    }
    return null;
  });
  // Pre-filled question from ?q= param or localStorage (for auto-submit after auth)
  const [prefilledQuestion, setPrefilledQuestion] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('q') || null;
    }
    return null;
  });

  // Unclaimed expert modal state
  const [unclaimedExpert, setUnclaimedExpert] = useState<{ id: string; name: string; portraitUrl?: string } | null>(null);
  const [showUnclaimedModal, setShowUnclaimedModal] = useState(false);

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
  // In-memory message history per view/graph combination — survives mode switches within session
  const chatHistoryRef = useRef<Record<string, Message[]>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isDeterministicModalOpen, setIsDeterministicModalOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isPaymentSetupOpen, setIsPaymentSetupOpen] = useState(false);
  const [isAccountPortalOpen, setIsAccountPortalOpen] = useState(false);

  // ─── Checkout result detection (Stripe redirect) ───
  const [checkoutResult, setCheckoutResult] = useState<'success' | 'cancelled' | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const result = params.get('checkout');
      if (result === 'success' || result === 'cancelled') {
        // Clean the URL immediately
        params.delete('checkout');
        const cleanUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        return result;
      }
    }
    return null;
  });

  // ─── Navigation: Tab-based view state ───
  // Default to 'profile'. After login, we may override based on apiUse preference.
  // Deep-linking: check pathname for direct navigation (e.g. /account/settings, /account/top-up)
  const [pendingTopUpModal, setPendingTopUpModal] = useState(false);

  const deepLinkMap: Record<string, AppView> = useMemo(() => ({
    '/account/settings': 'account-overview',
    '/account/overview': 'account-overview',
    '/account/team': 'account-team',
    '/account/usage': 'account-usage',
    '/account/context': 'account-context',
    '/account/governance': 'account-governance',
    '/profile': 'profile',
    '/profile/context': 'profile-context',
    '/profile/usage': 'profile-usage',
    '/connections/claude': 'connections-claude',
    '/connections/chatgpt': 'connections-chatgpt',
    '/connections/gemini': 'connections-gemini',
    '/connections/api': 'connections-api',
    '/connections/mcp': 'connections-mcp',
    '/graphs': 'my-graphs',
    '/sandbox': 'sandbox',
    '/research': 'sandbox',
    '/expert': 'expert-chat',
    '/account/billing': 'account-billing',
    '/knowledge/api-docs': 'knowledge-api-docs',
  }), []);

  const [activeView, setActiveView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (deepLinkMap[path]) {
        return deepLinkMap[path];
      }
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('view') === 'billing') {
        return 'account-billing' as AppView;
      }
      if (urlParams.get('expert') || path.startsWith('/expert/')) {
        return 'expert-chat' as AppView;
      }
      if (path === '/account/top-up' || path === '/account/topup') {
        setTimeout(() => setPendingTopUpModal(true), 0);
        return 'account-billing' as AppView;
      }
    }
    return 'profile';
  });

  // Sync activeView changes with browser URL
  const handleNavigate = useCallback((view: AppView) => {
    setActiveView(view);
    if (typeof window !== 'undefined') {
      const viewToPath: Partial<Record<AppView, string>> = {
        'account-overview': '/account/overview',
        'account-team': '/account/team',
        'account-usage': '/account/usage',
        'account-context': '/account/context',
        'account-governance': '/account/governance',
        'account-billing': '/account/billing',
        'profile': '/profile',
        'profile-context': '/profile/context',
        'profile-usage': '/profile/usage',
        'connections-claude': '/connections/claude',
        'connections-chatgpt': '/connections/chatgpt',
        'connections-gemini': '/connections/gemini',
        'connections-api': '/connections/api',
        'connections-mcp': '/connections/mcp',
        'my-graphs': '/graphs',
        'sandbox': '/sandbox',
        'expert-chat': '/expert',
        'knowledge-api-docs': '/knowledge/api-docs',
      };
      const targetPath = viewToPath[view] || '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view }, '', targetPath);
      }
    }
  }, []);

  // Listen for browser Back/Forward popstate events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (deepLinkMap[path]) {
        setActiveView(deepLinkMap[path]);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [deepLinkMap]);
  const [hasSetInitialView, setHasSetInitialView] = useState(false);

  const [isDevMode, setIsDevMode] = useState(false);
  const [isMcpMode, setIsMcpMode] = useState(true); // Default to MCP for full agentic experience
  const [apiTransaction, setApiTransaction] = useState<{ request: any, headers?: any, response: any, durationMs: number, timestamp: number } | null>(null);

  // ─── Dynamic Graph Catalog (Airtable-powered) ───
  const [graphCatalog, setGraphCatalog] = useState<KnowledgeGraph[]>(dataService.getGraphs());
  const [graphsLoading, setGraphsLoading] = useState(false);
  const [ownedGraphs, setOwnedGraphs] = useState<any[]>([]);

  const [inputValue, setInputValue] = useState('');
  const [highlightedItem, setHighlightedItem] = useState<{ type: 'trend' | 'article', id: string } | null>(null);

  const [isGraphSelectorOpen, setIsGraphSelectorOpen] = useState(false);
  const [graphSearchQuery, setGraphSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyField = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Keyboard listener for DevTools console (Ctrl/Cmd + Shift + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDevMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize Dynamic Discovery for filters
  // Initialize Dynamic Discovery for filters
  useDiscovery(
    accessMode === 'psfk' ? 'psfk' : (accessMode === 'waldo' ? 'waldo' : 'sic'),
    ['RetailerType', 'Technology', 'Audience']
  );

  useEffect(() => {
    if (!isAuthLoaded) return; // Wait for Clerk to load

    console.log("[App] Clerk auth loaded. State:", { 
      clerkUserId, 
      isAuthLoaded,
      hasSession: !!clerkUserId,
    });

    const syncClerkSession = async () => {
      if (clerkUserId) {
        // Ensure globalGetToken is set before any API call
        globalGetToken = getToken;
        console.log("[App] Clerk authenticated user:", clerkUserId);

        // Get Clerk session token
        let token = null;
        try {
          token = await getToken();
        } catch (tokenErr) {
          console.warn("[App] Error retrieving Clerk token:", tokenErr);
        }

        if (!token) {
          console.error("[App] Failed to acquire Clerk session token.");
        }

        // Fetch server profile (one retry on failure)
        let profile = await dataService.getCurrentProfile();
        if (!profile?.user || !profile?.account) {
          console.warn("[App] First profile fetch failed. Retrying in 1s...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          profile = await dataService.getCurrentProfile();
        }

        try {
          if (profile && profile.user && profile.account) {
            console.log("[App] Server profile loaded successfully. Starting session...");
            handleSessionStart({ ...profile, isFirstLogin: profile.isFirstLogin || false } as Required<AuthResponse>);
            
            // Set the active Clerk Organization so <OrganizationProfile /> works
            if (profile.account?.clerkOrgId && setActive) {
              setActive({ organization: profile.account.clerkOrgId })
                .catch((e: any) => console.warn('[App] Failed to set active org:', e));
            }
            
            // Restore Contexts
            const uCtx = localStorage.getItem('fodda.userContext');
            const aCtx = localStorage.getItem('fodda.accountContext');
            if (uCtx) setUserContext(uCtx);
            if (aCtx) setAccountContext(aCtx);

            // Restore Demo API Key
            const storedApiKey = localStorage.getItem('fodda.apiKey');
            if (storedApiKey) setDemoApiKey(storedApiKey);
          } else {
            console.warn("[App] Server profile query did not return user/account data.", profile);
          }
        } catch (e) {
          console.error("[App] Failed to load server profile for authenticated Clerk user:", e);
        }
      } else {
        console.log("[App] Clerk user not signed in. Locking screen.");
        setIsUnlocked(false);
        setCurrentUser(null);
        setCurrentAccount(null);
      }
    };

    syncClerkSession();
  }, [isAuthLoaded, clerkUserId]);

  // Persist Identity & Contexts
  useEffect(() => {
    localStorage.setItem('fodda.userContext', userContext);
  }, [userContext]);

  useEffect(() => {
    localStorage.setItem('fodda.accountContext', accountContext);
  }, [accountContext]);

  // ── Refresh account data on tab re-focus (keeps credit balance fresh) ──
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!clerkUserId || !currentAccount) return;

      try {
        const profile = await dataService.getCurrentProfile();
        if (profile?.account) {
          setCurrentAccount(profile.account);
          localStorage.setItem('fodda_account', JSON.stringify(profile.account));
          if (profile.account.accountContext) {
            setAccountContext(profile.account.accountContext);
          }
        }
        if (profile?.user) {
          setCurrentUser(profile.user);
          localStorage.setItem('fodda_user', JSON.stringify(profile.user));
        }
      } catch (e) {
        // Silent fail — stale data is better than breaking the UI
        console.warn('[App] Visibility refresh failed:', e);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clerkUserId, currentAccount]);

  useEffect(() => {
    if (userId) localStorage.setItem('fodda.userId', userId);
  }, [userId]);

  useEffect(() => {
    localStorage.setItem('fodda.apiKey', demoApiKey);
  }, [demoApiKey]);

  // Track previous chat session key for save/restore
  const prevChatKeyRef = useRef<string>('');

  // Preserve inputValue between switches (intentional)
  useEffect(() => {
    const newKey = `${activeView}:${currentVertical}:${accessMode}:${isMcpMode}`;
    // Save outgoing session's messages
    if (prevChatKeyRef.current && messages.length > 0) {
      chatHistoryRef.current[prevChatKeyRef.current] = messages;
    }
    // Restore incoming session's messages (or start fresh)
    const restored = chatHistoryRef.current[newKey] || [];
    setMessages(restored);
    prevChatKeyRef.current = newKey;
    setHighlightedItem(null);
    setIsEvidenceOpen(false);
    setApiTransaction(null);
  }, [currentVertical, accessMode, isMcpMode, activeView]);

  // Deep-link: open top-up modal when navigated via /account/top-up
  useEffect(() => {
    if (pendingTopUpModal && isUnlocked) {
      setIsUpgradeModalOpen(true);
      setPendingTopUpModal(false);
    }
  }, [pendingTopUpModal, isUnlocked]);

  // Auto-dismiss checkout banner after 8 seconds
  useEffect(() => {
    if (checkoutResult) {
      const timer = setTimeout(() => setCheckoutResult(null), checkoutResult === 'success' ? 10000 : 6000);
      return () => clearTimeout(timer);
    }
  }, [checkoutResult]);

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

    // ─── Set initial view based on onboarding choices ───
    if (!hasSetInitialView) {
      // Priority 0: Expert deep-link stored by AuthGate during signup round-trip
      const pendingExpert = localStorage.getItem('fodda.pendingExpert');
      const pendingView = localStorage.getItem('fodda.pendingView');
      if (pendingExpert) {
        localStorage.removeItem('fodda.pendingExpert');
        const pendingQ = localStorage.getItem('fodda.pendingQ');
        localStorage.removeItem('fodda.pendingQ');
        console.log(`[App] Expert deep-link resuming: expert=${pendingExpert}, q=${pendingQ || '(none)'}`);
        setInitialExpertSlug(pendingExpert);
        if (pendingQ) setPrefilledQuestion(pendingQ);
        setActiveView('expert-chat');
      // Priority 1: ?view= param from website CTA (stored by AuthGate in localStorage)
      } else if (pendingView) {
        localStorage.removeItem('fodda.pendingView');
        if (pendingView === 'api') {
          setActiveView('connections-mcp');
        } else if (pendingView === 'sandbox' || pendingView === 'chat') {
          setActiveView('sandbox');
        } else if (pendingView === 'billing') {
          setActiveView('account-billing');
        }
      // Priority 2: ?graph= param — open the chat with that graph selected
      } else if (initialReferralGraph) {
        setCurrentVertical(initialReferralGraph as Vertical);
        setActiveView('sandbox');
      // Priority 3: Default intent-based routing for first login
      } else if (auth.isFirstLogin) {
        const apiUse = auth.user.apiUse || '';

        if (apiUse.toLowerCase().includes('claude')) {
          setActiveView('connections-claude');
        } else if (apiUse.toLowerCase().includes('chatgpt')) {
          setActiveView('connections-chatgpt');
        } else if (apiUse.toLowerCase().includes('perplexity')) {
          setActiveView('connections-perplexity');
        } else if (apiUse.toLowerCase().includes('notion')) {
          setActiveView('connections-notion');
        } else if (apiUse.toLowerCase().includes('mcp')) {
          setActiveView('connections-mcp');
        } else if (apiUse.toLowerCase().includes('co-pilot') || apiUse.toLowerCase().includes('copilot')) {
          setActiveView('connections-copilot');
        } else if (apiUse.toLowerCase().includes('gemini')) {
          setActiveView('connections-gemini');
        } else if (apiUse.toLowerCase().includes('api')) {
          setActiveView('connections-api');
        } else if (apiUse === 'Self-Demo' || apiUse.toLowerCase().includes('chat') || apiUse.toLowerCase().includes('sandbox')) {
          setActiveView('sandbox');
        } else if (apiUse === 'Graph Seller') {
          setActiveView('profile');
        } else {
          setActiveView('connections-mcp');
        }
      }
      setHasSetInitialView(true);
    }

    // ─── Auto-checkout: pricing page "Buy Now" → register → Stripe ───
    // If the user arrived from fodda.ai/pricing with a plan pre-selected,
    // AuthGate stored the planCode in localStorage. On first login, we
    // call the existing checkout/subscribe endpoint and redirect to Stripe.
    const pendingPlanCode = localStorage.getItem('fodda.pendingPlanCode');
    if (pendingPlanCode && auth.isFirstLogin && auth.user.email) {
      const pendingTier = localStorage.getItem('fodda.pendingTier') || '';
      const pendingPrice = localStorage.getItem('fodda.pendingPrice') || '';
      // Clear immediately so we never double-trigger
      localStorage.removeItem('fodda.pendingPlanCode');
      localStorage.removeItem('fodda.pendingTier');
      localStorage.removeItem('fodda.pendingPrice');

      console.log(`[App] Auto-checkout: user signed up from pricing page (plan=${pendingPlanCode}, tier=${pendingTier}, price=$${pendingPrice}). Redirecting to Stripe...`);

      fetch('/api/account/checkout/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: auth.user.email,
          planCode: Number(pendingPlanCode),
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.ok && data.checkout_url) {
            window.location.href = data.checkout_url;
          } else {
            console.warn('[App] Auto-checkout: no checkout URL returned, opening upgrade modal instead', data);
            setIsUpgradeModalOpen(true);
          }
        })
        .catch(err => {
          console.error('[App] Auto-checkout failed:', err);
          // Fallback: show upgrade modal so the user can still subscribe manually
          setIsUpgradeModalOpen(true);
        });
    }

    // Session start is tracked via Users table lastLogin — no need to log
    // a "[SESSION_START]" placeholder to the Questions table (it was polluting
    // query analytics and inflating query counts for every login/restore).
    console.log("[App] Session started — skipping Questions table log.");

    // ─── Fetch dynamic graph catalog from Airtable-powered API ───
    if (auth.account.apiKey) {
      setGraphsLoading(true);
      dataService.fetchGraphs(auth.account.apiKey)
        .then(graphs => {
          console.log(`[App] Graph catalog loaded: ${graphs.length} graphs`);
          setGraphCatalog(graphs);
        })
        .catch(err => console.warn('[App] Graph catalog fetch failed:', err))
        .finally(() => setGraphsLoading(false));

      // Fetch owned graphs for expert dashboard
      dataService.fetchOwnedGraphs(auth.account.apiKey, auth.user.email)
        .then(graphs => {
          console.log(`[App] Owned graphs loaded: ${graphs.length}`);
          setOwnedGraphs(graphs);
        })
        .catch(() => {}); // Graceful — no owned graphs shown
    }
  };

  // Clerk handles verification, registration, sign-in, and team joining natively via its headless SDK hooks.

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
          model: 'gemini-2.5-flash',
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

  const handleSendMessage = useCallback(async (text: string, manualTerms?: string[], promptSource?: string) => {
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
      { userContext, accountContext },
      undefined,
      promptSource
    );

    try {
      if (isMcpMode) {
        // ── MCP AGENTIC MODE ──
        // Routes through the Fodda MCP server for the full experience
        const userEmail = currentUser?.email || '';

        // Build persona context from confirmed fields (only if sharing is enabled)
        const userShareEnabled = currentUser?.shareContextInSessions !== false;
        const accountShareEnabled = currentAccount?.shareAccountContextInSessions !== false;
        let mcpPersonaCtx = '';
        if (userShareEnabled && currentUser?.personaConfirmed && currentUser?.confirmedPersonaText) {
          mcpPersonaCtx = currentUser.confirmedPersonaText;
        }
        if (userShareEnabled && currentUser?.interestsCurrent) {
          try {
            const interests = JSON.parse(currentUser.interestsCurrent);
            if (Array.isArray(interests) && interests.length > 0) {
              const topInterests = interests.slice(0, 5).map((i: any) => i.node).join(', ');
              mcpPersonaCtx += mcpPersonaCtx ? `. Key interests: ${topInterests}` : `Key interests: ${topInterests}`;
            }
          } catch { /* ignore invalid JSON */ }
        }

        const mcpResult = await dataService.mcpChat(
          text,
          currentVertical,
          userEmail,
          currentAccount?.apiKey || '',
          currentUser?.firstName,
          mcpPersonaCtx || undefined,
          userShareEnabled ? (userContext || undefined) : undefined,
          accountShareEnabled ? (accountContext || undefined) : undefined
        );

        if (!mcpResult.ok) {
          throw new Error(mcpResult.error || 'MCP chat failed');
        }

        // DEV MODE: Capture MCP transaction for DevTools
        setApiTransaction({
          request: { query: text, vertical: currentVertical, mode: 'mcp' },
          headers: { 'X-Fodda-Execution-Mode': 'mcp' },
          response: {
            toolCalls: mcpResult.toolCalls,
            totalDurationMs: mcpResult.totalDurationMs,
            answerLength: mcpResult.answer?.length || 0,
          },
          durationMs: mcpResult.totalDurationMs || 0,
          timestamp: Date.now()
        });

        const assistantMsg: Message = {
          id: generateUUID(),
          role: 'assistant',
          content: mcpResult.answer || 'No response generated.',
          timestamp: Date.now(),
          evidence: [],
          relatedTrends: [],
          suggestedQuestions: mcpResult.suggestedQuestions || [],
          stepCount: mcpResult.toolCalls?.length || 1,
          failureType: mcpResult.failureType,
          diagnostic: {
            dataStatus: 'MCP_AGENTIC',
            termsUsed: mcpResult.toolCalls?.map((tc: any) => tc.tool) || []
          }
        } as Message;

        setMessages((prev: Message[]) => [...prev, assistantMsg]);

      } else {
        // ── DIRECT API MODE ──
        // Current pipeline: retrieve() → generateResponse()
        let result: RetrievalResult;

        if (currentVertical === Vertical.Baseline) {
          const qId = await inferBaselineQuestion(text);
          result = await dataService.retrieve(text, Vertical.Baseline, 200, {
            questionId: qId,
            segmentType: 'AGEGRP',
            excludeBlank: true
          }, trackingInfo);
        } else {
          result = await dataService.retrieve(text, currentVertical, 40, { manualTerms }, trackingInfo, 'direct');
        }

        // DEV MODE: Capture transaction
        if (result.debug) {
          setApiTransaction({
            request: result.debug.request,
            headers: result.debug.headers,
            response: result.debug.response,
            durationMs: result.debug.durationMs,
            timestamp: Date.now()
          });
        }

        // Build persona context from confirmed fields (only if sharing is enabled)
        const shareEnabled = currentUser?.shareContextInSessions !== false;
        const accountShareEnabled = currentAccount?.shareAccountContextInSessions !== false;
        let personaContext = '';
        if (shareEnabled && currentUser?.personaConfirmed && currentUser?.confirmedPersonaText) {
          personaContext = currentUser.confirmedPersonaText;
        }
        if (shareEnabled && currentUser?.interestsCurrent) {
          try {
            const interests = JSON.parse(currentUser.interestsCurrent);
            if (Array.isArray(interests) && interests.length > 0) {
              const topInterests = interests.slice(0, 5).map((i: any) => i.node).join(', ');
              personaContext += personaContext ? `. Key interests: ${topInterests}` : `Key interests: ${topInterests}`;
            }
          } catch { /* ignore invalid JSON */ }
        }

        // Generate AI Response Synthesis
        const generationResult = await generateResponse(
          text,
          currentVertical,
          result,
          shareEnabled ? userContext : undefined,
          accountShareEnabled ? accountContext : undefined,
          currentUser?.firstName,
          personaContext || undefined
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
      }
    } catch (err: any) {
      console.error("[App] Search Failed:", err);

      // Handle Plan Limits
      if (err.code === 'PLAN_LIMIT_EXCEEDED' || err.message?.includes('PLAN_LIMIT_EXCEEDED')) {
        if (err.setupUrl) {
          // API returned a setup URL — open payment setup flow
          setIsPaymentSetupOpen(true);
        } else {
          setIsUpgradeModalOpen(true);
        }
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

  // ─── Auto-submit prefilled question when chat is ready ───
  useEffect(() => {
    if (!isUnlocked || !prefilledQuestion) return;
    if (activeView !== 'expert-chat' && activeView !== 'sandbox') return;

    const currentId = (currentVertical || '').toLowerCase();

    // For expert-chat, wait for the right expert to be loaded
    if (activeView === 'expert-chat') {
       if (!initialExpertSlug) return;
       const targetSlug = initialExpertSlug.toLowerCase();
       const expertLoaded = graphCatalog.some(g =>
         g.id.toLowerCase() === currentId &&
         g.graph_type === 'expert' &&
         (g.expert_slug?.toLowerCase() === targetSlug || g.id.toLowerCase() === targetSlug)
       );
       if (!expertLoaded) return;
    }

    // For sandbox, wait for the specific referral graph if one was requested
    if (activeView === 'sandbox' && initialReferralGraph) {
       const targetGraph = initialReferralGraph.toLowerCase();
       if (currentId !== targetGraph) return;
    }

    console.log(`[App] Auto-submitting prefilled question: "${prefilledQuestion}"`);
    // Delay slightly to ensure the chat interface is mounted and state is stable
    const timer = setTimeout(() => {
      handleSendMessage(prefilledQuestion);
      setPrefilledQuestion(null);
    }, 500);
    return () => clearTimeout(timer);
  }, [isUnlocked, prefilledQuestion, activeView, initialExpertSlug, initialReferralGraph, currentVertical, graphCatalog, handleSendMessage]);

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

  // ─── SSO Callback Route ─────────────────────────────────────────────────────
  // Must be checked before the isUnlocked / Clerk-loading guard so that the
  // OAuth redirect can complete even while the session is still being resolved.
  if (typeof window !== 'undefined' && window.location.pathname === '/sso-callback') {
    return <SsoCallbackPage />;
  }

  if (!isUnlocked) {
    // Don't show the login gate while Clerk is still loading or while we're
    // fetching the profile for an authenticated user. This prevents the gate
    // from flashing briefly for users who are already logged in.
    if (!isAuthLoaded || clerkUserId) {
      return (
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          height: '100vh', background: 'var(--bg, #faf9f6)', gap: 16 
        }}>
          <div style={{ 
            width: 40, height: 40, border: '3px solid var(--line, #e0ddd8)', 
            borderTopColor: 'var(--brand, #6c47ff)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite' 
          }} />
          <p style={{ fontFamily: 'var(--font-serif, Georgia)', fontStyle: 'italic', color: 'var(--ink-2, #888)', fontSize: 14 }}>
            Loading…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    if (isAdminOpen) {
      return <AdminPortal onBack={() => setIsAdminOpen(false)} userId={userId || 'at-gate'} />;
    }
    return <AuthGate onAdminOpen={() => setIsAdminOpen(true)} initialReferralGraph={initialReferralGraph} initialExpertSlug={initialExpertSlug} />;
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

  // ─── Helper: map activeView → connection tab ───
  const connectionTabMap: Record<string, import('./components/ConnectionsPage').ConnectionTab> = {
    'connections-claude': 'claude',
    'connections-chatgpt': 'chatgpt',
    'connections-notion': 'notion',
    'connections-copilot': 'copilot',
    'connections-gemini': 'gemini',
    'connections-mcp': 'mcp',
    'connections-api': 'api',
    'connections-perplexity': 'perplexity',
  };
  const knowledgeTabMap: Record<string, 'api-docs' | 'reliability' | 'security'> = {
    'knowledge-api-docs': 'api-docs',
    'knowledge-reliability': 'reliability',
    'knowledge-security': 'security',
  };

  // ─── Render the active view content ───
  const renderActiveView = () => {
    if (!currentUser || !currentAccount) return null;

    // Account views (Admin/Owner only)
    if (activeView === 'account-overview' || activeView === 'account-team' || activeView === 'account-usage') {
      const tabMap: Record<string, 'overview' | 'team' | 'usage'> = {
        'account-overview': 'overview',
        'account-team': 'team',
        'account-usage': 'usage',
      };
      const headerLabels: Record<string, { section: string; title: string; subtitle: string }> = {
        'account-overview': { section: 'Account', title: currentAccount.name || 'Account Overview', subtitle: 'Organization settings, plan details, and account health' },
        'account-team': { section: 'Users List', title: 'Team Members', subtitle: 'Manage users, roles, and invitations for your organization' },
        'account-usage': { section: 'Usage Monitoring', title: 'Usage', subtitle: 'Track query volume, graph utilization, and monthly trends' },
      };
      const { section, title, subtitle } = headerLabels[activeView] || headerLabels['account-overview'];
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-8 pt-8 pb-4 shrink-0">
            <p className="eyebrow mb-1">{section}</p>
            <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">{title}</h1>
            <p className="text-sm text-ink-3 mt-1">{subtitle}</p>
          </div>
          <AccountPortal
            isOpen={true}
            onClose={() => setActiveView('profile')}
            user={currentUser}
            account={currentAccount}
            onUpdate={(updatedAccount) => {
              setCurrentAccount(updatedAccount);
              if (updatedAccount.accountContext) setAccountContext(updatedAccount.accountContext);
            }}
            onViewPlans={() => setIsUpgradeModalOpen(true)}
            onViewApiDocs={() => setActiveView('knowledge-api-docs')}
            onSetupPayment={() => setIsPaymentSetupOpen(true)}
            initialTab={tabMap[activeView] || 'overview'}
            inline={true}
          />
        </div>
      );
    }

    if (activeView === 'account-context') {
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-8 pb-4">
            <p className="eyebrow mb-1">Context Wiki Settings</p>
            <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Account Context Wiki</h1>
            <p className="text-sm text-ink-3 mt-1">Define the research context wiki that shapes how Fodda responds to queries for this account.</p>
          </div>
          <div className="px-8 pb-8 max-w-4xl">
            <AccountContextWiki user={currentUser} account={currentAccount} onSaveContext={handleUpdateAccountContext} />
          </div>
        </div>
      );
    }

    if (activeView === 'profile-context') {
      return (
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-8 pb-4">
            <p className="eyebrow mb-1">Context Wiki Settings</p>
            <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Your Research Persona</h1>
            <p className="text-sm text-ink-3 mt-1">Your evolving research profile — built from your activity, confirmed by you.</p>
          </div>
          <div className="px-8 pb-8 max-w-4xl">
            <ProfileContextWiki user={currentUser} account={currentAccount} onSaveContext={handleUpdateUserContext} />
          </div>
        </div>
      );
    }

    if (activeView === 'account-governance') {
      return <GovernancePage />;
    }

    if (activeView === 'account-billing') {
      return (
        <BillingPage
          user={currentUser}
          account={currentAccount}
          onNavigate={(view: string) => setActiveView(view as any)}
          onViewPlans={() => setIsUpgradeModalOpen(true)}
          onSetupPayment={() => setIsPaymentSetupOpen(true)}
        />
      );
    }

    // Gemini / Vertex — standalone page (not routed through AccountPortal)
    if (activeView === 'connections-gemini') {
      const MCP_ENDPOINT = 'https://mcp.fodda.ai/mcp';
      const MCP_SSE_URL = 'https://mcp.fodda.ai/sse';
      const apiKey = currentAccount.apiKey || 'YOUR_API_KEY';
      const userEmail = currentUser?.email || 'YOUR_EMAIL';
      const vertexConfig = JSON.stringify({
        tools: [{
          type: 'mcp',
          name: 'fodda',
          url: `${MCP_ENDPOINT}?api_key=${apiKey}&user_id=${encodeURIComponent(userEmail)}`
        }]
      }, null, 2);

      return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-8 pt-8 pb-4">
            <p className="eyebrow mb-1">Connections</p>
            <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Gemini / Vertex AI</h1>
            <p className="text-sm text-ink-3 mt-1">Connect Fodda knowledge graphs to Google Gemini and Vertex AI agents.</p>
          </div>
          <div className="px-8 pb-8 max-w-4xl space-y-6">

            {/* Vertex AI JSON Config */}
            <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
              <h3 className="eyebrow">Vertex AI / Gemini Configuration</h3>
              <p className="text-sm text-ink-3">Add this configuration to your Vertex AI or Gemini project to connect Fodda as an MCP tool:</p>
              <div className="relative group">
                <pre className="p-4 bg-ink rounded-xl text-sm font-mono text-green-400 border border-ink-2 whitespace-pre-wrap overflow-x-auto leading-relaxed">{vertexConfig}</pre>
                <button
                  onClick={() => handleCopyField(vertexConfig, 'vertex-json')}
                  className={`absolute top-3 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'vertex-json' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`}
                  title="Copy"
                >
                  {copiedField === 'vertex-json' ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>
                  )}
                </button>
              </div>
            </section>

            {/* Endpoints */}
            <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
              <h3 className="eyebrow">Endpoints</h3>
              <div className="space-y-3">
                <div>
                  <label className="block eyebrow mb-1">Streamable HTTP <span className="text-brand font-normal">(recommended)</span></label>
                  <div className="relative group">
                    <code className="block p-3.5 bg-ink rounded-xl text-sm font-mono text-purple-300 border border-ink-2 break-all pr-12">{MCP_ENDPOINT}</code>
                    <button
                      onClick={() => handleCopyField(MCP_ENDPOINT, 'vertex-endpoint-http')}
                      className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'vertex-endpoint-http' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`}
                      title="Copy"
                    >
                      {copiedField === 'vertex-endpoint-http' ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block eyebrow mb-1">SSE Transport <span className="text-ink-4 font-normal">(legacy)</span></label>
                  <div className="relative group">
                    <code className="block p-3.5 bg-ink rounded-xl text-sm font-mono text-blue-300 border border-ink-2 break-all pr-12">{MCP_SSE_URL}</code>
                    <button
                      onClick={() => handleCopyField(MCP_SSE_URL, 'vertex-endpoint-sse')}
                      className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'vertex-endpoint-sse' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`}
                      title="Copy"
                    >
                      {copiedField === 'vertex-endpoint-sse' ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* API Key */}
            <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
              <h3 className="eyebrow">Authentication</h3>
              <div>
                <label className="block eyebrow mb-1">Your API Key</label>
                <div className="relative group">
                  <code className="block p-3.5 bg-ink rounded-xl text-sm font-mono text-amber-300 border border-ink-2 break-all pr-12">{apiKey}</code>
                  <button
                    onClick={() => handleCopyField(apiKey, 'vertex-apikey')}
                    className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'vertex-apikey' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`}
                    title="Copy"
                  >
                    {copiedField === 'vertex-apikey' ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-ink-4">Your API key is embedded in the configuration URL above. For SSE transport, pass as a Bearer token in the Authorization header.</p>
            </section>

            {/* Agentic Prompting Tip */}
            <section className="p-6 bg-brand/5 border border-brand/20 rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <h3 className="eyebrow text-brand mb-0">Agentic Prompting Tip</h3>
              </div>
              <p className="text-sm text-ink-2 leading-relaxed">
                Fodda's MCP tools are fully self-describing. When prompting your connected agent, you don't need to write rigid, step-by-step tool execution scripts. Simply provide a high-level <strong className="text-ink">Goal</strong> (e.g., "Analyze checkout friction trends") and the agent will autonomously orchestrate the right tools.
              </p>
            </section>

            {/* Help Link */}
            <div className="text-center pt-2">
              <p className="text-xs text-ink-3">Need help? See the <a href="https://www.fodda.ai/#/vertex-ai-setup-guide" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">Gemini/Vertex Setup Guide →</a></p>
            </div>
          </div>
        </div>
      );
    }

    // Connections views (Claude, Notion, Copilot, MCP, API)
    if (connectionTabMap[activeView]) {
      return (
        <ConnectionsPage
          activeTab={connectionTabMap[activeView]}
          user={currentUser}
          account={currentAccount}
          onUpdate={(updatedAccount) => {
            setCurrentAccount(updatedAccount);
            if (updatedAccount.accountContext) setAccountContext(updatedAccount.accountContext);
          }}
          onViewPlans={() => setIsUpgradeModalOpen(true)}
          onViewApiDocs={() => setActiveView('knowledge-api-docs')}
        />
      );
    }

    // Knowledge views
    if (knowledgeTabMap[activeView]) {
      return <KnowledgePage activeTab={knowledgeTabMap[activeView]} />;
    }

    // Coverage Map & My Graphs
    if (activeView === 'coverage' || activeView === 'my-graphs') {
      return (
        <CoverageMapPage
          graphs={graphCatalog}
          userVertical={currentAccount?.vertical || 'all'}
          disabledGraphs={currentUser?.disabledGraphs ? currentUser.disabledGraphs.split(',') : []}
          onToggleGraph={toggleGraph}
          onNavigate={handleNavigate}
          user={currentUser}
          account={currentAccount}
        />
      );
    }

    // Skills
    if (activeView === 'skills') {
      return (
        <MyGraphsPage
          graphs={graphCatalog.filter(g => (g.graph_type || '').toLowerCase().trim() === 'skill')}
          loading={graphsLoading}
          supplementalSources={dataService.getSupplementalSources()}
          userVertical={currentAccount?.vertical || 'all'}
          userEmail={currentUser?.email}
          disabledGraphs={currentUser?.disabledGraphs || ''}
          ownedGraphs={ownedGraphs}
          accountId={currentAccount?.id}
          mode="skills"
          onNavigate={setActiveView}
        />
      );
    }

    // Team Graphs — same view as My Graphs but in team mode (Owner/Admin only)
    if (activeView === 'team-graphs') {
      const userRole = currentUser?.role || 'User';
      const isAdminOrOwner = userRole === 'Owner' || userRole === 'Admin';
      if (!isAdminOrOwner) {
        return (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-8 pt-8 pb-4">
              <p className="eyebrow mb-1">Graphs</p>
              <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Team Graphs</h1>
              <p className="text-sm text-ink-3 mt-1">Knowledge graphs available to your team.</p>
            </div>
            <div className="px-8 pb-8 max-w-4xl">
              <section className="p-8 bg-paper border border-line rounded-2xl flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-cream flex items-center justify-center mb-4 border border-line">
                  <svg className="w-6 h-6 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h3 className="text-sm font-bold text-ink-2 mb-1">Admin Access Required</h3>
                <p className="text-xs text-ink-3 max-w-xs">Only account Owners and Admins can manage team graph access. Contact your account admin for changes.</p>
              </section>
            </div>
          </div>
        );
      }
      return <MyGraphsPage graphs={graphCatalog} loading={graphsLoading} supplementalSources={dataService.getSupplementalSources()} userVertical={currentAccount?.vertical || 'all'} userEmail={currentUser?.email} disabledGraphs={currentUser?.disabledGraphs || ''} ownedGraphs={ownedGraphs} accountId={currentAccount?.id} mode="team" />;
    }

    // Profile (default)
    if (activeView === 'profile') {
      return (
        <ProfilePage
          user={currentUser}
          account={currentAccount}
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
          onNavigate={(view: string) => setActiveView(view as any)}
        />
      );
    }

    if (activeView === 'profile-usage') {
      return (
        <ProfileUsagePage
          user={currentUser}
          account={currentAccount}
        />
      );
    }

    // Expert Twin — review and edit Digital Twin documents
    if (activeView === 'expert-twin') {
      return (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ExpertTwinPage user={currentUser} />
        </div>
      );
    }

    // Expert Chat (expert graphs only)
    if (activeView === 'expert-chat') {
      const validExpertSubTypes = ['digital twin', 'synthetic expert', 'synthetic executive'];
      const expertGraphs = graphCatalog.filter((g: KnowledgeGraph) => {
        if (g.status && g.status !== 'live') return false;
        if (g.accessible === false) return false;
        const type = (g.graph_type || '').toLowerCase().trim();
        if (type !== 'expert') return false;
        // Require a recognised expert sub-type (excludes miscategorised graphs like TBWA)
        const sub = (g.graph_sub_type || '').toLowerCase().trim();
        return validExpertSubTypes.includes(sub);
      }).sort((a, b) => (a.name || a.domain || a.verticalName || '').localeCompare(b.name || b.domain || b.verticalName || ''));

      // Auto-select expert from deep-link slug (match by expert_slug or id)
      if (initialExpertSlug && expertGraphs.length > 0) {
        const slugMatch = expertGraphs.find(g =>
          (g.expert_slug && g.expert_slug.toLowerCase() === initialExpertSlug) ||
          g.id.toLowerCase() === initialExpertSlug
        );
        if (slugMatch && slugMatch.id !== currentVertical) {
          setTimeout(() => handleVerticalChange(slugMatch.id), 0);
        } else if (!slugMatch && !showUnclaimedModal && !unclaimedExpert) {
          // No live graph match — check if this is an unclaimed expert
          fetch(`/api/unclaimed/lookup/${encodeURIComponent(initialExpertSlug)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data?.ok && data.analyst) {
                setUnclaimedExpert(data.analyst);
                setShowUnclaimedModal(true);
                setInitialExpertSlug(null); // Prevent re-fetching on re-render
              }
            })
            .catch(err => console.warn('[App] Unclaimed expert lookup failed:', err));
        }
      } else if (initialExpertSlug && expertGraphs.length === 0 && !showUnclaimedModal && !unclaimedExpert) {
        // No expert graphs loaded yet but we have a slug — try unclaimed lookup
        fetch(`/api/unclaimed/lookup/${encodeURIComponent(initialExpertSlug)}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.ok && data.analyst) {
              setUnclaimedExpert(data.analyst);
              setShowUnclaimedModal(true);
              setInitialExpertSlug(null);
            }
          })
          .catch(err => console.warn('[App] Unclaimed expert lookup failed:', err));
      }

      // If current vertical isn't in the expert list, switch to the first expert
      const isCurrentAnExpert = expertGraphs.some(g => g.id === currentVertical);
      if (!isCurrentAnExpert && expertGraphs.length > 0) {
        setTimeout(() => handleVerticalChange(expertGraphs[0].id), 0);
      }

      // Sub-type grouping for expert dropdown
      const expertSubTypes: Record<string, KnowledgeGraph[]> = {};
      expertGraphs.forEach(g => {
        const sub = g.graph_sub_type === 'Digital Twin' ? 'Human Agent' : (g.graph_sub_type || 'Synthetic Expert');
        if (!expertSubTypes[sub]) expertSubTypes[sub] = [];
        expertSubTypes[sub].push(g);
      });

      const activeGraph = expertGraphs.find(g => g.id === currentVertical) || expertGraphs[0];

      return (
        <>
          {/* Expert Chat View */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Page Header */}
            <div className="px-8 pt-8 pb-2 shrink-0 flex items-start justify-between relative z-20">
              <div>
                <p className="eyebrow mb-1">Expert Chat</p>
                <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Expert Consultations</h1>
                <p className="text-sm text-ink-3 mt-1">Chat with human agents, synthetic experts & C-suite executives.</p>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                {/* Expert Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-ink-4 uppercase tracking-[0.15em] shrink-0 hidden sm:inline">Expert:</span>
                  <div className="relative">
                    <button
                      onClick={() => setIsGraphSelectorOpen(prev => !prev)}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-line rounded-xl text-xs font-bold text-ink hover:border-line-strong transition-all shrink-0 shadow-sm"
                    >
                      {activeGraph?.portrait_url || activeGraph?.image_url ? (
                        <img src={activeGraph.image_url || activeGraph.portrait_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse shrink-0" />
                      )}
                      <span className="truncate max-w-[140px] sm:max-w-[200px]">{activeGraph ? (activeGraph.name || activeGraph.domain || activeGraph.verticalName) : 'Select an Expert...'}</span>
                      <svg className={`w-3.5 h-3.5 text-ink-4 transition-transform duration-200 ${isGraphSelectorOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expert Dropdown */}
                    {isGraphSelectorOpen && (
                      <>
                        <div className="fixed inset-0 z-[45]" onClick={() => setIsGraphSelectorOpen(false)} />
                        <div className="absolute right-0 mt-2 w-80 max-h-[450px] bg-white border border-line rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-fade-in-up">
                          <div className="p-3 border-b border-line bg-cream shrink-0 flex items-center gap-2">
                            <svg className="w-4 h-4 text-ink-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              type="text"
                              placeholder="Search experts..."
                              value={graphSearchQuery}
                              onChange={(e) => setGraphSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-transparent border-0 text-xs text-ink focus:outline-none focus:ring-0 placeholder:text-ink-4"
                              autoFocus
                            />
                            {graphSearchQuery && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setGraphSearchQuery(''); }}
                                className="text-ink-4 hover:text-ink p-0.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
                            {Object.entries(expertSubTypes).map(([subType, graphs]) => {
                              const filtered = graphs.filter(g => {
                                const name = (g.name || g.domain || g.verticalName || '').toLowerCase();
                                const desc = (g.description || g.headline || '').toLowerCase();
                                const query = graphSearchQuery.toLowerCase().trim();
                                return name.includes(query) || desc.includes(query);
                              });
                              if (filtered.length === 0) return null;
                              return (
                                <div key={subType} className="space-y-1">
                                  <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-ink-4 bg-cream/50 rounded-md">
                                    {subType}
                                  </div>
                                  <div className="space-y-0.5">
                                    {filtered.map(g => (
                                      <button
                                        key={g.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleVerticalChange(g.id);
                                          setIsGraphSelectorOpen(false);
                                          setGraphSearchQuery('');
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center gap-2.5 transition-all ${
                                          currentVertical === g.id
                                            ? 'bg-brand-soft text-brand border border-brand/20'
                                            : 'text-ink-2 hover:bg-line-soft border border-transparent hover:text-ink'
                                        }`}
                                      >
                                        {(g.portrait_url || g.image_url) ? (
                                          <img src={g.image_url || g.portrait_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-line" />
                                        ) : (
                                          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 border border-violet-200">
                                            <span className="text-[10px] font-bold text-violet-500">{(g.name || '?')[0]}</span>
                                          </div>
                                        )}
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                          <span className="font-bold truncate">{g.name || g.domain || g.verticalName}</span>
                                          {(g.headline || g.description) && (
                                            <span className="text-[10px] text-ink-3 truncate font-normal leading-tight">
                                              {g.headline || g.description}
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            {expertGraphs.every(g => {
                              const name = (g.name || g.domain || g.verticalName || '').toLowerCase();
                              const desc = (g.description || g.headline || '').toLowerCase();
                              const query = graphSearchQuery.toLowerCase().trim();
                              return !(name.includes(query) || desc.includes(query));
                            }) && (
                              <div className="py-6 text-center text-ink-4 text-xs italic">
                                No experts found matching "{graphSearchQuery}"
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setIsDevMode(prev => !prev)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                    isDevMode 
                      ? 'bg-brand-soft text-brand border-brand/30' 
                      : 'bg-paper text-ink-2 border-line hover:text-ink hover:border-line-strong'
                  }`}
                  title="Toggle Diagnostic Console (Ctrl + Shift + D)"
                >
                  <svg className="w-4 h-4 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Diagnostic Console</span>
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
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
                graphCatalog={graphCatalog}
                isExpertChat={true}
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
            </div>
          </div>
        </>
      );
    }

    // Research Graphs / Sandbox (Chat + Evidence) — excludes expert graphs
    if (activeView === 'sandbox' || activeView === 'live-requests') {
      // PSFK domain graph IDs that should display the PSFK favicon
      const PSFK_GRAPH_IDS = new Set(['retail', 'beauty', 'sports', 'fashion', 'tech', 'food', 'travel']);

      // Dynamic graph catalog: show accessible, live, non-expert graphs
      const graphOptions = graphCatalog.filter((g: KnowledgeGraph) => {
        if (g.status && g.status !== 'live') return false;
        if (g.accessible === false) return false;
        // Exclude expert graphs — those are in Expert Chat
        const type = (g.graph_type || '').toLowerCase().trim();
        if (type === 'expert') return false;
        return true;
      });

      // Group graphs by graph_type
      const categoryNames: Record<string, string> = {
        domain: 'Domain Context',
        industry_report: 'Industry Papers',
        supplemental: 'Supplemental Data',
        user: 'Custom Graphs',
      };

      const groupedGraphs: Record<string, KnowledgeGraph[]> = {};
      graphOptions.forEach(g => {
        const rawType = g.graph_type || 'domain';
        let type = rawType.toLowerCase().trim();
        if (type === 'industry report') type = 'industry_report';
        if (!groupedGraphs[type]) groupedGraphs[type] = [];
        groupedGraphs[type].push(g);
      });

      // Sort each category alphabetically
      Object.keys(groupedGraphs).forEach(key => {
        groupedGraphs[key].sort((a, b) => (a.name || a.domain || a.verticalName || '').localeCompare(b.name || b.domain || b.verticalName || ''));
      });

      // If current vertical isn't in the research list, switch to the first available
      const isCurrentInResearch = graphOptions.some(g => g.id === currentVertical);
      if (!isCurrentInResearch && graphOptions.length > 0) {
        setTimeout(() => handleVerticalChange(graphOptions[0].id), 0);
      }

      const activeGraph = graphOptions.find(g => g.id === currentVertical) || graphOptions[0];

      return (
        <>
          {/* Graph Chat View */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Page Header — title + graph selector + diagnostic console */}
            <div className="px-8 pt-8 pb-2 shrink-0 flex items-start justify-between relative z-20">
              <div>
                <p className="eyebrow mb-1">Graph Chat</p>
                <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Research Graphs</h1>
                <p className="text-sm text-ink-3 mt-1">Compose a query against any live graph.</p>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                {/* Graph Selector — inline in header */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-ink-4 uppercase tracking-[0.15em] shrink-0 hidden sm:inline">Graph:</span>
                  <div className="relative">
                    <button
                      onClick={() => setIsGraphSelectorOpen(prev => !prev)}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-line rounded-xl text-xs font-bold text-ink hover:border-line-strong transition-all shrink-0 shadow-sm"
                    >
                      {activeGraph && PSFK_GRAPH_IDS.has(activeGraph.id) ? (
                        <img src="https://psfk.com/favicon.ico" alt="PSFK" className="w-4 h-4 rounded-sm object-cover shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                      )}
                      <span className="truncate max-w-[140px] sm:max-w-[200px]">{activeGraph ? (activeGraph.name || activeGraph.domain || activeGraph.verticalName) : 'Select a Graph...'}</span>
                      <svg className={`w-3.5 h-3.5 text-ink-4 transition-transform duration-200 ${isGraphSelectorOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Panel */}
                    {isGraphSelectorOpen && (
                      <>
                        {/* Overlay to close when clicking outside */}
                        <div className="fixed inset-0 z-[45]" onClick={() => setIsGraphSelectorOpen(false)} />
                        
                        <div className="absolute right-0 mt-2 w-80 max-h-[450px] bg-white border border-line rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-fade-in-up">
                          {/* Search Input */}
                          <div className="p-3 border-b border-line bg-cream shrink-0 flex items-center gap-2">
                            <svg className="w-4 h-4 text-ink-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              type="text"
                              placeholder="Search graphs..."
                              value={graphSearchQuery}
                              onChange={(e) => setGraphSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-transparent border-0 text-xs text-ink focus:outline-none focus:ring-0 placeholder:text-ink-4"
                              autoFocus
                            />
                            {graphSearchQuery && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setGraphSearchQuery(''); }}
                                className="text-ink-4 hover:text-ink p-0.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* List Area */}
                          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
                            {Object.entries(groupedGraphs).map(([catKey, graphsInCat]) => {
                              // Filter graphs within category by search query
                              const filtered = graphsInCat.filter(g => {
                                const name = (g.domain || g.verticalName || g.name || '').toLowerCase();
                                const desc = (g.description || g.headline || '').toLowerCase();
                                const query = graphSearchQuery.toLowerCase().trim();
                                return name.includes(query) || desc.includes(query);
                              });

                              if (filtered.length === 0) return null;

                              const catName = categoryNames[catKey] || catKey.toUpperCase();

                              return (
                                <div key={catKey} className="space-y-1">
                                  <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-ink-4 bg-cream/50 rounded-md">
                                    {catName}
                                  </div>
                                  <div className="space-y-0.5">
                                    {filtered.map(g => (
                                      <button
                                        key={g.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleVerticalChange(g.id);
                                          setIsGraphSelectorOpen(false);
                                          setGraphSearchQuery('');
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex flex-col gap-0.5 transition-all ${
                                          currentVertical === g.id
                                            ? 'bg-brand-soft text-brand border border-brand/20'
                                            : 'text-ink-2 hover:bg-line-soft border border-transparent hover:text-ink'
                                        }`}
                                      >
                                        <div className="font-bold flex items-center gap-1.5">
                                          {PSFK_GRAPH_IDS.has(g.id) && (
                                            <img src="https://psfk.com/favicon.ico" alt="PSFK" className="w-4 h-4 rounded-sm object-cover shrink-0" />
                                          )}
                                          <span className="truncate">{g.name || g.domain || g.verticalName}</span>
                                          {g.status === 'beta' && (
                                            <span className="text-[8px] bg-blue-50 text-blue-600 px-1.5 py-0.2 rounded font-mono font-bold border border-blue-200">BETA</span>
                                          )}
                                        </div>
                                        {(g.headline || g.description) && (
                                          <span className="text-[10px] text-ink-3 truncate font-normal leading-tight">
                                            {g.headline || g.description}
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            {/* No Results Found */}
                            {Object.values(groupedGraphs).every(
                              graphsInCat =>
                                graphsInCat.filter(g => {
                                  const name = (g.domain || g.verticalName || g.name || '').toLowerCase();
                                  const desc = (g.description || g.headline || '').toLowerCase();
                                  const query = graphSearchQuery.toLowerCase().trim();
                                  return name.includes(query) || desc.includes(query);
                                }).length === 0
                            ) && (
                              <div className="py-6 text-center text-ink-4 text-xs italic">
                                No graphs found matching "{graphSearchQuery}"
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setIsDevMode(prev => !prev)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                    isDevMode 
                      ? 'bg-brand-soft text-brand border-brand/30' 
                      : 'bg-paper text-ink-2 border-line hover:text-ink hover:border-line-strong'
                  }`}
                  title="Toggle Diagnostic Console (Ctrl + Shift + D)"
                >
                  <svg className="w-4 h-4 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Diagnostic Console</span>
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
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
                graphCatalog={graphCatalog}
                isExpertChat={false}
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
            </div>
          </div>
        </>
      );
    }

    if (activeView === 'library') {
      return (
        <QueryLibraryPage
          user={currentUser}
          account={currentAccount}
          onTryPrompt={(promptText, graphId) => {
            setInputValue(promptText);
            if (graphId) setCurrentVertical(graphId as any);
            setActiveView('sandbox');
          }}
        />
      );
    }

    // Fallback — render profile
    return (
      <ProfilePage
        user={currentUser}
        account={currentAccount}
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
        onNavigate={(view: string) => setActiveView(view as any)}
      />
    );
  };

  return (
    <div className="flex h-screen w-screen bg-white text-ink overflow-hidden font-sans relative">
      {/* ─── Checkout Result Banner (Stripe redirect) ─── */}
      {checkoutResult && (
        <div className="fixed top-0 left-0 right-0 z-[500] flex justify-center pointer-events-none">
          <div
            className={`pointer-events-auto mt-4 mx-4 max-w-lg w-full rounded-2xl border shadow-2xl backdrop-blur-sm px-6 py-5 flex items-start gap-4 ${
              checkoutResult === 'success'
                ? 'bg-brand-softer border-brand/20 shadow-brand-soft/50'
                : 'bg-cream border-line-strong shadow-line/50'
            }`}
            style={{ animation: 'checkoutSlideIn 0.4s ease-out' }}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              checkoutResult === 'success' ? 'bg-brand-soft' : 'bg-line-soft'
            }`}>
              {checkoutResult === 'success' ? (
                <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-5 h-5 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /><path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {checkoutResult === 'success' ? (
                <>
                  <h3 className="text-sm font-bold text-ink mb-0.5">Subscription Active!</h3>
                  <p className="text-xs text-ink-2 leading-relaxed">
                    Your plan has been upgraded. You're all set — explore your graphs, connect via MCP, or check your account settings.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-ink mb-0.5">Checkout Cancelled</h3>
                  <p className="text-xs text-ink-3 leading-relaxed">
                    No charges were made. You can subscribe anytime from your account page.
                  </p>
                </>
              )}
            </div>
            <button
              onClick={() => setCheckoutResult(null)}
              className="shrink-0 p-1 rounded-[10px] transition-colors text-ink-4 hover:text-ink hover:bg-line-soft"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
      {/* ─── Modals (kept as overlays, independent of navigation) ─── */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentPlanName={currentAccount?.planName || currentAccount?.planLevel || 'Free'}
        currentPlanCode={currentAccount?.planCode}
        subscriptionStatus={currentAccount?.subscriptionStatus}
        userEmail={currentUser?.email}
        accountVertical={currentAccount?.vertical}
      />
      {currentUser && currentAccount && (
        <PaymentSetupModal
          isOpen={isPaymentSetupOpen}
          onClose={() => setIsPaymentSetupOpen(false)}
          accountId={currentAccount.id}
          userEmail={currentUser.email}
          onSuccess={() => {
            // Refresh account data to reflect hasPaymentMethod + overageEnabled
            if (currentAccount) {
              setCurrentAccount({ ...currentAccount, hasPaymentMethod: true, overageEnabled: true });
            }
          }}
        />
      )}
      <ApiModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />
      <SecurityModal isOpen={isSecurityModalOpen} onClose={() => setIsSecurityModalOpen(false)} />
      <DeterministicModal isOpen={isDeterministicModalOpen} onClose={() => setIsDeterministicModalOpen(false)} />
      <UnclaimedExpertModal
        isOpen={showUnclaimedModal}
        onClose={() => {
          setShowUnclaimedModal(false);
          setUnclaimedExpert(null);
        }}
        expert={unclaimedExpert || { id: '', name: '' }}
        currentUser={currentUser ? { id: currentUser.id, email: currentUser.email, name: currentUser.name || currentUser.userName } : undefined}
      />
      <DevToolsDrawer
        isOpen={isDevMode}
        onClose={() => setIsDevMode(false)}
        transaction={apiTransaction}
        isMcpMode={isMcpMode}
        onToggleMcpMode={() => setIsMcpMode(!isMcpMode)}
        simulationMode={null}
        onSimulationChange={() => {}}
      />
      {isAdminOpen && (
        <AdminPortal
          onBack={() => setIsAdminOpen(false)}
          userId={userId || currentUser?.email || 'unknown'}
        />
      )}

      {isUnlocked && (
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          userRole={currentUser?.role}
          onLogout={async () => {
            await signOut();
            localStorage.removeItem('fodda_unlocked');
            localStorage.removeItem('fodda_user');
            localStorage.removeItem('fodda_account');
            localStorage.removeItem('fodda_session_token');
            localStorage.removeItem('fodda_session_expiry');
            localStorage.removeItem('fodda.userId');
            localStorage.removeItem('fodda.apiKey');
            localStorage.removeItem('fodda.userContext');
            localStorage.removeItem('fodda.accountContext');
            sessionStorage.clear();
          }}
        />
      )}

      {/* ─── Main Content Area ─── */}
      <main className={`flex-1 flex flex-row h-full relative overflow-hidden ${isUnlocked ? 'ml-0 md:ml-64' : 'ml-0'}`}>
        {!isUnlocked ? (
          <AuthGate
            onAdminOpen={() => setIsAdminOpen(true)}
            initialReferralGraph={initialReferralGraph}
            initialExpertSlug={initialExpertSlug}
          />
        ) : (
          <>
            {renderActiveView()}
            {shouldShowWelcomePopup(currentUser) && currentUser && currentAccount && (
              <WelcomeContextPopup
                user={currentUser}
                account={currentAccount}
                onDismiss={() => {
                  // Force a re-render by updating user state slightly or just rely on local storage check on next render
                  setCurrentUser({ ...currentUser }); 
                }}
                onSave={async (userCtx, accountCtx) => {
                  if (userCtx) await handleUpdateUserContext(userCtx, true);
                  if (accountCtx) await handleUpdateAccountContext(accountCtx, true);
                  // Refresh user state to close popup
                  setCurrentUser({ ...currentUser, userContext: userCtx });
                  if (currentAccount) {
                     setCurrentAccount({ ...currentAccount, accountContext: accountCtx });
                  }
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
