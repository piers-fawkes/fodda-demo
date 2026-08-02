import React, { useState, useEffect } from 'react';
import { OrganizationProfile, useOrganization } from '@clerk/react';
import { User, Account } from '../../shared/types';
import { dataService } from '../../shared/dataService';
import { UsersList } from './UsersList';
import { AgentPaymentBanner } from './AgentPaymentBanner';
import { UsageMeter } from './UsageMeter';

interface AccountPortalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    account: Account;
    onUpdate?: (account: Account) => void;
    onViewPlans?: () => void;
    onViewApiDocs?: () => void;
    onSetupPayment?: () => void;
    initialTab?: 'overview' | 'team' | 'usage' | 'claude' | 'chatgpt' | 'notion' | 'copilot' | 'gemini' | 'mcp' | 'api' | 'graphs' | 'settings' | 'perplexity';
    inline?: boolean;
}

export const AccountPortal: React.FC<AccountPortalProps> = ({ isOpen, onClose, user, account, onUpdate, onViewPlans, onViewApiDocs, onSetupPayment, initialTab, inline }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'usage' | 'claude' | 'chatgpt' | 'notion' | 'copilot' | 'mcp' | 'api' | 'graphs' | 'settings' | 'perplexity'>(initialTab === 'gemini' ? 'mcp' : (initialTab === 'perplexity' ? 'perplexity' : (initialTab || 'overview')));
    const [accountUsers, setAccountUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [usersError, setUsersError] = useState<string | null>(null);

    // Usage State
    const [usageData, setUsageData] = useState<import('../../shared/types').UsageStats | null>(null);
    const [loadingUsage, setLoadingUsage] = useState(false);
    const [usageError, setUsageError] = useState<string | null>(null);

    // MCP Integration State
    const [mcpTools, setMcpTools] = useState<{ name: string; description: string; inputSchema?: any }[]>([]);
    const [mcpVersion, setMcpVersion] = useState<string>('—');
    const [mcpToolCount, setMcpToolCount] = useState<number>(0);
    const [loadingMcp, setLoadingMcp] = useState(false);
    const [mcpError, setMcpError] = useState<string | null>(null);
    const [showVertexConfig, setShowVertexConfig] = useState(false);
    const [configCopied, setConfigCopied] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [quickConnectTab, setQuickConnectTab] = useState<'claude' | 'enterprise' | 'cli' | 'vertex' | 'copilot'>(initialTab === 'gemini' ? 'vertex' : 'cli');
    const [showClaudeConfig, setShowClaudeConfig] = useState(false);
    const [claudeConfigCopied, setClaudeConfigCopied] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [copilotPath, setCopilotPath] = useState<'mcp-direct' | 'plugin'>('mcp-direct');
    const [claudeQuickTab, setClaudeQuickTab] = useState<'claude' | 'claude-code'>('claude');

    const [adminForm, setAdminForm] = useState({
        name: account.name,
        context: account.accountContext,
        authPolicy: account.authPolicy || 'RELAXED',
        isProfessionalServices: !!account.isProfessionalServices,
        autoProvisionToggle: !!account.autoProvisionToggle,
        autoProvisionDomain: account.autoProvisionDomain || ''
    });
    const [regeneratingKey, setRegeneratingKey] = useState(false);

    // Invite State
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('Employee'); // Default to Employee for easier onboarding
    const [sendingInvite, setSendingInvite] = useState(false);

    // My Graphs State
    const [myGraphs, setMyGraphs] = useState<any[]>([]);
    const [loadingGraphs, setLoadingGraphs] = useState(false);
    const [graphsError, setGraphsError] = useState<string | null>(null);
    const [registrationStep, setRegistrationStep] = useState<'idle' | 'source' | 'details' | 'validating' | 'result'>('idle');
    const [regSourceType, setRegSourceType] = useState<'sheets' | 'airtable' | 'mcp' | 'pdf'>('sheets');
    const [regSheetUrl, setRegSheetUrl] = useState('');
    const [regMeta, setRegMeta] = useState<any>(null);
    const [regLoading, setRegLoading] = useState(false);
    const [regResult, setRegResult] = useState<any>(null);
    const [refreshingSlug, setRefreshingSlug] = useState<string | null>(null);
    const SERVICE_ACCOUNT_EMAIL = 'fodda-graphs@gen-lang-client-0472572023.iam.gserviceaccount.com';

    // PDF Upload State
    const [pdfUrl, setPdfUrl] = useState('');
    const [headshotUrl, setHeadshotUrl] = useState('');
    const [extracting, setExtracting] = useState(false);
    const [distributionMode, setDistributionMode] = useState<'private' | 'network' | 'sell'>('private');
    const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
    const [validTopics, setValidTopics] = useState<string[]>([]);
    const [suggestedHeadshotUrl, setSuggestedHeadshotUrl] = useState('');
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [submittingExpertGraph, setSubmittingExpertGraph] = useState(false);

    // Clerk Org Custom UI state & hooks
    const [teamSubTab, setTeamSubTab] = useState<'members' | 'invitations'>('members');
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const { organization, membership, invitations, memberships, isLoaded: isOrgLoaded } = useOrganization({
        memberships: {
            infinite: true,
        },
        invitations: {
            infinite: true,
        }
    });

    const handleUpdateClerkRole = async (mem: any, newRole: string) => {
        try {
            await mem.update({ role: newRole === 'Admin' ? 'org:admin' : 'org:member' });
            alert("Role updated successfully.");
            memberships?.revalidate?.();
        } catch (e: any) {
            console.error(e);
            alert("Failed to update role: " + (e.message || "Unknown error"));
        }
    };

    const handleRemoveClerkMember = async (mem: any) => {
        if (!confirm(`Are you sure you want to remove this member from your team?`)) return;
        try {
            await mem.destroy();
            alert("Member removed successfully.");
            memberships?.revalidate?.();
        } catch (e: any) {
            console.error(e);
            alert("Failed to remove member: " + (e.message || "Unknown error"));
        }
    };

    const handleRevokeClerkInvitation = async (inv: any) => {
        if (!confirm(`Are you sure you want to revoke the invitation for ${inv.emailAddress}?`)) return;
        try {
            await inv.revoke();
            alert("Invitation revoked successfully.");
            invitations?.revalidate?.();
        } catch (e: any) {
            console.error(e);
            alert("Failed to revoke invitation: " + (e.message || "Unknown error"));
        }
    };

    useEffect(() => {
        if (isOpen && activeTab === 'team') {
            loadAccountUsers();
        }
        if (isOpen && activeTab === 'usage') {
            loadUsageData();
        }
        if (isOpen && (activeTab === 'mcp' || activeTab === 'claude' || activeTab === 'notion' || activeTab === 'copilot')) {
            loadMcpData();
        }
        if (isOpen && activeTab === 'graphs') {
            loadMyGraphs();
        }
    }, [isOpen, activeTab]);

    const loadAccountUsers = async () => {
        setLoadingUsers(true);
        setUsersError(null);
        try {
            const res = await dataService.getAccountUsers(account.id);
            if (res.ok && res.users) {
                let users = res.users;
                // Ensure the current user always appears in the team list
                const currentUserInList = users.some((u: any) => u.email === user.email || u.id === user.id);
                if (!currentUserInList) {
                    users = [{ ...user, role: user.role || 'Owner', emailConfirmed: true }, ...users];
                } else {
                    // Mark current user as confirmed (they're logged in right now)
                    users = users.map((u: any) =>
                        (u.email === user.email || u.id === user.id) ? { ...u, emailConfirmed: true } : u
                    );
                }
                setAccountUsers(users);
            } else {
                // Even on error, show the current user
                setAccountUsers([{ ...user, role: user.role || 'Owner', emailConfirmed: true } as any]);
                setUsersError(res.error || "Failed to load users");
            }
        } catch (e: any) {
            setAccountUsers([{ ...user, role: user.role || 'Owner', emailConfirmed: true } as any]);
            setUsersError(e.message);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleAccountUpdate = async () => {
        try {
            const res = await dataService.updateAccount(account.id, adminForm, user.role);
            if (res.ok) {
                alert("Account updated successfully!");
                onUpdate?.({ ...account, ...adminForm });
            } else {
                alert("Failed to update account: " + res.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error updating account");
        }
    };

    const handleRegenerateKey = async () => {
        if (!confirm("Rotating your API key will revoke your current key immediately. Active token connections (/c/:token) will update on next resolution. Are you sure?")) return;
        setRegeneratingKey(true);
        try {
            const data = await dataService.rotateApiKey(user.email);
            if (data.ok && data.apiKey) {
                if (data.mcpConn) {
                    setMcpConn(data.mcpConn);
                } else if (user?.email) {
                    dataService.getMcpConnection(user.email).then(conn => setMcpConn(conn)).catch(() => {});
                }
                navigator.clipboard.writeText(data.apiKey);
                alert(`New API Key Generated and copied to clipboard: \n\n${data.apiKey}`);
                onUpdate?.({ ...account, apiKey: data.apiKey });
            } else {
                alert("Failed to rotate key: " + (data.error || 'Unknown error'));
            }
        } catch (e: any) {
            console.error(e);
            alert("Error rotating API key: " + e.message);
        } finally {
            setRegeneratingKey(false);
        }
    };

    const [mcpConn, setMcpConn] = useState<any>(null);

    useEffect(() => {
        if (user?.email) {
            dataService.getMcpConnection(user.email).then(conn => setMcpConn(conn)).catch(() => {});
        }
    }, [user?.email]);

    const handleInviteUser = async () => {
        if (!inviteEmail) return;
        setSendingInvite(true);
        try {
            if (account.clerkOrgId && organization) {
                const emails = inviteEmail.split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
                for (const email of emails) {
                    await organization.inviteMember({
                        emailAddress: email,
                        role: inviteRole === 'Admin' ? 'org:admin' : 'org:member',
                    });
                }
                alert(`Successfully invited ${emails.length} team members via Clerk.`);
                setIsInviteModalOpen(false);
                setInviteEmail('');
                invitations?.revalidate?.();
                return;
            }

            const res = await fetch('/api/account/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: inviteEmail,
                    role: inviteRole,
                    accountId: account.id,
                    requesterEmail: user.email
                })
            });
            const data = await res.json();
            if (data.ok) {
                const { successful, failed } = data.results || { successful: [], failed: [] };
                let msg = `Successfully invited ${successful.length} team members.`;
                if (failed.length > 0) {
                    msg += `\nFailed to invite ${failed.length} members:\n` + failed.map((f: any) => `- ${f.email}: ${f.reason}`).join('\n');
                }
                alert(msg);
                if (successful.length > 0) {
                    setIsInviteModalOpen(false);
                    setInviteEmail('');
                    loadAccountUsers();
                }
            } else {
                alert("Failed to invite: " + data.error);
            }
        } catch (e: any) {
            console.error(e);
            alert("Error sending invite: " + (e.message || "Unknown error"));
        } finally {
            setSendingInvite(false);
        }
    };

    const loadUsageData = async () => {
        setLoadingUsage(true);
        setUsageError(null);
        try {
            // Build usage data from account fields — no separate API call needed
            const current = (account as any).currentQueryCount || (account as any).monthlyQueries || 0;
            const limit = (account as any).monthlyQueryLimit || 10;
            const now = new Date();
            const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

            setUsageData({
                totalQueries: current,
                monthlyQueries: current,
                queryLimit: limit,
                periodStart,
                periodEnd,
                dailyTrend: [],
                dailyBreakdown: [],
                monthlyTrend: [],
                byGraph: [],
                byUser: [
                    { userId: user.id, userName: user.name || '', userEmail: user.email, queryCount: current, percentage: 100 },
                ],
            } as any);
        } catch (e: any) {
            setUsageError(e.message);
        } finally {
            setLoadingUsage(false);
        }
    };

    const MCP_ENDPOINT = 'https://mcp.fodda.ai/mcp';
    const MCP_SSE_URL = 'https://mcp.fodda.ai/sse';
    const MCP_TOOLS_URL = 'https://mcp.fodda.ai/mcp/tools';

    const loadMcpData = async () => {
        if (!account?.apiKey) return;
        setLoadingMcp(true);
        setMcpError(null);
        try {
            // Use same-origin proxy to avoid browser CORS restrictions
            // Pass the API key to identify the tools available to this user
            const res = await fetch('/api/mcp/tools', {
                headers: { 'x-api-key': account.apiKey }
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server returned ${res.status}`);
            }
            const data = await res.json();
            const tools = data.tools || [];
            setMcpTools(tools);
            setMcpToolCount(data.count || tools.length);
            setMcpVersion(data.version || data.mcp_tool_version || '1.0.0');
        } catch (e: any) {
            setMcpError(
                'Could not load MCP tools. The Fodda MCP server may be temporarily unavailable. ' +
                'Please try again in a few moments. If the issue persists, check that the MCP service is deployed and running.'
            );
            console.error('[MCP Integration] Load failed:', e.message);
        } finally {
            setLoadingMcp(false);
        }
    };

    const loadMyGraphs = async () => {
        setLoadingGraphs(true);
        setGraphsError(null);
        try {
            const ownerParam = user.email ? `&ownerId=${encodeURIComponent(user.email)}` : '';
            // Fetch active + pending (existing)
            const res = await fetch(`/v1/graphs/registry?status=active${ownerParam}`);
            const resPending = user.email ? await fetch(`/v1/graphs/registry?status=pending${ownerParam}`) : null;
            const data = await res.json();
            const pendingData = resPending ? await resPending.json() : { graphs: [] };

            // Also fetch expert graph submissions (PDF pipeline)
            let expertSubmissions: any[] = [];
            if (user.email) {
                try {
                    const expertRes = await fetch(`/api/expert-graph/my-submissions?email=${encodeURIComponent(user.email)}`);
                    const expertData = await expertRes.json();
                    expertSubmissions = expertData.submissions || [];
                } catch (e) {
                    console.warn('[AccountPortal] Failed to load expert submissions:', e);
                }
            }

            const allGraphs = [...(data.graphs || []), ...(pendingData.graphs || []), ...expertSubmissions];
            // Deduplicate by slug
            const seen = new Set<string>();
            const deduped = allGraphs.filter(g => {
                const key = g.graphSlug || g.id;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            setMyGraphs(deduped);
        } catch (e: any) {
            setGraphsError(e.message);
        } finally {
            setLoadingGraphs(false);
        }
    };

    const handleFetchSheetMeta = async () => {
        if (!regSheetUrl) return;
        setRegLoading(true);
        try {
            const res = await fetch('/v1/graphs/sheet-meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheetUrl: regSheetUrl })
            });
            const data = await res.json();
            if (data.ok && data.meta) {
                setRegMeta({
                    graphName: data.meta.graphName || '',
                    description: data.meta.description || '',
                    creator: data.meta.creator || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                    organization: data.meta.organization || account.name || '',
                    sectors: data.meta.sectors ? data.meta.sectors.split(',').map((s: string) => s.trim()) : [],
                    industries: data.meta.industries ? data.meta.industries.split(',').map((s: string) => s.trim()) : [],
                    geography: data.meta.geography ? data.meta.geography.split(',').map((s: string) => s.trim()) : [],
                    updateFrequency: data.meta.updateFrequency || 'monthly',
                });
                setRegistrationStep('details');
            } else {
                alert(data.error || 'Could not read the Sheet. Make sure it is shared with the Fodda service account.');
            }
        } catch (e: any) {
            alert('Error reading sheet: ' + e.message);
        } finally {
            setRegLoading(false);
        }
    };

    const handleRegisterGraph = async () => {
        if (!regMeta) return;
        setRegistrationStep('validating');
        setRegLoading(true);
        try {
            const res = await fetch('/v1/graphs/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': account.apiKey || '',
                    'X-User-Id': user.email || '',
                },
                body: JSON.stringify({
                    sourceType: regSourceType,
                    sheetUrl: regSheetUrl,
                    graphName: regMeta.graphName,
                    description: regMeta.description,
                    creator: regMeta.creator,
                    organization: regMeta.organization,
                    sectors: regMeta.sectors.length > 0 ? regMeta.sectors : ['general'],
                    industries: regMeta.industries.length > 0 ? regMeta.industries : undefined,
                    geography: regMeta.geography.length > 0 ? regMeta.geography : undefined,
                    updateFrequency: regMeta.updateFrequency,
                })
            });
            const data = await res.json();
            setRegResult(data);
            setRegistrationStep('result');
            if (data.ok) {
                // Reload graphs list
                setTimeout(() => loadMyGraphs(), 3000);
            }
        } catch (e: any) {
            setRegResult({ ok: false, error: e.message });
            setRegistrationStep('result');
        } finally {
            setRegLoading(false);
        }
    };

    const handleRefreshGraph = async (slug: string) => {
        setRefreshingSlug(slug);
        try {
            const res = await fetch(`/v1/graphs/${slug}/refresh`, { method: 'POST' });
            const data = await res.json();
            if (data.ok) {
                loadMyGraphs();
            } else {
                alert('Refresh failed: ' + (data.errors?.join(', ') || data.error || 'Unknown error'));
            }
        } catch (e: any) {
            alert('Refresh error: ' + e.message);
        } finally {
            setRefreshingSlug(null);
        }
    };

    const generateVertexConfig = () => {
        const url = mcpConn?.mcpUrl || (mcpConn?.token ? `https://mcp.fodda.ai/c/${mcpConn.token}` : 'https://mcp.fodda.ai/c/:token');
        return JSON.stringify({
            tools: [{
                type: 'mcp',
                name: 'fodda',
                url
            }]
        }, null, 2);
    };

    const handleCopyConfig = () => {
        navigator.clipboard.writeText(generateVertexConfig());
        setConfigCopied(true);
        setTimeout(() => setConfigCopied(false), 2000);
    };

    const handleDownloadConfig = () => {
        const blob = new Blob([generateVertexConfig()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fodda-mcp-config.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const getClaudeConnectorUrl = () => {
        return mcpConn?.mcpUrl || (mcpConn?.token ? `https://mcp.fodda.ai/c/${mcpConn.token}` : 'https://mcp.fodda.ai/c/:token');
    };

    const getSseConnectorUrl = () => {
        return MCP_SSE_URL;
    };

    const handleCopyClaudeUrl = () => {
        navigator.clipboard.writeText(getClaudeConnectorUrl());
        setClaudeConfigCopied(true);
        setTimeout(() => setClaudeConfigCopied(false), 2000);
    };

    const handleDownloadClaudeConfig = () => {
        const config = JSON.stringify({
            name: 'Fodda',
            url: getClaudeConnectorUrl(),
            note: 'Paste the URL into Claude → Settings → Connectors → Add custom connector. Leave OAuth fields blank.'
        }, null, 2);
        const blob = new Blob([config], { type: 'application/json' });
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u;
        a.download = 'fodda-claude-connector.json';
        a.click();
        URL.revokeObjectURL(u);
    };

    const handleCopyField = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Delete User
    const handleDeleteUser = async (targetUserId: string, targetEmail: string) => {
        if (!confirm(`Are you sure you want to remove ${targetEmail} from your account?`)) return;
        try {
            const res = await dataService.deleteUser(targetUserId, user.email || '');
            if (res.ok) {
                setAccountUsers(prev => prev.filter(u => u.id !== targetUserId));
            } else {
                alert("Failed to delete user: " + res.error);
            }
        } catch (e: any) {
            alert("Error deleting user");
        }
    };

    // Edit user (email only for now) logic could be added here if needed, 
    // but typically modifying other users' email is sensitive.  
    // Dashboard had it, so let's skip for simplicity unless requested.

    useEffect(() => {
        if (inline && initialTab && initialTab !== activeTab) {
            // 'gemini' maps to 'mcp' with vertex quickConnect pre-selected
            const mapped = initialTab === 'gemini' ? 'mcp' : initialTab;
            if (mapped !== activeTab) setActiveTab(mapped);
        }
    }, [inline, initialTab]);

    const planNameForApiCheck = String((account as any).planName || account.planLevel || 'Free').toLowerCase();
    const isApiDisabled = planNameForApiCheck.includes('free') || planNameForApiCheck.includes('base');
    const isPaidPlan = !isApiDisabled && !planNameForApiCheck.includes('lapsed');

    if (!isOpen && !inline) return null;

    return (
        <div className={inline ? "flex flex-col flex-1 overflow-hidden" : "fixed inset-0 z-[200] flex items-center justify-center bg-ink/40 backdrop-blur-md"} onClick={inline ? undefined : onClose}>
            <div className={inline ? "flex flex-col flex-1 overflow-hidden" : "bg-white rounded-[32px] shadow-2xl w-full max-w-5xl p-0 m-4 animate-fade-in-up border border-line h-[85vh] flex flex-col overflow-hidden"} onClick={inline ? undefined : (e => e.stopPropagation())}>

                {/* Header — hidden in inline mode (outer sidebar handles nav) */}
                {!inline && (
                <div className="flex justify-between items-center px-10 py-8 border-b border-line bg-cream">
                    <div>
                        <h2 className="font-serif italic text-3xl text-ink tracking-tight">Account Intelligence</h2>
                        <p className="text-sm text-ink-3 mt-1.5 font-medium">{account.name} <span className="mx-2 text-line-strong">/</span> <span className="text-brand font-bold uppercase tracking-widest text-[10px]">{(account as any).planName || account.planLevel || 'Free'} Subscription</span></p>
                    </div>
                    <button onClick={onClose} className="p-3 text-ink-4 hover:text-ink hover:bg-paper rounded-2xl transition-all shadow-sm border border-transparent hover:border-line">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                )}

                {/* Main Content Area */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs — hidden in inline mode */}
                    {!inline && (
                    <div className="w-72 border-r border-line bg-paper p-8 space-y-1.5 overflow-y-auto custom-scrollbar">
                        <p className="eyebrow px-4 mb-4">Core Management</p>
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-ink text-white shadow-xl shadow-ink/20' : 'text-ink-4 hover:bg-cream hover:text-ink'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('team')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-between ${activeTab === 'team' ? 'bg-ink text-white shadow-xl shadow-ink/20' : isPaidPlan ? 'text-ink-4 hover:bg-cream hover:text-ink' : 'text-ink-5 cursor-default opacity-50'}`}
                        >
                            <span className="flex items-center gap-2">
                                {!isPaidPlan && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                                Team Members
                            </span>
                            {!isPaidPlan && <span className="text-[9px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full normal-case tracking-normal font-bold">Upgrade</span>}
                        </button>
                        <button
                            onClick={() => setActiveTab('usage')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'usage' ? 'bg-ink text-white shadow-xl shadow-ink/20' : 'text-ink-4 hover:bg-cream hover:text-ink'}`}
                        >
                            Usage
                        </button>
                        
                        <p className="eyebrow px-4 pt-8 mb-4">Connections</p>
                        <button
                            onClick={() => setActiveTab('claude')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'claude' ? 'bg-brand text-white shadow-xl shadow-brand/20' : 'text-ink-4 hover:bg-cream hover:text-ink'}`}
                        >
                            Claude Link
                        </button>
                        <button
                            onClick={() => setActiveTab('mcp')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'mcp' ? 'bg-brand text-white shadow-xl shadow-brand/20' : 'text-ink-4 hover:bg-cream hover:text-ink'}`}
                        >
                            MCP Dev Env
                        </button>
                        
                        <p className="eyebrow px-4 pt-8 mb-4">Architecture</p>
                        <button
                            onClick={() => setActiveTab('graphs')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'graphs' ? 'bg-green-600 text-white shadow-xl shadow-green-600/20' : 'text-ink-4 hover:bg-cream hover:text-ink'}`}
                        >
                            My Knowledge
                        </button>
                        <button
                            onClick={() => setActiveTab('api')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'api' ? 'bg-ink text-white shadow-xl shadow-ink/20' : 'text-ink-4 hover:bg-cream hover:text-ink'}`}
                        >
                            API Schema
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-ink text-white shadow-xl shadow-ink/20' : 'text-ink-4 hover:bg-cream hover:text-ink'}`}
                        >
                            Settings
                        </button>
                    </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-white">
                        {activeTab === 'overview' && (
                            <div className="space-y-8 max-w-4xl">

                                <AgentPaymentBanner hasPaymentMethod={!!(account as any).hasPaymentMethod} onSetupStripe={() => onSetupPayment?.()} userEmail={user?.email} accountId={(account as any)?.id} />

                                {/* Account Health */}
                                <section className="p-8 bg-white border border-line rounded-3xl shadow-sm space-y-6">
                                    <h3 className="eyebrow mb-2">Account Health</h3>
                                    <div className="flex items-center justify-between pb-6 border-b border-line">
                                        <div>
                                            <p className="font-serif italic text-3xl text-ink leading-tight">{account.name || 'Anonymous Account'}</p>
                                            {user.company && <p className="text-sm font-medium text-ink-3 mt-1">{user.company}</p>}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-black text-ink-3 uppercase tracking-widest block mb-1">Global ID</span>
                                            <span className="text-xs text-ink-2 font-mono font-bold tracking-tight">{account.id}</span>
                                        </div>
                                    </div>
                                    <UsageMeter user={user} account={account} />
                                </section>

                                {/* Plan & Tier */}
                                <section className="p-8 bg-cream border border-line rounded-3xl shadow-sm">
                                    <h3 className="eyebrow mb-4">Plan Level</h3>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="font-serif italic text-3xl text-ink leading-tight">{(account as any).planName || account.planLevel || 'Pro'}</p>
                                            <div className="flex items-center gap-4 mt-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-ink-4 uppercase tracking-widest mb-1">Renewal Date</span>
                                                    <span className="text-xs text-ink-2 font-bold tracking-tight">
                                                        {(account as any).renewalDate || (account as any).subscriptionRenewalDate ? new Date((account as any).renewalDate || (account as any).subscriptionRenewalDate).toLocaleDateString() : 'Auto-renews monthly'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        {onViewPlans && (
                                            <button onClick={onViewPlans} className="px-5 py-2.5 bg-ink text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-ink-2 transition-all shadow-lg shadow-ink/20">
                                                Modify Plan →
                                            </button>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'team' && (
                            <div className="space-y-8">
                                {!isPaidPlan ? (
                                    /* Upgrade prompt for non-paid users */
                                    <section className="bg-paper border border-line rounded-3xl p-12 shadow-sm text-center">
                                        <div className="mx-auto w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
                                            <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                        </div>
                                        <h3 className="font-serif italic text-2xl text-ink mb-3">Team Management</h3>
                                        <p className="text-sm text-ink-3 max-w-md mx-auto mb-8 leading-relaxed">
                                            Invite colleagues, manage roles, and collaborate across your organization.
                                            Team features are available on paid plans.
                                        </p>
                                        {onViewPlans && (
                                            <button onClick={onViewPlans} className="px-6 py-3 bg-ink text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-ink-2 transition-all shadow-lg shadow-ink/20">
                                                View Plans →
                                            </button>
                                        )}
                                    </section>
                                                                ) : (
                                    /* Paid Plan Team Management */
                                    <>
                                        {/* Team Stats — Fodda-specific data Clerk doesn't manage */}
                                        <section className="bg-paper border border-line rounded-3xl p-8 shadow-sm">
                                            <h3 className="eyebrow mb-6">Team Overview</h3>
                                            <div className="grid grid-cols-3 gap-6">
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest">Queries Used</p>
                                                    <p className="font-serif italic text-2xl text-ink">{account.currentQueryCount || 0}</p>
                                                    <p className="text-[9px] font-bold text-ink-4">/ {account.monthlyQueryLimit || '∞'} monthly</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest">Plan</p>
                                                    <p className="font-serif italic text-2xl text-ink">{account.planName || 'Free'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest">API Key</p>
                                                    <p className="font-mono font-bold text-sm text-ink tracking-tight truncate max-w-[180px]" title={account.apiKey}>{account.apiKey ? `${account.apiKey.slice(0, 12)}…` : '—'}</p>
                                                    <button
                                                        onClick={() => { navigator.clipboard.writeText(account.apiKey || ''); setCopiedField('team-api-key'); setTimeout(() => setCopiedField(null), 2000); }}
                                                        className="text-[9px] font-bold text-brand hover:underline"
                                                    >
                                                        {copiedField === 'team-api-key' ? '✓ Copied' : 'Copy'}
                                                    </button>
                                                </div>
                                            </div>
                                        </section>

                                        <div className="flex justify-end items-center bg-cream/30 p-6 rounded-3xl border border-line border-dashed">
                                            <button
                                                onClick={() => setIsInviteModalOpen(true)}
                                                className="px-6 py-3 bg-brand text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-brand-dark transition-all shadow-lg shadow-brand/20"
                                            >
                                                Invite Team Members
                                            </button>
                                        </div>

                                        <div className="flex flex-col gap-3 bg-paper p-6 rounded-2xl border border-line mt-2">
                                            <div className="flex items-start gap-4">
                                                <button
                                                    onClick={() => setAdminForm(prev => ({ ...prev, autoProvisionToggle: !prev.autoProvisionToggle }))}
                                                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 mt-0.5 ${adminForm.autoProvisionToggle ? 'bg-brand' : 'bg-ink-4'}`}
                                                    role="switch"
                                                    aria-checked={adminForm.autoProvisionToggle}
                                                >
                                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${adminForm.autoProvisionToggle ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                                <div>
                                                    <span className="text-sm font-bold text-ink block mb-1">Auto-Provision New Team Members</span>
                                                    <span className="text-xs text-ink-3">Automatically add new users to your account when they connect via API or MCP, provided their email matches your authorized domain.</span>
                                                </div>
                                            </div>
                                            {adminForm.autoProvisionToggle && (
                                                <div className="mt-2 pl-16">
                                                    <label className="text-[10px] font-bold text-ink-3 uppercase tracking-widest px-1 block mb-2">Authorized Domain</label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 font-bold">@</span>
                                                        <input 
                                                            type="text" 
                                                            value={adminForm.autoProvisionDomain}
                                                            onChange={e => setAdminForm(prev => ({ ...prev, autoProvisionDomain: e.target.value.replace('@', '').toLowerCase().trim() }))}
                                                            placeholder="company.com"
                                                            className="w-full pl-9 pr-4 py-3 bg-white border border-line rounded-xl text-sm focus:outline-none focus:border-brand shadow-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {account.clerkOrgId ? (
                                            /* Clerk-managed custom UI */
                                            (() => {
                                                const filteredMemberships = memberships?.data?.filter((mem: any) => {
                                                    const search = memberSearchQuery.toLowerCase().trim();
                                                    if (!search) return true;
                                                    const email = mem.publicUserData.emailAddress?.toLowerCase() || '';
                                                    const name = `${mem.publicUserData.firstName || ''} ${mem.publicUserData.lastName || ''}`.toLowerCase();
                                                    return email.includes(search) || name.includes(search);
                                                }) || [];

                                                const filteredInvitations = invitations?.data?.filter((inv: any) => {
                                                    const search = memberSearchQuery.toLowerCase().trim();
                                                    if (!search) return true;
                                                    const email = inv.emailAddress?.toLowerCase() || '';
                                                    return email.includes(search);
                                                }) || [];

                                                return (
                                                    <div className="space-y-6 mt-4">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
                                                            <div className="flex gap-1.5 bg-cream p-1 rounded-xl border border-line shrink-0">
                                                                <button
                                                                    onClick={() => setTeamSubTab('members')}
                                                                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                                                                        teamSubTab === 'members'
                                                                            ? 'bg-ink text-white shadow-sm'
                                                                            : 'text-ink-3 hover:text-ink hover:bg-cream-dark'
                                                                    }`}
                                                                >
                                                                    Members ({memberships?.data?.length || 0})
                                                                </button>
                                                                <button
                                                                    onClick={() => setTeamSubTab('invitations')}
                                                                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                                                                        teamSubTab === 'invitations'
                                                                            ? 'bg-ink text-white shadow-sm'
                                                                            : 'text-ink-3 hover:text-ink hover:bg-cream-dark'
                                                                    }`}
                                                                >
                                                                    Invitations ({invitations?.data?.length || 0})
                                                                </button>
                                                            </div>

                                                            <div className="relative flex-grow max-w-md">
                                                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-4 text-xs font-bold">🔍</span>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search by name or email..."
                                                                    value={memberSearchQuery}
                                                                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                                                                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-line rounded-xl text-xs focus:outline-none focus:border-brand shadow-sm placeholder:text-ink-4 font-medium"
                                                                />
                                                            </div>
                                                        </div>

                                                        {teamSubTab === 'members' ? (
                                                            memberships?.isLoading ? (
                                                                <div className="flex justify-center py-10">
                                                                    <div className="w-6 h-6 border-2 border-line border-t-brand rounded-full animate-spin"></div>
                                                                </div>
                                                            ) : filteredMemberships.length === 0 ? (
                                                                <div className="text-ink-4 text-[10px] font-bold uppercase tracking-widest p-8 text-center border border-line rounded-2xl border-dashed bg-cream/10">
                                                                    No matching members found.
                                                                </div>
                                                            ) : (
                                                                <div className="overflow-hidden border border-line rounded-2xl shadow-sm bg-white">
                                                                    <table className="min-w-full text-left">
                                                                        <thead className="bg-cream">
                                                                            <tr>
                                                                                <th className="px-6 py-4 eyebrow">User</th>
                                                                                <th className="px-6 py-4 eyebrow">Role</th>
                                                                                <th className="px-6 py-4 eyebrow text-right">Actions</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-line">
                                                                            {filteredMemberships.map((mem: any) => {
                                                                                const u = mem.publicUserData;
                                                                                const isSelf = u.userId === user.clerkUserId || u.identifier === user.email;
                                                                                return (
                                                                                    <tr key={mem.id} className="hover:bg-cream/20 transition-colors group">
                                                                                        <td className="px-6 py-4">
                                                                                            <div className="flex items-center gap-3">
                                                                                                <div className="w-9 h-9 rounded-full bg-brand-soft border border-brand/20 flex items-center justify-center text-xs font-black text-brand shrink-0 shadow-sm uppercase relative overflow-hidden">
                                                                                                    {u.imageUrl ? (
                                                                                                        <img src={u.imageUrl} alt="" className="w-full h-full rounded-full object-cover" />
                                                                                                    ) : null}
                                                                                                    {!u.imageUrl && (
                                                                                                        <span>{(u.firstName?.[0] || '') + (u.lastName?.[0] || '') || u.identifier?.[0] || '?'}</span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="text-sm font-bold text-ink text-[13px]">
                                                                                                        {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Anonymous User'}
                                                                                                        {isSelf && <span className="ml-2 text-[8px] bg-brand-soft text-brand px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">You</span>}
                                                                                                    </span>
                                                                                                    <span className="text-[10px] text-ink-4 font-mono mt-0.5">{u.identifier}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-6 py-4">
                                                                                            {isSelf ? (
                                                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-brand-soft text-brand border border-brand/20">
                                                                                                    {mem.role === 'org:admin' ? 'Owner' : 'Member'}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <select
                                                                                                    value={mem.role === 'org:admin' ? 'Admin' : 'Member'}
                                                                                                    onChange={(e) => handleUpdateClerkRole(mem, e.target.value)}
                                                                                                    className="bg-white border border-line rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-all focus:outline-none focus:border-brand shadow-sm text-ink-3"
                                                                                                >
                                                                                                    <option value="Admin">Owner</option>
                                                                                                    <option value="Member">Member</option>
                                                                                                </select>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-6 py-4 text-right">
                                                                                            {!isSelf && (
                                                                                                <button
                                                                                                    onClick={() => handleRemoveClerkMember(mem)}
                                                                                                    className="p-2 text-ink-4 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-red-200 mr-2"
                                                                                                    title="Remove Member"
                                                                                                >
                                                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                                                </button>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )
                                                        ) : (
                                                            invitations?.isLoading ? (
                                                                <div className="flex justify-center py-10">
                                                                    <div className="w-6 h-6 border-2 border-line border-t-brand rounded-full animate-spin"></div>
                                                                </div>
                                                            ) : filteredInvitations.length === 0 ? (
                                                                <div className="text-ink-4 text-[10px] font-bold uppercase tracking-widest p-8 text-center border border-line rounded-2xl border-dashed bg-cream/10">
                                                                    No pending invitations found.
                                                                </div>
                                                            ) : (
                                                                <div className="overflow-hidden border border-line rounded-2xl shadow-sm bg-white">
                                                                    <table className="min-w-full text-left">
                                                                        <thead className="bg-cream">
                                                                            <tr>
                                                                                <th className="px-6 py-4 eyebrow">Invitee</th>
                                                                                <th className="px-6 py-4 eyebrow">Role</th>
                                                                                <th className="px-6 py-4 eyebrow">Status</th>
                                                                                <th className="px-6 py-4 eyebrow text-right">Actions</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-line">
                                                                            {filteredInvitations.map((inv: any) => {
                                                                                return (
                                                                                    <tr key={inv.id} className="hover:bg-cream/20 transition-colors group">
                                                                                        <td className="px-6 py-4">
                                                                                            <span className="text-sm font-bold text-ink">{inv.emailAddress}</span>
                                                                                        </td>
                                                                                        <td className="px-6 py-4">
                                                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-paper text-ink-3 border border-line">
                                                                                                {inv.role === 'org:admin' ? 'Owner' : 'Member'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="px-6 py-4">
                                                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700">
                                                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                                                Pending
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="px-6 py-4 text-right">
                                                                                            <button
                                                                                                onClick={() => handleRevokeClerkInvitation(inv)}
                                                                                                className="p-2 text-ink-4 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-red-200 mr-2"
                                                                                                title="Revoke Invitation"
                                                                                            >
                                                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                                            </button>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                            /* Legacy Database-managed UI */
                                            <UsersList
                                                users={accountUsers}
                                                loading={loadingUsers}
                                                error={usersError}
                                                onDelete={handleDeleteUser}
                                                onRoleChange={async (targetUserId, newRole) => {
                                                    const res = await dataService.updateUserRole(targetUserId, newRole, user.email || '');
                                                    if (res.ok) {
                                                        setAccountUsers(prev => prev.map(u =>
                                                            u.id === targetUserId ? { ...u, role: newRole } : u
                                                        ));
                                                    } else {
                                                        alert('Failed to update role: ' + (res.error || 'Unknown error'));
                                                    }
                                                }}
                                                currentUserId={user.id}
                                                currentUserRole={user.role}
                                                signupCode={account.signupCode}
                                                accountApiKey={account.apiKey}
                                                accountMcpUrl={mcpConn?.mcpUrl || `${MCP_ENDPOINT}?api_key=${account.apiKey || 'YOUR_KEY'}&user_id=${encodeURIComponent(user.email || 'YOUR_EMAIL')}`}
                                                accountMonthlyQueryLimit={account.monthlyQueryLimit}
                                                accountCurrentQueryCount={account.currentQueryCount}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'usage' && (
                            <div className="space-y-10 max-w-5xl">
                                {loadingUsage ? (
                                    <div className="flex items-center justify-center py-20">
                                        <div className="animate-spin w-10 h-10 border-2 border-line border-t-brand rounded-full"></div>
                                    </div>
                                ) : usageError ? (
                                    <div className="p-8 bg-red-50 border border-red-100 rounded-3xl text-red-800 text-sm font-bold shadow-sm">
                                        Unable to load usage data: {usageError}
                                    </div>
                                ) : usageData ? (
                                    <>
                                        {/* Summary Stats */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-paper border border-line p-8 rounded-3xl shadow-sm">
                                                <p className="eyebrow mb-2">Total Usage</p>
                                                <p className="font-serif italic text-4xl text-ink leading-tight">{usageData.totalQueries.toLocaleString()}</p>
                                                <p className="text-[10px] font-black text-ink-4 uppercase tracking-widest mt-2">Historical Cumulative API Calls</p>
                                            </div>
                                            <div className="bg-paper border border-line p-8 rounded-3xl shadow-sm border-dashed">
                                                <p className="eyebrow mb-2">Current Month</p>
                                                <p className="font-serif italic text-4xl text-ink leading-tight">{usageData.monthlyQueries.toLocaleString()}</p>
                                                <p className="text-[10px] font-black text-brand uppercase tracking-widest mt-2">{new Date(usageData.periodStart).toLocaleDateString(undefined, {month: 'short', year: 'numeric'})}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Calls Per Graph */}
                                            <div className="bg-white border border-line p-8 rounded-3xl shadow-sm">
                                                <h3 className="eyebrow mb-6">Distribution by Knowledge Domain</h3>
                                                <div className="space-y-6">
                                                    {usageData.byGraph.map((graph: any) => (
                                                        <div key={graph.graphId} className="space-y-2">
                                                            <div className="flex justify-between items-end">
                                                                <span className="text-xs font-bold text-ink uppercase tracking-wider">{graph.graphName}</span>
                                                                <span className="text-[10px] font-mono font-bold text-ink-3 tracking-tighter">{graph.queryCount.toLocaleString()} {graph.queryCount === 1 ? 'UNIT' : 'queries'}</span>
                                                            </div>
                                                            <div className="h-2 bg-cream rounded-full border border-line/50 overflow-hidden shadow-inner">
                                                                <div
                                                                    className="h-full bg-brand rounded-full transition-all duration-1000 ease-out"
                                                                    style={{ width: `${graph.percentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Daily Query Volume */}
                                            <div className="bg-white border border-line p-8 rounded-3xl shadow-sm">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h3 className="eyebrow">Daily Query Volume</h3>
                                                    <span className="text-[10px] font-bold text-ink-3 bg-cream px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                        Last 30 Days
                                                    </span>
                                                </div>
                                                
                                                <div className="relative h-48 px-2 mt-4">
                                                    {/* Y-Axis Gridlines */}
                                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                                        <div className="border-b border-line/30 w-full h-0"></div>
                                                        <div className="border-b border-line/30 w-full h-0"></div>
                                                        <div className="border-b border-line/30 w-full h-0"></div>
                                                        <div className="border-b border-line/30 w-full h-0"></div>
                                                        <div className="border-b border-line w-full h-0"></div>
                                                    </div>
                                                    
                                                    {/* Bar Chart Container */}
                                                    <div className="absolute inset-x-2 bottom-0 top-0 flex items-end space-x-1.5 z-10">
                                                        {usageData.dailyTrend.map((day: any, i: number) => {
                                                            const maxCount = Math.max(...usageData.dailyTrend.map((d: any) => d.queryCount));
                                                            const height = maxCount > 0 ? (day.queryCount / maxCount) * 100 : 0;
                                                            return (
                                                                <div
                                                                    key={day.date}
                                                                    className="flex-1 bg-brand/15 hover:bg-brand border-t-2 border-transparent hover:border-brand-dark rounded-t transition-all duration-200 cursor-pointer group relative"
                                                                    style={{ height: `${Math.max(4, height)}%` }}
                                                                    title={`${day.date}: ${day.queryCount} queries`}
                                                                >
                                                                    {/* Enhanced Tooltip */}
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3.5 px-3 py-2 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl z-20 whitespace-nowrap border border-ink-3">
                                                                        <span className="text-brand-soft block text-[8px] tracking-widest mb-0.5">
                                                                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                                        </span>
                                                                        <span className="text-white text-xs">{day.queryCount} Queries</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="flex justify-between mt-6 text-[9px] font-black text-ink-4 uppercase tracking-[0.2em] border-t border-line pt-4">
                                                    <span>{new Date(usageData.periodStart || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                    <span>Rolling 30-Day Window</span>
                                                    <span>{new Date(usageData.periodEnd || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                                            {/* Top Users */}
                                            <div className="bg-white border border-line p-8 rounded-3xl shadow-sm">
                                                <h3 className="eyebrow mb-6">Top Users (Last 30 Days)</h3>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                        <thead className="border-b border-line">
                                                            <tr>
                                                                <th className="text-left py-2 px-3 text-[9px] font-black text-ink-4 uppercase tracking-[0.2em]">User</th>
                                                                <th className="text-right py-2 px-3 text-[9px] font-black text-ink-4 uppercase tracking-[0.2em]">Queries</th>
                                                                <th className="text-right py-2 px-3 text-[9px] font-black text-ink-4 uppercase tracking-[0.2em]">% Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-line/50">
                                                            {usageData.byUser.slice(0, 10).map((user: any) => (
                                                                <tr key={user.userId} className="hover:bg-cream transition-colors">
                                                                    <td className="py-3 px-3">
                                                                        <div>
                                                                            <p className="text-sm font-bold text-ink">{user.userName || user.userEmail}</p>
                                                                            {user.userName && <p className="text-xs text-ink-4">{user.userEmail}</p>}
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 px-3 text-right text-sm font-bold text-ink-2">{user.queryCount}</td>
                                                                    <td className="py-3 px-3 text-right text-sm text-ink-4">{user.percentage.toFixed(1)}%</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Monthly Trend */}
                                            <div className="bg-white border border-line p-8 rounded-3xl shadow-sm">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h3 className="eyebrow">Monthly Trend</h3>
                                                    <span className="text-[10px] font-bold text-ink-3 bg-cream px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                        6-Month History
                                                    </span>
                                                </div>
                                                
                                                <div className="relative h-48 px-4 mt-4">
                                                    {/* Y-Axis Gridlines */}
                                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                                        <div className="border-b border-line/30 w-full h-0"></div>
                                                        <div className="border-b border-line/30 w-full h-0"></div>
                                                        <div className="border-b border-line/30 w-full h-0"></div>
                                                        <div className="border-b border-line/30 w-full h-0"></div>
                                                        <div className="border-b border-line w-full h-0"></div>
                                                    </div>
                                                    
                                                    {/* Bar Chart Container */}
                                                    <div className="absolute inset-x-4 bottom-0 top-0 flex items-end justify-around z-10">
                                                        {usageData.monthlyTrend?.map((monthData: any) => {
                                                            const maxCount = Math.max(...usageData.monthlyTrend.map((m: any) => m.queryCount));
                                                            const height = maxCount > 0 ? (monthData.queryCount / maxCount) * 100 : 0;
                                                            return (
                                                                <div
                                                                    key={monthData.month}
                                                                    className="w-12 bg-brand/15 hover:bg-brand border-t-2 border-transparent hover:border-brand-dark rounded-t transition-all duration-200 cursor-pointer group relative flex flex-col justify-end"
                                                                    style={{ height: `${Math.max(6, height)}%` }}
                                                                >
                                                                    {/* Enhanced Tooltip */}
                                                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3.5 px-3 py-2 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl z-20 whitespace-nowrap border border-ink-3">
                                                                        <span className="text-brand-soft block text-[8px] tracking-widest mb-0.5">
                                                                            {monthData.month}
                                                                        </span>
                                                                        <span className="text-white text-xs">{monthData.queryCount} Queries</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="flex justify-between mt-6 text-[9px] font-black text-ink-4 uppercase tracking-[0.2em] border-t border-line pt-4">
                                                    <span>{usageData.monthlyTrend?.[0]?.month}</span>
                                                    <span>Historical Trend</span>
                                                    <span>{usageData.monthlyTrend?.[usageData.monthlyTrend.length - 1]?.month}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-12 text-center text-zinc-500 italic">
                                        No usage data available yet.
                                    </div>
                                )}
                            </div>
                        )}



                        {activeTab === 'claude' && (
                            <div className="space-y-10 max-w-3xl">

                                <AgentPaymentBanner hasPaymentMethod={!!(account as any).hasPaymentMethod} onSetupStripe={() => onSetupPayment?.()} userEmail={user?.email} accountId={(account as any)?.id} />

                                {/* Quick Connect Widget */}
                                <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
                                    <h3 className="eyebrow">Quick Connect</h3>
                                    {/* Tab Pills */}
                                    <div className="flex gap-1 bg-cream border border-line p-1 rounded-xl max-w-md">
                                        {([
                                            { key: 'claude' as const, label: 'Claude' },
                                            { key: 'claude-code' as const, label: 'Claude Code' }
                                        ]).map(tab => (
                                            <button
                                                key={tab.key}
                                                onClick={() => setClaudeQuickTab(tab.key)}
                                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${claudeQuickTab === tab.key
                                                    ? 'bg-[#DE7356]/15 text-[#DE7356] border border-[#DE7356]/30 shadow-sm'
                                                    : 'text-ink-3 hover:text-ink hover:bg-cream-dark border border-transparent'
                                                }`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Claude — deep link */}
                                    {claudeQuickTab === 'claude' && (
                                        <div className="space-y-3 animate-fade-in-up">
                                            <p className="text-sm text-ink-2">One click to add Fodda to Claude with your API key pre-filled:</p>
                                            <a
                                                href={`https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(mcpConn?.mcpUrl || (mcpConn?.token ? `https://mcp.fodda.ai/c/${mcpConn.token}` : 'https://mcp.fodda.ai/c/:token'))}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full px-4 py-3 bg-[#DE7356] hover:bg-[#c9624a] text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#DE7356]/20"
                                            >
                                                <img src="https://ucarecdn.com/c70edb86-e790-4be0-aa73-5f598137fba5/anthropicstar.jpeg" alt="" className="w-4 h-4 rounded-sm" />
                                                Add Fodda to Claude
                                                <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            </a>
                                            <p className="text-[10px] text-ink-3">Opens Claude → Settings → Connectors with your MCP URL pre-populated. Leave OAuth fields blank.</p>
                                        </div>
                                    )}

                                    {/* Claude Code CLI */}
                                    {claudeQuickTab === 'claude-code' && (
                                        <div className="space-y-3 animate-fade-in-up">
                                            <p className="text-sm text-ink-2">Run this in your terminal to add Fodda to Claude Code:</p>
                                            <div className="relative group">
                                                <pre className="p-4 bg-ink rounded-xl text-[12px] font-mono text-[#DE7356] border border-ink-2 overflow-x-auto whitespace-pre-wrap leading-relaxed">{`claude mcp add --transport http fodda "${mcpConn?.mcpUrl || (mcpConn?.token ? `https://mcp.fodda.ai/c/${mcpConn.token}` : 'https://mcp.fodda.ai/c/:token')}"`}</pre>
                                                <button
                                                    onClick={() => handleCopyField(`claude mcp add --transport http fodda "${mcpConn?.mcpUrl || (mcpConn?.token ? `https://mcp.fodda.ai/c/${mcpConn.token}` : 'https://mcp.fodda.ai/c/:token')}"`, 'claude-code-cmd')}
                                                    className={`absolute top-3 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'claude-code-cmd' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`}
                                                    title="Copy command"
                                                >
                                                    {copiedField === 'claude-code-cmd' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-ink-3">Uses Streamable HTTP transport — recommended for Claude Code (MCP 1.x)</p>
                                        </div>
                                    )}
                                </section>

                                {/* Claude Tag — Slack Integration */}
                                <section className="p-8 bg-gradient-to-br from-purple-50/50 to-paper border border-purple-100/60 rounded-3xl space-y-5 shadow-sm">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 shadow-sm">
                                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-bold text-ink mb-1">Claude Tag — Slack Integration</h3>
                                            <p className="text-xs text-ink-3 leading-relaxed">
                                                Enable <span className="font-bold text-purple-700">Claude Tag</span> in your Slack workspace to give your entire team access to Fodda intelligence directly in conversations. Tag <code className="text-[10px] bg-purple-100/60 text-purple-700 px-1.5 py-0.5 rounded font-mono">@Claude</code> in any channel to query your Fodda graphs, schedule research, and surface insights — no dashboard visit required.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <a
                                            href="https://docs.fodda.ai/integrations/claude-tag"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-purple-600/20"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                            Setup Guide
                                        </a>
                                        <a
                                            href="https://www.anthropic.com/news/claude-tag"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-purple-200 text-purple-700 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-purple-50 transition-all"
                                        >
                                            Learn More
                                            <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        </a>
                                    </div>
                                    <div className="p-3 bg-purple-50/60 border border-purple-100/50 rounded-xl">
                                        <p className="text-[10px] text-purple-600/80 leading-relaxed">
                                            <span className="font-bold">Requires:</span> Claude for Work (Team or Enterprise) with MCP connectors enabled by your workspace admin. Your Fodda API key is used for all queries — credits meter against your account.
                                        </p>
                                    </div>
                                </section>

                                {/* Claude Pro/Max/Team Setup */}
                                <section className="p-8 bg-paper border border-line rounded-3xl space-y-6 shadow-sm">
                                    <h3 className="eyebrow mb-2">Team Enrollment — Claude Web &amp; Notion</h3>
                                    <p className="text-sm text-ink-3 mb-4">Use this method for browser-based tools like <span className="font-bold">Claude.ai</span> or <span className="font-bold">Notion AI</span>. For Claude Desktop, Cursor, or CLI tools, use the <span className="text-brand font-bold cursor-pointer hover:underline" onClick={() => setActiveTab('mcp')}>SSE transport</span> instead.</p>
                                    <ol className="space-y-4">
                                        <li className="flex gap-4">
                                            <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">1</span>
                                            <span className="text-sm font-medium text-ink-2">Acquire your unique connector hash from the reference field below.</span>
                                        </li>
                                        <li className="flex gap-4">
                                            <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">2</span>
                                            <span className="text-sm font-medium text-ink-2">Open <a href="https://claude.ai/settings/connectors?modal=add-custom-connector" target="_blank" rel="noopener noreferrer" className="text-brand font-bold hover:underline">Claude Settings → Add Custom Connector</a> (this link opens the connector dialog directly).</span>
                                        </li>
                                        <li className="flex gap-4 items-start">
                                            <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">3</span>
                                            <div className="flex-1 space-y-3">
                                                <span className="text-sm font-medium text-ink-2">Input the following Secure Protocol URL:</span>
                                                <div className="relative group flex-1">
                                                    <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-purple-300 border border-ink-2 break-all pr-12">{getClaudeConnectorUrl()}</code>
                                                    <button onClick={() => handleCopyField(getClaudeConnectorUrl(), 'claude-tab-url')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'claude-tab-url' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy URL">
                                                        {copiedField === 'claude-tab-url' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                        <li className="flex gap-4">
                                            <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">4</span>
                                            <span className="text-sm font-medium text-ink-2">Ensure all <span className="text-ink font-bold">OAuth fields</span> are left intentionally blank.</span>
                                        </li>
                                        <li className="flex gap-4">
                                            <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">5</span>
                                            <span className="text-sm font-medium text-ink-2">Finalize by clicking "Add" — Fodda knowledge is now accessible within the Claude interface.</span>
                                        </li>
                                    </ol>
                                    <div className="p-4 bg-cream/40 border border-line border-dashed rounded-2xl">
                                        <p className="text-xs text-ink-3 italic font-medium leading-relaxed">"Try prompting Claude: 'Analyze recent market signals from my Fodda intelligence layer.'"</p>
                                    </div>
                                </section>

                                {/* Enterprise (Admin) */}
                                <section className="p-8 bg-white border border-line rounded-3xl space-y-6 shadow-sm">
                                    <h3 className="eyebrow mb-2">Corporate Registry — Admin Control</h3>
                                    <p className="text-sm font-medium text-ink-3">Workspace administrators can register the Fodda knowledge layer for the entire organization via <a href="https://claude.ai/admin-settings/connectors" target="_blank" rel="noopener noreferrer" className="text-brand font-bold hover:underline">Admin Settings → Connectors</a>.</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-ink border border-ink-2 rounded-2xl relative group">
                                            <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest mb-1">Global Endpoint</p>
                                            <p className="text-xs font-mono font-bold text-purple-300 break-all pr-8">{MCP_ENDPOINT}?api_key=ORG_API_KEY&user_id=ADMIN_EMAIL</p>
                                            <button onClick={() => handleCopyField(`${MCP_ENDPOINT}?api_key=ORG_API_KEY&user_id=ADMIN_EMAIL`, 'claude-corp-url')} className={`absolute top-3.5 right-3.5 p-1 rounded-md transition-all hover:text-white ${copiedField === 'claude-corp-url' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy URL">
                                                {copiedField === 'claude-corp-url' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                            </button>
                                        </div>
                                        <div className="p-4 bg-ink border border-ink-2 rounded-2xl">
                                            <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest mb-1">Auth Configuration</p>
                                            <p className="text-xs font-bold text-amber-300 font-mono">Stateless (None)</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <span className="text-brand shrink-0 text-sm mt-0.5">✓</span>
                                            <span className="text-xs font-bold text-ink-2 uppercase tracking-wide">Enterprise Governance Control</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="text-brand shrink-0 text-sm mt-0.5">✓</span>
                                            <span className="text-xs font-bold text-ink-2 uppercase tracking-wide">Autonomous Agent Discovery</span>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="text-brand shrink-0 text-sm mt-0.5">✓</span>
                                            <span className="text-xs font-bold text-ink-2 uppercase tracking-wide">Zero-Latency Deployment</span>
                                        </div>
                                    </div>
                                </section>

                                {/* API Key */}
                                <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
                                    <h3 className="eyebrow">Your API Key</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1 group">
                                            <code className="block p-3.5 bg-ink rounded-xl text-sm font-mono border border-ink-2 text-amber-300 break-all pr-24">
                                                {account.apiKey
                                                    ? (showApiKey ? account.apiKey : account.apiKey.slice(0, 8) + '••••••••••••')
                                                    : 'No API key generated yet'}
                                            </code>
                                            <div className="absolute top-2.5 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {account.apiKey && (
                                                    <button onClick={() => setShowApiKey(!showApiKey)} className="p-1.5 bg-ink-2 hover:bg-ink-3 rounded-md transition-all text-cream/70 hover:text-white" title={showApiKey ? 'Hide' : 'Reveal'}>
                                                        {showApiKey ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                                    </button>
                                                )}
                                                {account.apiKey && (
                                                    <button onClick={() => handleCopyField(account.apiKey!, 'claude-apikey')} className={`p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'claude-apikey' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-cream/70'}`} title="Copy API Key">
                                                        {copiedField === 'claude-apikey' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Claude Skill File */}
                                <a
                                    href="/Fodda_Claude_Skill.md"
                                    download="Fodda_Claude_Skill.md"
                                    className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl hover:border-purple-300 hover:bg-purple-100/50 transition-all group"
                                >
                                    <span className="text-base w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">🔌</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-purple-800 group-hover:text-purple-900 transition-colors">Install Fodda on Claude (MCP)</p>
                                        <p className="text-[11px] text-ink-3 mt-0.5">Quick setup guide & prompting skill for Claude Connectors</p>
                                    </div>
                                    <svg className="w-4 h-4 text-purple-600 group-hover:text-purple-700 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                </a>

                                <div className="p-4 bg-paper border border-line rounded-xl shadow-sm text-center">
                                    <p className="text-xs text-ink-3 font-medium">Need help? See our <a href="https://www.fodda.ai/#/platform-integration-anthropic-claude" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">Claude Setup Guide</a> · <a href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">Anthropic Connectors Guide</a></p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'notion' && (
                            <div className="space-y-10 max-w-3xl">


                                {/* Notion Setup Steps */}
                                <section className="p-8 bg-paper border border-line rounded-3xl space-y-6 shadow-sm">
                                    <h3 className="eyebrow mb-2">Custom Agent Protocol</h3>
                                    <ol className="space-y-4 text-sm font-medium text-ink-2">
                                        <li className="flex gap-4"><span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">1</span><span>Request administrator authorization for custom MCP servers under <span className="text-ink font-bold">Settings → Notion AI → AI connectors</span>.</span></li>
                                        <li className="flex gap-4"><span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">2</span><span>Initialize a new <span className="text-ink font-bold">Custom Agent</span> within your Notion workspace.</span></li>
                                        <li className="flex gap-4"><span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">3</span><span>Configure via <span className="text-ink font-bold">Tools & Access → Add connection → Custom MCP server</span>.</span></li>
                                        <li className="flex gap-4 items-start"><span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">4</span>
                                            <div className="flex-1 space-y-3">
                                                <span>Deploy this Endpoint URL:</span>
                                                <div className="relative group max-w-xl">
                                                    <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-purple-300 border border-ink-2 break-all pr-12">{getClaudeConnectorUrl()}</code>
                                                    <button onClick={() => handleCopyField(getClaudeConnectorUrl(), 'notion-tab-url')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'notion-tab-url' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy URL">
                                                        {copiedField === 'notion-tab-url' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                        <li className="flex gap-4"><span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">5</span><span>Select <span className="text-ink font-bold">"API Key"</span> — enter <code className="px-1.5 py-0.5 bg-cream/80 rounded border border-line text-[10px] font-mono text-ink-2">api_key</code> as the Key and your Fodda API key as the Value.</span></li>
                                        <li className="flex gap-4"><span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">6</span><span>Execute "Save" — the knowledge bridge is established.</span></li>
                                    </ol>
                                    <div className="p-4 bg-cream/30 border border-line border-dashed rounded-2xl">
                                        <p className="text-[10px] font-black text-ink-4 uppercase tracking-widest leading-relaxed">🔒 End-to-end encrypted knowledge transfer via secure HTTPS tunnel.</p>
                                    </div>
                                </section>

                                {/* Requirements */}
                                <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
                                    <h3 className="eyebrow">Requirements</h3>
                                    <div className="space-y-2.5">
                                        <div className="flex items-start gap-2 text-xs text-ink-2">
                                            <span className="text-brand shrink-0 mt-0.5">✅</span>
                                            <span><span className="font-bold text-ink">Notion Business or Enterprise plan</span> — required for Custom Agents and AI features</span>
                                        </div>
                                        <div className="flex items-start gap-2 text-xs text-ink-2">
                                            <span className="text-brand shrink-0 mt-0.5">✅</span>
                                            <span><span className="font-bold text-ink">Fodda account with active API key</span> — sign up at <a href="https://app.fodda.ai" target="_blank" rel="noopener noreferrer" className="text-brand font-bold hover:underline">app.fodda.ai</a></span>
                                        </div>
                                        <div className="flex items-start gap-2 text-xs text-ink-2">
                                            <span className="text-brand shrink-0 mt-0.5">✅</span>
                                            <span><span className="font-bold text-ink">Workspace admin must enable custom MCP servers</span> — under Settings → Notion AI → AI connectors</span>
                                        </div>
                                    </div>
                                </section>

                                {/* API Key */}
                                <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
                                    <h3 className="eyebrow">Your API Key</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1 group">
                                            <code className="block p-3.5 bg-ink rounded-xl text-sm font-mono border border-ink-2 text-amber-300 break-all pr-24">
                                                {account.apiKey
                                                    ? (showApiKey ? account.apiKey : account.apiKey.slice(0, 8) + '••••••••••••')
                                                    : 'No API key generated yet'}
                                            </code>
                                            <div className="absolute top-2.5 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {account.apiKey && (
                                                    <button onClick={() => setShowApiKey(!showApiKey)} className="p-1.5 bg-ink-2 hover:bg-ink-3 rounded-md transition-all text-cream/70 hover:text-white" title={showApiKey ? 'Hide' : 'Reveal'}>
                                                        {showApiKey ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                                    </button>
                                                )}
                                                {account.apiKey && (
                                                    <button onClick={() => handleCopyField(account.apiKey!, 'notion-apikey')} className={`p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'notion-apikey' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-cream/70'}`} title="Copy API Key">
                                                        {copiedField === 'notion-apikey' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Notion README File */}
                                <a
                                    href="/Fodda_Notion_README.md"
                                    download="Fodda_Notion_README.md"
                                    className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl hover:border-blue-300 hover:bg-blue-100/50 transition-all group"
                                >
                                    <span className="text-base w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">📝</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-blue-800 group-hover:text-blue-900 transition-colors">Fodda-Notion Connection Help</p>
                                        <p className="text-[11px] text-ink-3 mt-0.5">Download this README for setup & prompting with Notion</p>
                                    </div>
                                    <svg className="w-4 h-4 text-blue-600 group-hover:text-blue-700 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                </a>

                                <div className="p-4 bg-paper border border-line rounded-xl shadow-sm text-center">
                                    <p className="text-xs text-ink-3 font-medium">Need help? See our <a href="https://www.fodda.ai" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">Support</a> page.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'perplexity' && (
                            <div className="space-y-10 max-w-3xl">
                                {/* Perplexity Setup Steps */}
                                <section className="p-8 bg-paper border border-line rounded-3xl space-y-6 shadow-sm animate-fade-in-up">
                                    <h3 className="eyebrow mb-2">Connect to Perplexity</h3>
                                    <p className="text-sm text-ink-3 mb-4">You can connect Fodda to Perplexity as an AI search source or use the custom MCP endpoint inside Perplexity-powered workspace clients.</p>
                                    <ol className="space-y-4 text-sm font-medium text-ink-2">
                                        <li className="flex gap-4">
                                            <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">1</span>
                                            <span>Copy your Fodda API key from the section below.</span>
                                        </li>
                                        <li className="flex gap-4">
                                            <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">2</span>
                                            <span>To search Fodda graphs directly inside Perplexity, configure Fodda as a Custom Search engine in your browser/workspace with the query URL:</span>
                                        </li>
                                        <li className="flex gap-4 items-start pl-10">
                                            <div className="flex-1 space-y-3">
                                                <div className="relative group max-w-xl">
                                                    <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-[#DE7356] border border-ink-2 break-all pr-12">{`https://api.fodda.ai/v1/search?api_key=${account.apiKey || 'YOUR_API_KEY'}&q=%s`}</code>
                                                    <button onClick={() => handleCopyField(`https://api.fodda.ai/v1/search?api_key=${account.apiKey || 'YOUR_API_KEY'}&q=%s`, 'perplexity-search-url')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'perplexity-search-url' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy Search URL">
                                                        {copiedField === 'perplexity-search-url' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                        <li className="flex gap-4 items-start">
                                            <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">3</span>
                                            <div className="flex-1 space-y-3">
                                                <span>Alternatively, deploy this MCP Server endpoint in Perplexity-supporting clients:</span>
                                                <div className="relative group max-w-xl">
                                                    <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-purple-300 border border-ink-2 break-all pr-12">{getClaudeConnectorUrl()}</code>
                                                    <button onClick={() => handleCopyField(getClaudeConnectorUrl(), 'perplexity-mcp-url')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'perplexity-mcp-url' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy MCP URL">
                                                        {copiedField === 'perplexity-mcp-url' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    </ol>
                                </section>

                                {/* API Key */}
                                <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
                                    <h3 className="eyebrow">Your API Key</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1 group">
                                            <code className="block p-3.5 bg-ink rounded-xl text-sm font-mono border border-ink-2 text-amber-300 break-all pr-24">
                                                {account.apiKey
                                                    ? (showApiKey ? account.apiKey : account.apiKey.slice(0, 8) + '••••••••••••')
                                                    : 'No API key generated yet'}
                                            </code>
                                            <div className="absolute top-2.5 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {account.apiKey && (
                                                    <button onClick={() => setShowApiKey(!showApiKey)} className="p-1.5 bg-ink-2 hover:bg-ink-3 rounded-md transition-all text-cream/70 hover:text-white" title={showApiKey ? 'Hide' : 'Reveal'}>
                                                        {showApiKey ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                                    </button>
                                                )}
                                                {account.apiKey && (
                                                    <button onClick={() => handleCopyField(account.apiKey!, 'perplexity-apikey')} className={`p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'perplexity-apikey' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-cream/70'}`} title="Copy API Key">
                                                        {copiedField === 'perplexity-apikey' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'copilot' && (
                            <div className="space-y-10 max-w-4xl">


                                {/* Path Switcher */}
                                <div className="flex gap-1.5 bg-cream p-1.5 rounded-2xl border border-line max-w-md mx-auto">
                                    <button
                                        onClick={() => setCopilotPath('mcp-direct')}
                                        className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center justify-center shadow-sm ${copilotPath === 'mcp-direct'
                                            ? 'bg-ink text-white'
                                            : 'text-ink-4 hover:bg-white hover:text-ink border border-transparent hover:border-line'
                                        }`}
                                    >
                                        MCP Protocol
                                    </button>
                                    <button
                                        onClick={() => setCopilotPath('plugin')}
                                        className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center justify-center shadow-sm ${copilotPath === 'plugin'
                                            ? 'bg-ink text-white'
                                            : 'text-ink-4 hover:bg-white hover:text-ink border border-transparent hover:border-line'
                                        }`}
                                    >
                                        Teams Plugin
                                    </button>
                                </div>

                                {/* Path A: MCP Direct Connection (NEW — Recommended) */}
                                {copilotPath === 'mcp-direct' && (
                                    <div className="space-y-8 animate-fade-in-up">
                                        <section className="p-8 bg-paper border border-line rounded-3xl space-y-6 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <h3 className="eyebrow mb-0">Direct Knowledge Injection</h3>
                                                <span className="px-2 py-0.5 bg-brand text-white text-[8px] font-black uppercase tracking-widest rounded-full">Preferred</span>
                                            </div>
                                            <p className="text-sm font-medium text-ink-3">MCP Apps are natively integrated into Microsoft 365 Copilot via the Agents Toolkit framework. Establish a direct knowledge link without intermediary plugins.</p>
                                            <ol className="space-y-5">
                                                <li className="flex gap-4">
                                                    <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">1</span>
                                                    <span className="text-sm font-medium text-ink-2">Launch <span className="text-ink font-bold">VS Code</span> with the Microsoft 365 Agents Toolkit extension initialized.</span>
                                                </li>
                                                <li className="flex gap-4">
                                                    <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">2</span>
                                                    <span className="text-sm font-medium text-ink-2">Select <span className="text-ink font-bold">"Add an Action"</span> and choose the MCP Server option.</span>
                                                </li>
                                                <li className="flex gap-4 items-start">
                                                    <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">3</span>
                                                    <div className="flex-1 space-y-3">
                                                        <span className="text-sm font-medium text-ink-2">Deploy the following SSE Protocol URL:</span>
                                                        <div className="relative group max-w-xl">
                                                            <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-blue-300 border border-ink-2 break-all pr-12">{MCP_SSE_URL}</code>
                                                            <button onClick={() => handleCopyField(MCP_SSE_URL, 'copilot-mcp-url')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'copilot-mcp-url' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy URL">
                                                                {copiedField === 'copilot-mcp-url' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                                <li className="flex gap-4 items-start">
                                                    <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">4</span>
                                                    <div className="flex-1 space-y-4">
                                                        <span className="text-sm font-medium text-ink-2">Configure Secure Identity:</span>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="p-4 bg-cream border border-line rounded-2xl">
                                                                <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest">Protocol Type</p>
                                                                <p className="text-xs font-mono font-bold text-ink-2 mt-1 uppercase tracking-tighter">X-API-KEY</p>
                                                            </div>
                                                            <div className="p-4 bg-cream border border-line rounded-2xl">
                                                                <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest">Header Key</p>
                                                                <p className="text-xs font-mono font-bold text-ink-2 mt-1 uppercase tracking-tighter">X-API-Key</p>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest mb-1.5">Live Hash</p>
                                                            <div className="relative group max-w-xl">
                                                                <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-amber-300 border border-ink-2 break-all pr-24 shadow-sm">
                                                                    {account.apiKey ? (showApiKey ? account.apiKey : account.apiKey.slice(0, 8) + '••••••••••••') : 'FK_LIVE_REDACTED'}
                                                                </code>
                                                                <div className="absolute top-2.5 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {account.apiKey && (
                                                                        <button onClick={() => setShowApiKey(!showApiKey)} className="p-1.5 bg-ink-2 hover:bg-ink-3 rounded-md transition-all text-cream/70 hover:text-white" title={showApiKey ? 'Hide' : 'Reveal'}>
                                                                            {showApiKey ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                                                        </button>
                                                                    )}
                                                                    {account.apiKey && (
                                                                        <button onClick={() => handleCopyField(account.apiKey!, 'copilot-apikey')} className={`p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'copilot-apikey' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-cream/70'}`} title="Copy API Key">
                                                                            {copiedField === 'copilot-apikey' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                                <li className="flex gap-4">
                                                    <span className="w-6 h-6 rounded-full bg-brand text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm">5</span>
                                                    <span className="text-sm font-medium text-ink-2">Test integration — Copilot will discover all intelligence tools automatically.</span>
                                                </li>
                                            </ol>
                                        </section>

                                        {/* What Copilot will have access to */}
                                        <section className="p-6 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
                                            <h3 className="eyebrow">Your Copilot will have access to</h3>
                                            <div className="space-y-2">
                                                <div className="flex items-start gap-2 text-xs text-ink-2">
                                                    <span className="text-teal-600 shrink-0 mt-0.5">✅</span>
                                                    <span><span className="font-bold text-ink">7 graph intelligence tools</span> — search, evidence, neighbors, adjacencies, statistics, details, and label values</span>
                                                </div>
                                                <div className="flex items-start gap-2 text-xs text-ink-2">
                                                    <span className="text-teal-600 shrink-0 mt-0.5">✅</span>
                                                    <span><span className="font-bold text-ink">21 supplemental data sources</span> — Census, FRED, BLS, BEA, FDA, PubMed, CDC, World Bank, WTO, OECD, Pew, Google Trends, Amazon, OpenFoodFacts, OSM, Wikipedia, RIDB, OpenAlex, Semantic Scholar, and more</span>
                                                </div>
                                                <div className="flex items-start gap-2 text-xs text-ink-2">
                                                    <span className="text-teal-600 shrink-0 mt-0.5">✅</span>
                                                    <span><span className="font-bold text-ink">Same MCP server</span> as Claude and Cursor — one platform, every AI client</span>
                                                </div>
                                                <div className="flex items-start gap-2 text-xs text-ink-2">
                                                    <span className="text-teal-600 shrink-0 mt-0.5">✅</span>
                                                    <span><span className="font-bold text-ink">Inline widgets</span> — results render directly in Teams and Copilot chat</span>
                                                </div>
                                            </div>
                                        </section>

                                        {/* Aspirational: What it looks like in Copilot */}
                                        <section className="p-5 bg-paper border border-line rounded-2xl space-y-3 shadow-sm">
                                            <h3 className="text-xs font-bold text-teal-600 uppercase tracking-widest">What it looks like in Copilot</h3>
                                            <div className="space-y-2">
                                                <div className="p-3 bg-cream rounded-xl border border-line">
                                                    <p className="text-[10px] text-ink-3 mb-1">User asks:</p>
                                                    <p className="text-sm text-ink font-medium italic">"What e-commerce trends is DHL tracking?"</p>
                                                </div>
                                                <div className="flex items-center gap-2 px-3">
                                                    <div className="w-1 h-6 bg-teal-500/20 rounded-full"></div>
                                                    <p className="text-[10px] text-teal-600 font-semibold">Copilot calls Fodda <code className="text-teal-700">search_trends</code> tool →</p>
                                                </div>
                                                <div className="p-3 bg-cream rounded-xl border border-line">
                                                    <p className="text-[10px] text-ink-3 mb-1">Copilot responds with Fodda-grounded insights:</p>
                                                    <p className="text-sm text-ink-2">DHL is tracking <span className="text-teal-600 font-bold">3 key e-commerce trends</span> including cross-border logistics automation, drone last-mile delivery, and AI-powered demand forecasting…</p>
                                                </div>
                                            </div>
                                        </section>

                                        <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl shadow-sm">
                                            <p className="text-xs text-teal-800 font-medium">💡 The Microsoft 365 Agents Toolkit handles the MCP → Copilot bridge. No new API endpoints or configuration needed — Fodda's existing MCP server works directly.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Path B: Declarative Agent Plugin (Existing) */}
                                {copilotPath === 'plugin' && (
                                    <div className="space-y-5 animate-fade-in-up">
                                        <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <h3 className="eyebrow mb-0">Alternative: Teams App Plugin</h3>
                                                <span className="px-1.5 py-0.5 bg-line text-ink-3 text-[8px] font-bold uppercase tracking-wider rounded">Legacy</span>
                                            </div>
                                            <p className="text-sm text-ink-3">Deploy Fodda as a Declarative Agent plugin using the ZIP-based Teams App flow. <span className="text-ink-4">For most users, the MCP Direct path above is simpler and recommended.</span></p>
                                            <ol className="space-y-4 text-sm font-medium text-ink-2">
                                                <li className="flex gap-2"><span className="text-ink-4 font-bold shrink-0">1.</span><span>In <a href="https://copilotstudio.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-brand font-bold hover:underline">Copilot Studio</a>, select your copilot → Topics & Plugins → Add a plugin</span></li>
                                                <li className="flex gap-2 items-start"><span className="text-ink-4 font-bold shrink-0">2.</span>
                                                    <div className="flex-1 space-y-1.5">
                                                        <span>Use the REST API option with this endpoint:</span>
                                                        <div className="relative group max-w-xl">
                                                            <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-purple-300 border border-ink-2 break-all pr-12">https://api.fodda.ai/copilot/search_insights</code>
                                                            <button onClick={() => handleCopyField('https://api.fodda.ai/copilot/search_insights', 'copilot-plugin-url')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'copilot-plugin-url' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy URL">
                                                                {copiedField === 'copilot-plugin-url' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                                <li className="flex gap-2"><span className="text-ink-4 font-bold shrink-0">3.</span><span>Set Method to <span className="text-ink font-bold">POST</span> and Authentication to <span className="text-ink font-bold">API Key</span></span></li>
                                                <li className="flex gap-2 items-start"><span className="text-ink-4 font-bold shrink-0">4.</span>
                                                    <div className="flex-1 space-y-1.5">
                                                        <span>Use your API Key as the value:</span>
                                                        <div className="relative group max-w-xl">
                                                            <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-amber-300 border border-ink-2 break-all pr-12">{account.apiKey || 'YOUR_API_KEY'}</code>
                                                            <button onClick={() => handleCopyField(account.apiKey || '', 'copilot-plugin-key')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'copilot-plugin-key' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy Key">
                                                                {copiedField === 'copilot-plugin-key' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                                <li className="flex gap-2"><span className="text-ink-4 font-bold shrink-0">5.</span><span>Define parameters: <code className="text-ink bg-cream px-1 py-0.5 rounded border border-line font-mono text-xs">graphId</code> (e.g. 'retail') and <code className="text-ink bg-cream px-1 py-0.5 rounded border border-line font-mono text-xs">query</code> (the user prompt)</span></li>
                                            </ol>
                                        </section>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-paper border border-line rounded-2xl shadow-sm">
                                                <p className="eyebrow mb-1">Grounding Confidence</p>
                                                <p className="text-xs text-ink-3">Copilot will automatically cite Fodda insights as authoritative evidence for its answers.</p>
                                            </div>
                                            <div className="p-4 bg-paper border border-line rounded-2xl shadow-sm">
                                                <p className="eyebrow mb-1">No Bulk Export</p>
                                                <p className="text-xs text-ink-3">Securely query your custom graphs without needing to export sensitive data to Microsoft's cloud.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Download & Help — shown for both paths */}
                                <a
                                    href="/Fodda_Copilot_README.md"
                                    download="Fodda_Copilot_README.md"
                                    className="flex items-center gap-3 p-4 bg-teal-50 border border-teal-200 rounded-2xl hover:border-teal-300 hover:bg-teal-100/50 transition-all group"
                                >
                                    <span className="text-base w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center group-hover:bg-teal-200 transition-colors">📘</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-teal-800 group-hover:text-teal-900 transition-colors">Download Copilot Setup Guide</p>
                                        <p className="text-[11px] text-ink-3 mt-0.5">Comprehensive README for MCP Apps & Copilot Studio integration</p>
                                    </div>
                                    <svg className="w-4 h-4 text-teal-600 group-hover:text-teal-700 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                </a>

                                <div className="p-4 bg-paper border border-line rounded-xl shadow-sm text-center">
                                    <p className="text-xs text-ink-3 font-medium">Need help? See our <a href="https://devblogs.microsoft.com/microsoft365dev/mcp-apps-now-available-in-copilot-chat/" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">MCP Apps in Copilot</a> · <a href="https://www.fodda.ai" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">fodda.ai</a></p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'chatgpt' && (
                            <div className="p-8 bg-paper border border-line rounded-3xl max-w-4xl space-y-4 text-center py-16 shadow-sm">
                                <span className="text-4xl block mb-2">🤖</span>
                                <h3 className="text-xl font-serif italic text-ink">ChatGPT Connector</h3>
                                <p className="text-sm text-ink-3 max-w-md mx-auto leading-relaxed">
                                    Direct Custom GPT integration is on our roadmap. In the meantime, connect via our standard Streamable HTTP MCP server or API access.
                                </p>
                                <div className="inline-block px-3 py-1 bg-brand/10 text-brand text-xs font-mono font-bold uppercase tracking-wider rounded-full">
                                    On the Roadmap
                                </div>
                            </div>
                        )}

                        {activeTab === 'mcp' && (
                            <div className="space-y-10 max-w-4xl">

                                <AgentPaymentBanner hasPaymentMethod={!!(account as any).hasPaymentMethod} onSetupStripe={() => onSetupPayment?.()} userEmail={user?.email} accountId={(account as any)?.id} />

                                {/* Endpoints & Auth — Both Transports */}
                                <section className="p-8 bg-paper border border-line rounded-3xl space-y-8 shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="eyebrow mb-2">Transport Architecture</h3>
                                            <p className="text-xs text-ink-3 max-w-md">Fodda supports two primary MCP connection methods. Choose the one that matches your client software.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* /mcp endpoint */}
                                        <div className="p-6 bg-cream rounded-2xl border border-line space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-[9px] font-black text-ink-4 uppercase tracking-[0.2em]">Streamable HTTP</label>
                                                <span className="px-2 py-0.5 bg-brand/10 text-brand text-[8px] font-black uppercase tracking-widest rounded">Best for Browser</span>
                                            </div>
                                            <p className="text-[11px] text-ink-3 leading-relaxed">For <span className="font-bold text-ink">Claude.ai</span> and <span className="font-bold text-ink">Notion AI</span>. This endpoint uses URL parameters for authentication and is optimized for low-latency browser fetch.</p>
                                            <div className="relative group">
                                                <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-purple-300 border border-ink-2 break-all pr-12">{MCP_ENDPOINT}</code>
                                                <button onClick={() => handleCopyField(MCP_ENDPOINT, 'ep-http')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'ep-http' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy">
                                                    {copiedField === 'ep-http' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                </button>
                                            </div>
                                        </div>

                                        {/* /sse endpoint */}
                                        <div className="p-6 bg-cream rounded-2xl border border-line space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-[9px] font-black text-ink-4 uppercase tracking-[0.2em]">SSE (Server-Sent Events)</label>
                                                <span className="px-2 py-0.5 bg-ink-4/10 text-ink-4 text-[8px] font-black uppercase tracking-widest rounded">Best for Desktop/CLI</span>
                                            </div>
                                            <p className="text-[11px] text-ink-3 leading-relaxed">For <span className="font-bold text-ink">Claude Desktop, Cursor, and CLIs</span>. This endpoint uses standard SSE transport with Bearer headers for persistent streaming sessions.</p>
                                            <div className="relative group">
                                                <code className="block p-3.5 bg-ink rounded-xl text-xs font-mono text-blue-300 border border-ink-2 break-all pr-12">{MCP_SSE_URL}</code>
                                                <button onClick={() => handleCopyField(MCP_SSE_URL, 'ep-sse')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'ep-sse' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy">
                                                    {copiedField === 'ep-sse' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6 pt-4">
                                        <div>
                                            <label className="block text-[9px] font-black text-ink-4 uppercase tracking-[0.2em] mb-4">Authentication Protocols</label>
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-[10px] font-bold text-ink-3 mb-1.5">Streamable HTTP (<code className="text-brand">/c/:token</code>)</p>
                                                    <pre className="p-4 bg-ink rounded-2xl text-[11px] font-mono text-purple-300 border border-ink-2 whitespace-pre-wrap leading-relaxed shadow-xl">{mcpConn?.mcpUrl || (mcpConn?.token ? `https://mcp.fodda.ai/c/${mcpConn.token}` : 'https://mcp.fodda.ai/c/:token')}</pre>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-ink-3 mb-1.5">SSE (<code className="text-ink-4">/sse</code> with Authorization Bearer header)</p>
                                                    <pre className="p-4 bg-ink rounded-2xl text-[11px] font-mono text-blue-300 border border-ink-2 whitespace-pre-wrap leading-relaxed shadow-xl">{`URL: ${MCP_SSE_URL}\nHeader: Authorization: Bearer ${account.apiKey || 'sk_live_...'}`}</pre>
                                                </div>
                                                <p className="text-[9px] text-ink-4 mt-1.5">Token connection URLs (/c/:token) handle auth automatically. For SSE (/sse), supply Authorization Bearer header.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-5 bg-paper rounded-2xl border border-line">
                                            <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest mb-1.5">Available Tools</p>
                                            <p className="text-2xl font-serif italic text-brand">{loadingMcp ? '...' : mcpToolCount}</p>
                                        </div>
                                        <div className="p-5 bg-paper rounded-2xl border border-line">
                                            <p className="text-[9px] font-black text-ink-4 uppercase tracking-widest mb-1.5 font-mono">Server Version</p>
                                            <p className="text-sm font-bold text-ink uppercase tracking-wide font-mono">{mcpVersion || '1.0.0'}</p>
                                        </div>
                                    </div>
                                    {mcpError && (
                                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                                            <p className="text-xs text-red-700 font-bold">{mcpError}</p>
                                        </div>
                                    )}
                                </section>

                                {/* Agentic Prompting Tip */}
                                <section className="p-6 bg-brand/5 border border-brand/20 rounded-3xl space-y-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <h3 className="eyebrow text-brand mb-0">Agentic Prompting Tip</h3>
                                    </div>
                                    <p className="text-sm text-ink-2 leading-relaxed">
                                        Fodda's MCP tools are fully self-describing. When prompting your connected agent, you don't need to write rigid, step-by-step tool execution scripts. Simply provide a high-level <strong className="text-ink">Goal</strong> (e.g., "Analyze checkout friction trends") and the agent will autonomously orchestrate the right tools.
                                    </p>
                                </section>

                                {/* Quick Connect — CLI, Copilot & Streamable HTTP */}
                                <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
                                    <h3 className="eyebrow">Quick Connect</h3>
                                    <div className="flex gap-1 bg-cream border border-line p-1 rounded-xl max-w-lg">
                                        {([
                                            { key: 'cli' as const, label: 'CLI (SSE)', platform: 'anthropic' as const },
                                            { key: 'copilot' as const, label: 'M365 Copilot', platform: 'microsoft' as const },
                                            { key: 'vertex' as const, label: 'Streamable HTTP', platform: 'google' as const },
                                        ]).map(tab => (
                                            <button
                                                key={tab.key}
                                                onClick={() => setQuickConnectTab(tab.key)}
                                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${quickConnectTab === tab.key
                                                    ? tab.platform === 'anthropic'
                                                        ? 'bg-[#DE7356]/15 text-[#DE7356] border border-[#DE7356]/30 shadow-sm'
                                                        : tab.platform === 'microsoft'
                                                            ? 'bg-teal-500/15 text-teal-700 border border-teal-500/30 shadow-sm'
                                                            : 'bg-purple-500/15 text-purple-700 border border-purple-500/30 shadow-sm'
                                                    : 'text-ink-3 hover:text-ink hover:bg-cream-dark border border-transparent'
                                                    }`}
                                            >
                                                {tab.platform === 'anthropic' && <img src="https://ucarecdn.com/c70edb86-e790-4be0-aa73-5f598137fba5/anthropicstar.jpeg" alt="" className="w-3 h-3 rounded-sm" />}
                                                {tab.platform === 'microsoft' && <div className="w-3 h-3 bg-[#00A4EF] rounded-sm flex items-center justify-center"><svg viewBox="0 0 23 23" fill="white" className="w-2 h-2"><path d="M11.4 0H0v11.4h11.4V0zM23 0H11.6v11.4H23V0zM11.4 11.6H0V23h11.4V11.6zM23 11.6H11.6V23H23V11.6z"/></svg></div>}
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Claude Code CLI */}
                                    {quickConnectTab === 'cli' && (
                                        <div className="space-y-4 animate-fade-in-up">
                                            <div className="flex items-center gap-2">
                                                <img src="https://ucarecdn.com/c70edb86-e790-4be0-aa73-5f598137fba5/anthropicstar.jpeg" alt="" className="w-5 h-5 rounded-sm" />
                                                <p className="text-sm font-bold text-ink font-sans">CLI — SSE Transport</p>
                                            </div>
                                            <p className="text-sm text-ink-3">Run this command to add Fodda to Claude Code:</p>
                                            <div className="relative group max-w-xl">
                                                <pre className="p-4 bg-ink rounded-xl text-[11px] font-mono text-green-400 border border-ink-2 overflow-x-auto whitespace-pre-wrap leading-relaxed">{`claude mcp add --transport sse fodda "${getSseConnectorUrl()}"`}</pre>
                                                <button
                                                    onClick={() => handleCopyField(`claude mcp add --transport sse fodda "${getSseConnectorUrl()}"`, 'cli-command')}
                                                    className={`absolute top-3 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'cli-command' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`}
                                                    title="Copy command"
                                                >
                                                    {copiedField === 'cli-command' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-ink-4">Uses SSE transport with simplified URL parameter authentication</p>
                                        </div>
                                    )}

                                    {/* Gemini / Vertex */}
                                    {quickConnectTab === 'vertex' && (
                                        <div className="space-y-4 animate-fade-in-up">
                                            <div className="flex items-center gap-2">
                                                <button onClick={handleCopyConfig} className="flex-1 px-4 py-2.5 bg-paper border border-line text-ink hover:bg-line-soft hover:text-ink-2 shadow-sm font-bold text-xs rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-2">
                                                    {configCopied ? <><svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copied!</> : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg> Copy to Clipboard</>}
                                                </button>
                                                <button onClick={handleDownloadConfig} className="flex-1 px-4 py-2.5 bg-paper border border-line text-ink hover:bg-line-soft hover:text-ink-2 shadow-sm font-bold text-xs rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-2">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Download JSON
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Microsoft 365 Copilot */}
                                    {quickConnectTab === 'copilot' && (
                                        <div className="space-y-4 animate-fade-in-up">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 bg-[#00A4EF] rounded-sm flex items-center justify-center p-0.5">
                                                    <svg viewBox="0 0 23 23" fill="white"><path d="M11.4 0H0v11.4h11.4V0zM23 0H11.6v11.4H23V0zM11.4 11.6H0V23h11.4V11.6zM23 11.6H11.6V23H23V11.6z"/></svg>
                                                </div>
                                                <p className="text-sm font-bold text-ink">Microsoft 365 Copilot — MCP Direct</p>
                                                <span className="px-1.5 py-0.5 bg-teal-500/10 text-teal-700 text-[8px] font-bold uppercase tracking-wider rounded">New</span>
                                            </div>
                                            <p className="text-sm text-ink-3">Use the <a href="https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.ms-teams-vscode-extension" target="_blank" rel="noopener noreferrer" className="text-teal-600 font-bold hover:underline">Microsoft 365 Agents Toolkit</a> in VS Code:</p>
                                            <ol className="space-y-2 text-sm text-ink-2 pl-1">
                                                <li className="flex gap-2"><span className="text-teal-600 font-bold shrink-0">1.</span><span>"Add an Action" → "Start with an MCP Server"</span></li>
                                                <li className="flex gap-2 items-start"><span className="text-teal-600 font-bold shrink-0">2.</span>
                                                    <div className="flex-1 space-y-1">
                                                        <span>MCP Server URL:</span>
                                                        <div className="relative group">
                                                            <code className="block p-2 bg-ink rounded-lg text-xs font-mono text-teal-400 border border-ink-2 pr-12">{MCP_SSE_URL}</code>
                                                            <button
                                                                onClick={() => handleCopyField(MCP_SSE_URL, 'mcp-copilot-url')}
                                                                className={`absolute top-1.5 right-2 p-1 rounded-md transition-all hover:text-white ${copiedField === 'mcp-copilot-url' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`}
                                                                title="Copy MCP URL"
                                                            >
                                                                {copiedField === 'mcp-copilot-url' ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                                <li className="flex gap-2"><span className="text-teal-600 font-bold shrink-0">3.</span><span>Auth: <code className="text-teal-600 font-mono">X-API-Key</code> → your API key</span></li>
                                            </ol>
                                            <p className="text-[10px] text-ink-4">Copilot discovers all {mcpToolCount || 25} tools automatically via MCP</p>
                                        </div>
                                    )}
                                </section>

                                {/* Config Generators — only on Gemini tab */}
                                {quickConnectTab === 'vertex' && (
                                    <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm animate-fade-in">
                                        <h3 className="eyebrow">Config Generators</h3>
                                        <div className="flex gap-3">
                                            {!showClaudeConfig && (
                                                <button onClick={() => { setShowClaudeConfig(true); setShowVertexConfig(false); }} className="px-4 py-2 bg-purple-500/10 text-purple-700 font-bold text-xs rounded-lg hover:bg-purple-500/20 transition-all uppercase tracking-wider border border-purple-500/20 shadow-sm">
                                                    Generate Claude URL
                                                </button>
                                            )}
                                            {!showVertexConfig && (
                                                <button onClick={() => { setShowVertexConfig(true); setShowClaudeConfig(false); }} className="px-4 py-2 bg-brand/10 text-brand font-bold text-xs rounded-lg hover:bg-brand/20 transition-all uppercase tracking-wider border border-brand/20 shadow-sm">
                                                    Generate Vertex Config
                                                </button>
                                            )}
                                        </div>
                                        {showClaudeConfig && (
                                            <div className="space-y-3 animate-fade-in-up">
                                                <div className="relative group">
                                                    <code className="block p-3 bg-ink rounded-xl text-sm font-mono text-purple-300 border border-ink-2 break-all pr-12">{getClaudeConnectorUrl()}</code>
                                                    <button onClick={() => handleCopyField(getClaudeConnectorUrl(), 'mcp-claude-url')} className={`absolute top-2.5 right-3 p-1.5 rounded-md transition-all hover:text-white ${copiedField === 'mcp-claude-url' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`} title="Copy URL">
                                                        {copiedField === 'mcp-claude-url' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-ink-3">Quickly connect your account using the button below, or paste the URL manually in Claude → <a href="https://claude.ai/settings/connectors?modal=add-custom-connector" target="_blank" rel="noopener noreferrer" className="text-purple-600 font-bold hover:underline">Settings → Connectors</a> → Add custom connector. Leave the OAuth fields blank.</p>
                                                <div className="flex gap-2">
                                                    <a href={`https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Fodda&connectorUrl=${encodeURIComponent(getClaudeConnectorUrl())}`} target="_blank" rel="noopener noreferrer" className="flex-[1.5] px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg border border-purple-500 transition-all uppercase tracking-wider flex items-center justify-center gap-2">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg> Add to Claude
                                                    </a>
                                                    <button onClick={handleCopyClaudeUrl} className="flex-1 px-4 py-2.5 bg-paper border border-line text-ink hover:bg-line-soft hover:text-ink-2 shadow-sm font-bold text-xs rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-2">
                                                        {claudeConfigCopied ? <><svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copied!</> : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg> Copy URL</>}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {showVertexConfig && (
                                            <div className="space-y-3 animate-fade-in-up">
                                                <pre className="p-4 bg-ink rounded-xl text-sm font-mono text-green-400 border border-ink-2 whitespace-pre-wrap overflow-x-auto leading-relaxed">{generateVertexConfig()}</pre>
                                                <div className="flex gap-2">
                                                    <button onClick={handleCopyConfig} className="flex-1 px-4 py-2.5 bg-paper border border-line text-ink hover:bg-line-soft hover:text-ink-2 shadow-sm font-bold text-xs rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-2">
                                                        {configCopied ? <><svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Copied!</> : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg> Copy to Clipboard</>}
                                                    </button>
                                                    <button onClick={handleDownloadConfig} className="flex-1 px-4 py-2.5 bg-paper border border-line text-ink hover:bg-line-soft hover:text-ink-2 shadow-sm font-bold text-xs rounded-lg transition-all uppercase tracking-wider flex items-center justify-center gap-2">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Download JSON
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* Your API Key */}
                                <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
                                    <h3 className="eyebrow">Your API Key</h3>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 p-3 bg-ink rounded-xl text-sm font-mono border border-ink-2 text-amber-300">
                                            {account.apiKey
                                                ? (showApiKey ? account.apiKey : account.apiKey.slice(0, 8) + '••••••••••••')
                                                : 'No API key generated yet'}
                                        </code>
                                        {account.apiKey && (
                                            <button onClick={() => setShowApiKey(!showApiKey)} className="px-3.5 py-3.5 bg-paper hover:bg-line-soft text-ink-3 hover:text-ink rounded-xl border border-line transition-all text-xs font-bold shadow-sm" title={showApiKey ? 'Hide' : 'Reveal'}>
                                                {showApiKey ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                                            </button>
                                        )}
                                        {account.apiKey && (
                                            <button onClick={() => handleCopyField(account.apiKey!, 'mcp-apikey')} className="px-3.5 py-3.5 bg-paper hover:bg-line-soft text-ink-3 hover:text-ink rounded-xl border border-line transition-all shadow-sm" title="Copy API Key">
                                                {copiedField === 'mcp-apikey' ? <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                            </button>
                                        )}
                                    </div>
                                </section>

                                {/* Live MCP Tools */}
                                <section className="p-6 bg-paper border border-line rounded-2xl space-y-4 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h3 className="eyebrow">Available MCP Tools</h3>
                                        <button onClick={loadMcpData} disabled={loadingMcp} className="px-3 py-1.5 bg-paper hover:bg-line-soft text-ink-3 hover:text-ink rounded-lg border border-line transition-all disabled:opacity-50 text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                            {loadingMcp ? '...' : 'Refresh'}
                                        </button>
                                    </div>
                                    {loadingMcp ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full"></div>
                                        </div>
                                    ) : mcpTools.length > 0 ? (
                                        <div className="space-y-2">
                                            {mcpTools.map((tool) => (
                                                <div key={tool.name} className="p-3 bg-cream rounded-xl border border-line hover:border-line-strong transition-colors">
                                                    <p className="text-sm font-mono font-bold text-purple-700">{tool.name}</p>
                                                    <p className="text-xs text-ink-3 mt-0.5 font-normal leading-relaxed">{tool.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-ink-3 italic py-4 text-center">Tools are loading from the MCP server. If nothing appears, click Refresh above.</p>
                                    )}
                                </section>

                                <div className="p-4 bg-paper border border-line rounded-xl shadow-sm text-center">
                                    <p className="text-xs text-ink-2">Need help? See our setup guides for <a href="https://www.fodda.ai/#/vertex-ai-setup-guide" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">Gemini</a> · <a href="https://devblogs.microsoft.com/microsoft365dev/mcp-apps-now-available-in-copilot-chat/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-bold">Copilot</a> · <a href="https://www.fodda.ai/#/platform-integration-openai" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">OpenAI</a> · <a href="https://www.fodda.ai/#/platform-integration-anthropic-claude" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-bold">Claude</a></p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'api' && (
                            <div className="relative">
                                {isApiDisabled && (
                                    <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
                                        <div className="bg-paper p-8 rounded-2xl border border-line shadow-xl text-center max-w-sm">
                                            <span className="text-4xl block mb-4">🔒</span>
                                            <h3 className="text-sm font-bold text-ink uppercase tracking-widest mb-2">API Access Restricted</h3>
                                            <p className="text-xs text-ink-3 font-medium mb-6 leading-relaxed">This is not available for your Plan. Upgrade to access the Fodda API.</p>
                                            {onViewPlans && (
                                                <button onClick={onViewPlans} className="w-full px-5 py-3 bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-dark transition-all shadow-lg shadow-brand/20">
                                                    View Upgrade Options
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className={`space-y-10 max-w-4xl ${isApiDisabled ? 'opacity-40 pointer-events-none select-none filter grayscale' : ''}`}>

                                    <AgentPaymentBanner hasPaymentMethod={!!(account as any).hasPaymentMethod} onSetupStripe={() => onSetupPayment?.()} userEmail={user?.email} accountId={(account as any)?.id} />


                                {/* Authentication */}
                                <section className="space-y-4">
                                    <h3 className="eyebrow">Authentication</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-6 bg-paper border border-line rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-xl">🔓</span>
                                                <p className="text-sm font-bold text-ink">Public Endpoints</p>
                                            </div>
                                            <p className="text-xs text-ink-2 mb-4 leading-relaxed">No API key required. Limited to overview and public directory functions with standard rate limits.</p>
                                            <p className="text-[10px] text-ink-3 font-mono bg-cream p-2 rounded-lg border border-line">POST /v1/psfk/overview</p>
                                        </div>
                                        <div className="p-6 bg-paper border border-purple-200 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-xl">🔑</span>
                                                <p className="text-sm font-bold text-ink">Private Endpoints</p>
                                            </div>
                                            <p className="text-xs text-ink-2 mb-4 leading-relaxed">Requires <code className="text-purple-700 font-bold font-mono">X-API-Key</code>. Grants full access to your licensed vertical graphs and private data.</p>
                                            <p className="text-[10px] text-purple-700 font-mono bg-purple-50 p-2 rounded-lg border border-purple-100">header: X-API-Key: sk_...</p>
                                        </div>
                                    </div>
                                </section>

                                {/* Quickstart */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="eyebrow">Quickstart — Try It Now</h3>
                                        <span className="px-2 py-0.5 bg-brand/10 text-brand border border-brand/20 rounded text-[9px] font-bold uppercase tracking-wider">Shell Command</span>
                                    </div>
                                    <div className="relative group">
                                        <pre className="p-6 bg-ink rounded-2xl text-[12px] font-mono text-green-400 border border-ink-2 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-xl">
                                            {`curl -X POST https://api.fodda.ai/v1/graphs/psfk/search \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${account.apiKey || 'YOUR_API_KEY'}" \\
  -d '{"query": "omnichannel retail", "limit": 10, "use_semantic": true}'`}
                                        </pre>
                                        <button
                                            onClick={() => handleCopyField(`curl -X POST https://api.fodda.ai/v1/graphs/psfk/search \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: ${account.apiKey || 'YOUR_API_KEY'}" \\\n  -d '{"query": "omnichannel retail", "limit": 10, "use_semantic": true}'`, 'api-quickstart')}
                                            className={`absolute top-4 right-4 p-2 rounded-xl transition-all hover:text-white ${copiedField === 'api-quickstart' ? 'bg-green-500/20 text-green-400 opacity-100' : 'bg-ink-2 text-ink-4 opacity-0 group-hover:opacity-100'}`}
                                            title="Copy curl command"
                                        >
                                            {copiedField === 'api-quickstart' ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                        </button>
                                    </div>
                                </section>

                                {/* Endpoint Reference */}
                                <section className="space-y-6">
                                    <h3 className="eyebrow">Endpoint Reference</h3>
                                    
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-ink-4 uppercase tracking-widest pl-1">🔓 Public Resources</p>
                                        <div className="p-5 bg-paper border border-line rounded-2xl group hover:border-line-strong transition-colors shadow-sm">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="px-2 py-0.5 bg-brand/10 text-brand text-[10px] font-bold rounded uppercase">POST</span>
                                                <code className="text-sm font-mono text-ink font-bold">/v1/psfk/overview</code>
                                            </div>
                                            <p className="text-xs text-ink-2 leading-relaxed">LLM-synthesized executive summary of industry trends based on the PSFK Graph.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-ink-4 uppercase tracking-widest pl-1">🔑 Private Resources</p>
                                        <div className="grid gap-3">
                                            {[
                                                { method: 'GET', path: '/v1/graphs', desc: 'List available knowledge graphs and their schemas.' },
                                                { method: 'POST', path: '/v1/graphs/:graph_id/search', desc: 'Hybrid search (vector + keyword) over a specific graph vertical.', body: `{"query": "...", "limit": 10, "use_semantic": true}` },
                                                { method: 'GET', path: '/v1/graphs/:graph_id/nodes/:node_id', desc: 'Retrieve full metadata and properties for a specific node.' },
                                                { method: 'POST', path: '/v1/graphs/:graph_id/neighbors', desc: 'Graph traversal — find connected trend nodes and signals.', body: `{"seed_node_ids": [...], "depth": 1}` },
                                                { method: 'POST', path: '/v1/graphs/:graph_id/evidence', desc: 'Retrieve source articles and evidence nodes backing a trend.', body: `{"for_node_id": "...", "top_k": 5}` },
                                            ].map((endpoint, i) => (
                                                <div key={endpoint.path} className="p-5 bg-paper border border-line rounded-2xl shadow-sm">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${endpoint.method === 'GET' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>{endpoint.method}</span>
                                                        <code className="text-sm font-mono text-ink font-bold">{endpoint.path}</code>
                                                    </div>
                                                    <p className="text-xs text-ink-2 mb-2">{endpoint.desc}</p>
                                                    {endpoint.body && (
                                                        <div className="p-3 bg-cream border border-line rounded-xl">
                                                            <code className="text-[10px] text-ink-3 font-mono">{endpoint.body}</code>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                {/* Response Envelope */}
                                <section className="space-y-4">
                                    <h3 className="eyebrow">Metadata Envelope</h3>
                                    <p className="text-xs text-ink-2">All API responses follow a consistent structural envelope for predictable parsing:</p>
                                    <pre className="p-6 bg-ink rounded-2xl text-[12px] font-mono text-purple-300 border border-ink-2 shadow-lg">
                                        {`{
  "ok": true,
  "data": { ... },
  "meta": { "requestId": "...", "version": "v1.1" },
  "usage": { "query_units": 1, "total_billable_units": 1 }
}`}
                                    </pre>
                                </section>

                                <footer className="p-8 bg-paper border border-line rounded-2xl text-center space-y-4 shadow-sm">
                                    <p className="text-sm text-ink-2">Need the full OpenAPI specification or technical integration support?</p>
                                    <div className="flex items-center justify-center gap-4">
                                        <button onClick={() => onViewApiDocs?.()} className="px-6 py-2 bg-ink text-paper hover:bg-black font-bold text-xs rounded-xl transition-all shadow-md">Full Documentation</button>
                                        <a href="mailto:hello@psfk.com" className="px-6 py-2 border border-ink text-ink font-bold text-xs rounded-xl hover:bg-line-soft transition-all">Contact Support</a>
                                    </div>
                                </footer>
                                </div>
                            </div>
                        )}

                        {activeTab === 'graphs' && (
                            <div className="space-y-10 max-w-4xl">
                                <header>
                                    <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-1">Source Management</p>
                                    <h2 className="text-3xl font-serif italic text-[#1a1a1a]">My Knowledge Graphs</h2>
                                </header>

                                {/* Registration Flow Modal-in-Paper */}
                                {registrationStep !== 'idle' && (
                                    <div className="bg-white border border-[#e8e6d9] rounded-2xl p-8 shadow-sm space-y-8 animate-fade-in-up">
                                        {/* Step 1: Source Selection */}
                                        {registrationStep === 'source' && (
                                            <div className="space-y-6">
                                                <header>
                                                    <h3 className="text-sm font-bold text-[#1a1a1a] uppercase tracking-widest">Select Data Source</h3>
                                                    <p className="text-xs text-[#4a4a4a] mt-1">Choose how you want to ingest your report into the Fodda network.</p>
                                                </header>
                                                
                                                <div className="grid grid-cols-2 gap-4">
                                                    <button
                                                        onClick={() => { setRegSourceType('pdf' as any); }}
                                                        className={`p-6 rounded-2xl border text-left transition-all ${regSourceType === 'pdf' ? 'border-[#8B5CF6] bg-[#8B5CF6]/5 ring-1 ring-[#8B5CF6]/20' : 'border-[#e8e6d9] bg-white hover:border-[#1a1a1a]'}`}
                                                    >
                                                        <span className="text-2xl block mb-3">📄</span>
                                                        <p className="text-sm font-bold text-[#1a1a1a]">PDF Analysis</p>
                                                        <p className="text-[11px] text-[#6a6a6a] mt-2 leading-relaxed">AI-driven extraction from any trend report or academic paper.</p>
                                                    </button>
                                                    <button
                                                        onClick={() => { setRegSourceType('sheets'); }}
                                                        className={`p-6 rounded-2xl border text-left transition-all ${regSourceType === 'sheets' ? 'border-[#8B5CF6] bg-[#8B5CF6]/5 ring-1 ring-[#8B5CF6]/20' : 'border-[#e8e6d9] bg-white hover:border-[#1a1a1a]'}`}
                                                    >
                                                        <span className="text-2xl block mb-3">📊</span>
                                                        <p className="text-sm font-bold text-[#1a1a1a]">Google Sheet</p>
                                                        <p className="text-[11px] text-[#6a6a6a] mt-2 leading-relaxed">Direct synchronization from structured Fodda templates.</p>
                                                    </button>
                                                </div>

                                                {regSourceType === 'sheets' && (
                                                    <div className="space-y-6 pt-4 animate-fade-in">
                                                        <div className="p-4 bg-[#fdfcf2] border border-[#e8e6d9] rounded-xl flex gap-3">
                                                            <span className="text-lg">📌</span>
                                                            <div>
                                                                <p className="text-[11px] font-bold text-[#1a1a1a] uppercase tracking-wide">Permission Required</p>
                                                                <p className="text-[11px] text-[#4a4a4a] mt-1">Share your Google Sheet with this email before proceeding:</p>
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <code className="flex-1 p-2 bg-white rounded-lg text-[10px] font-mono text-[#1a1a1a] border border-[#e8e6d9] break-all">{SERVICE_ACCOUNT_EMAIL}</code>
                                                                    <button onClick={() => { navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL); setCopiedField('sa-email'); setTimeout(() => setCopiedField(null), 2000); }} className="p-2 bg-[#1a1a1a] text-white rounded-lg shadow-sm">
                                                                        {copiedField === 'sa-email' ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} /></svg>}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest">Google Sheet URL</label>
                                                            <input
                                                                type="url"
                                                                value={regSheetUrl}
                                                                onChange={e => setRegSheetUrl(e.target.value)}
                                                                className="w-full px-4 py-3 bg-white border border-[#e8e6d9] rounded-xl text-sm focus:outline-none focus:border-[#1a1a1a] placeholder:text-[#b4b1a1]"
                                                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                                            />
                                                        </div>
                                                        <div className="flex gap-3 justify-end pt-4">
                                                            <button onClick={() => { setRegistrationStep('idle'); setRegSheetUrl(''); setRegMeta(null); }} className="px-6 py-2 text-[#6a6a6a] hover:text-[#1a1a1a] text-xs font-bold font-serif italic transition-all">Cancel</button>
                                                            <button
                                                                onClick={handleFetchSheetMeta}
                                                                disabled={!regSheetUrl || regLoading}
                                                                className="px-8 py-2.5 bg-[#1a1a1a] text-white font-bold text-xs rounded-xl disabled:opacity-40 transition-all shadow-lg hover:bg-black"
                                                            >
                                                                {regLoading ? 'Verifying Source...' : 'Read & Continue →'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* PDF Upload Flow */}
                                                {regSourceType === 'pdf' && (
                                                    <div className="space-y-8 animate-fade-in pl-1">
                                                        <div className="space-y-6">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest">PDF Documentation URL</label>
                                                                <input
                                                                    type="url"
                                                                    value={pdfUrl}
                                                                    onChange={e => setPdfUrl(e.target.value)}
                                                                    className="w-full px-4 py-3 bg-white border border-[#e8e6d9] rounded-xl text-sm focus:outline-none focus:border-[#1a1a1a] placeholder:text-[#b4b1a1]"
                                                                    placeholder="https://drive.google.com/file/d/.../view"
                                                                />
                                                                <p className="text-[10px] text-[#4a4a4a] leading-relaxed">Direct link to trend report. Public access required for our ingestion engine.</p>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest">Expert Presentation <span className="opacity-50 normal-case tracking-normal italic">(Optional)</span></label>
                                                                <div className="flex gap-4">
                                                                    <div className="w-16 h-16 rounded-xl bg-cream border border-dashed border-[#e8e6d9] flex items-center justify-center overflow-hidden shrink-0">
                                                                        {(headshotUrl || suggestedHeadshotUrl) ? (
                                                                            <img src={headshotUrl || suggestedHeadshotUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <span className="text-xl">📸</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 space-y-2">
                                                                        <input
                                                                            type="url"
                                                                            value={headshotUrl || suggestedHeadshotUrl}
                                                                            onChange={e => { setHeadshotUrl(e.target.value); setSuggestedHeadshotUrl(''); }}
                                                                            className="w-full px-4 py-3 bg-white border border-[#e8e6d9] rounded-xl text-xs focus:outline-none focus:border-[#1a1a1a] placeholder:text-[#b4b1a1]"
                                                                            placeholder="Expert headshot URL (LinkedIn, Website)"
                                                                        />
                                                                        {suggestedHeadshotUrl && !headshotUrl && (
                                                                            <p className="text-[10px] text-[#10B981] font-bold">✨ Discovered from document metadata</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Editable Metadata Form (after extraction) */}
                                                        {regMeta && (
                                                            <div className="p-6 bg-[#fdfcf2] border border-[#d1d5db] rounded-2xl space-y-6 animate-fade-in shadow-inner">
                                                                <header className="flex items-center justify-between">
                                                                    <p className="text-[10px] font-bold text-[#10B981] uppercase tracking-widest flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span> Extraction Successful</p>
                                                                    <span className="text-xs font-serif italic text-[#4a4a4a]">Edit details below</span>
                                                                </header>

                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-2">
                                                                        <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest">Graph Title</label>
                                                                        <input type="text" value={regMeta.graphName || ''} onChange={e => setRegMeta({...regMeta, graphName: e.target.value})} className="w-full px-3 py-2 bg-white border border-[#e8e6d9] rounded-lg text-sm text-[#1a1a1a]" />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest">Primary Creator</label>
                                                                        <input type="text" value={regMeta.creator || ''} onChange={e => setRegMeta({...regMeta, creator: e.target.value})} className="w-full px-3 py-2 bg-white border border-[#e8e6d9] rounded-lg text-sm text-[#1a1a1a]" />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest">One Line Synthesis</label>
                                                                    <input type="text" value={regMeta.description || ''} onChange={e => setRegMeta({...regMeta, description: e.target.value})} className="w-full px-3 py-2 bg-white border border-[#e8e6d9] rounded-lg text-sm text-[#1a1a1a]" placeholder="A sensemaking graph about..." />
                                                                </div>

                                                                <div className="grid grid-cols-3 gap-3">
                                                                    {[
                                                                        { label: 'Trend Nodes', val: regMeta.trendCount },
                                                                        { label: 'Evidence', val: regMeta.evidenceCount },
                                                                        { label: 'Citations', val: regMeta.citationCount }
                                                                    ].map(stat => (
                                                                        <div key={stat.label} className="p-3 bg-white border border-[#e8e6d9] rounded-xl text-center">
                                                                            <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest">{stat.label}</p>
                                                                            <p className="text-lg font-serif italic text-[#1a1a1a]">{stat.val || 0}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {(suggestedTopics.length > 0 || selectedTopics.length > 0) && (
                                                                    <div className="space-y-3">
                                                                        <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest">Graph Taxonomy</label>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {(suggestedTopics.length > 0 ? suggestedTopics : validTopics).map((topic, i) => {
                                                                                const isSelected = selectedTopics.includes(topic);
                                                                                return (
                                                                                    <button
                                                                                        key={i}
                                                                                        type="button"
                                                                                        onClick={() => setSelectedTopics(prev => isSelected ? prev.filter(t => t !== topic) : [...prev, topic])}
                                                                                        className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                                                                                            isSelected
                                                                                                ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                                                                                                : 'bg-white text-[#6a6a6a] border-[#e8e6d9] hover:border-[#1a1a1a]'
                                                                                        }`}
                                                                                    >
                                                                                        {topic}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="space-y-4">
                                                            <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest pl-1">Distribution License</p>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                {[
                                                                    { id: 'private', emoji: '🔒', title: 'Private', desc: 'Internal use only' },
                                                                    { id: 'network', emoji: '🌐', title: 'Network', desc: 'Free for Fodda' },
                                                                    { id: 'sell', emoji: '💰', title: 'Commercial', desc: '50% Rev-share' }
                                                                ].map(mode => (
                                                                    <label key={mode.id} className={`p-4 rounded-xl border cursor-pointer transition-all ${distributionMode === mode.id ? 'border-[#8B5CF6] bg-[#8B5CF6]/5' : 'border-[#e8e6d9] bg-white hover:border-[#1a1a1a]'}`}>
                                                                        <input type="radio" value={mode.id} checked={distributionMode === mode.id} onChange={() => setDistributionMode(mode.id as any)} className="hidden" />
                                                                        <span className="text-xl block mb-2">{mode.emoji}</span>
                                                                        <p className="text-[11px] font-bold text-[#1a1a1a]">{mode.title}</p>
                                                                        <p className="text-[9px] text-[#6a6a6a] mt-0.5">{mode.desc}</p>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-4 justify-end pt-4 border-t border-[#e8e6d9]">
                                                            <button onClick={() => { setRegistrationStep('idle'); setPdfUrl(''); setHeadshotUrl(''); setRegMeta(null); }} className="px-6 py-2 text-[#6a6a6a] hover:text-[#1a1a1a] text-xs font-bold font-serif italic">Cancel</button>
                                                            {!regMeta ? (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!pdfUrl) return;
                                                                        setExtracting(true);
                                                                        try {
                                                                            const res = await fetch('/api/expert-graph/upload-pdf', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ pdfUrl })
                                                                            });
                                                                            const data = await res.json();
                                                                            if (data.ok && data.meta) {
                                                                                setRegMeta({
                                                                                    ...data.meta,
                                                                                    creator: data.meta.creator || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                                                                                    organization: data.meta.organization || account.name || '',
                                                                                });
                                                                                if (data.suggestedTopics?.length) {
                                                                                    setSuggestedTopics(data.suggestedTopics);
                                                                                    setSelectedTopics(data.suggestedTopics);
                                                                                }
                                                                                if (data.validTopics?.length) setValidTopics(data.validTopics);
                                                                                if (data.suggestedHeadshotUrl) setSuggestedHeadshotUrl(data.suggestedHeadshotUrl);
                                                                            } else {
                                                                                alert(data.error || 'Extraction failed');
                                                                            }
                                                                        } catch (e: any) {
                                                                            alert('Extraction error: ' + e.message);
                                                                        } finally {
                                                                            setExtracting(false);
                                                                        }
                                                                    }}
                                                                    disabled={!pdfUrl || extracting}
                                                                    className="px-10 py-3 bg-[#1a1a1a] text-white font-bold text-xs rounded-xl shadow-lg hover:bg-black transition-all disabled:opacity-40"
                                                                >
                                                                    {extracting ? '🔍 Scanning Document...' : 'Extract & Preview →'}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={async () => {
                                                                        setSubmittingExpertGraph(true);
                                                                        try {
                                                                            const res = await fetch('/api/expert-graph/submit', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({
                                                                                    graphName: regMeta.graphName,
                                                                                    oneLiner: regMeta.description,
                                                                                    description: regMeta.description,
                                                                                    creator: regMeta.creator,
                                                                                    organization: regMeta.organization,
                                                                                    domain: regMeta.domain,
                                                                                    tags: selectedTopics.join(', '),
                                                                                    geography: regMeta.geography,
                                                                                    updateFrequency: regMeta.updateFrequency || 'quarterly',
                                                                                    pdfUrl,
                                                                                    headshotUrl: headshotUrl || suggestedHeadshotUrl || undefined,
                                                                                    reportTitle: regMeta.reportTitle,
                                                                                    publicationDate: regMeta.publicationDate,
                                                                                    trendCount: regMeta.trendCount,
                                                                                    evidenceCount: regMeta.evidenceCount,
                                                                                    distributionMode,
                                                                                    userEmail: user.email,
                                                                                })
                                                                            });
                                                                            const data = await res.json();
                                                                            if (data.ok) {
                                                                                setRegResult({ ok: true, graphSlug: data.graphSlug });
                                                                                setRegistrationStep('result');
                                                                                setTimeout(() => loadMyGraphs(), 2000);
                                                                            } else {
                                                                                alert(data.error || 'Submission failed');
                                                                            }
                                                                        } catch (e: any) {
                                                                            alert('Submit error: ' + e.message);
                                                                        } finally {
                                                                            setSubmittingExpertGraph(false);
                                                                        }
                                                                    }}
                                                                    disabled={submittingExpertGraph}
                                                                    className="px-10 py-3 bg-[#1a1a1a] text-white font-bold text-xs rounded-xl shadow-lg hover:bg-black transition-all disabled:opacity-40"
                                                                >
                                                                    {submittingExpertGraph ? 'Finalizing Registry...' : 'Submit for Peer Review'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Step 2: Edit Metadata */}
                                        {registrationStep === 'details' && regMeta && (
                                            <div className="space-y-4 animate-fade-in-up">
                                                <h3 className="text-sm font-bold text-white">Confirm Graph Details</h3>
                                                <p className="text-xs text-zinc-500">Auto-filled from your Sheet's Graph Meta tab. Edit as needed.</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Graph Name</label>
                                                        <input type="text" value={regMeta.graphName} onChange={e => setRegMeta({...regMeta, graphName: e.target.value})} className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Creator</label>
                                                        <input type="text" value={regMeta.creator} onChange={e => setRegMeta({...regMeta, creator: e.target.value})} className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Description</label>
                                                    <textarea value={regMeta.description} onChange={e => setRegMeta({...regMeta, description: e.target.value})} className="w-full h-20 px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Organization</label>
                                                        <input type="text" value={regMeta.organization} onChange={e => setRegMeta({...regMeta, organization: e.target.value})} className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Update Frequency</label>
                                                        <select value={regMeta.updateFrequency} onChange={e => setRegMeta({...regMeta, updateFrequency: e.target.value})} className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                                                            <option value="daily">Daily</option>
                                                            <option value="weekly">Weekly</option>
                                                            <option value="biweekly">Biweekly</option>
                                                            <option value="monthly">Monthly</option>
                                                            <option value="quarterly">Quarterly</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 justify-end pt-2">
                                                    <button onClick={() => setRegistrationStep('source')} className="px-4 py-2 text-zinc-500 hover:text-white text-xs font-bold">← Back</button>
                                                    <button
                                                        onClick={handleRegisterGraph}
                                                        disabled={!regMeta.graphName || !regMeta.description || !regMeta.creator}
                                                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                    >
                                                        Register Graph →
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 3: Validating */}
                                        {registrationStep === 'validating' && (
                                            <div className="flex flex-col items-center justify-center py-8 animate-fade-in-up">
                                                <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mb-4"></div>
                                                <p className="text-sm text-white font-bold">Validating & ingesting your graph...</p>
                                                <p className="text-xs text-zinc-500 mt-1">Reading sheets, checking data quality, building cache</p>
                                            </div>
                                        )}

                                        {/* Result Step */}
                                        {registrationStep === 'result' && regResult && (
                                            <div className="flex flex-col items-center text-center py-10 space-y-6">
                                                <div className="w-20 h-20 bg-[#fdfcf2] border border-[#e8e6d9] rounded-full flex items-center justify-center text-3xl shadow-sm">
                                                    {regResult.ok ? '✅' : '❌'}
                                                </div>
                                                <div className="space-y-2">
                                                    <h3 className="text-xl font-serif italic text-[#1a1a1a]">{regResult.ok ? 'Graph Successfully Ingested' : 'Ingestion Conflict'}</h3>
                                                    <p className="text-xs text-[#6a6a6a] max-w-sm mx-auto">
                                                        {regResult.ok 
                                                            ? "Your report has been queued for semantic indexing. It will propagate to the network shortly." 
                                                            : regResult.error}
                                                    </p>
                                                </div>
                                                {regResult.ok && (
                                                    <div className="w-full p-6 bg-[#fdfcf2] border border-[#e8e6d9] rounded-2xl text-left space-y-3">
                                                        <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest">Network Access Endpoint</p>
                                                        <div className="flex items-center gap-2">
                                                            <code className="flex-1 p-3 bg-white border border-[#e8e6d9] rounded-xl text-[11px] font-mono break-all text-[#1a1a1a]">
                                                                {mcpConn?.mcpUrl || (mcpConn?.token ? `https://mcp.fodda.ai/c/${mcpConn.token}` : 'https://mcp.fodda.ai/c/:token')}
                                                            </code>
                                                        </div>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => { setRegistrationStep('idle'); loadMyGraphs(); }}
                                                    className="px-10 py-3 bg-[#1a1a1a] text-white font-bold text-xs rounded-xl shadow-lg"
                                                >
                                                    Back to Dashboard
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Graph List / Empty State */}
                                {registrationStep === 'idle' && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="p-8 bg-white border border-[#e8e6d9] rounded-2xl shadow-sm group hover:border-[#1a1a1a] transition-all cursor-pointer overflow-hidden relative" onClick={() => setRegistrationStep('source')}>
                                                <div className="relative z-10">
                                                    <span className="text-3xl block mb-4">✨</span>
                                                    <h3 className="text-sm font-bold text-[#1a1a1a] uppercase tracking-widest mb-1">New Graph</h3>
                                                    <p className="text-xs text-[#6a6a6a]">Ingest report or dataset</p>
                                                </div>
                                                <div className="absolute -right-4 -bottom-4 text-6xl opacity-[0.03] rotate-12 group-hover:opacity-[0.07] transition-all">📄</div>
                                            </div>
                                            
                                            <div className="bg-[#1a1a1a] p-8 rounded-2xl shadow-xl flex flex-col justify-center">
                                                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2 text-center">Active Graphs</p>
                                                <p className="text-4xl font-serif italic text-white text-center">{(myGraphs || []).length}</p>
                                            </div>

                                            <div className="p-8 bg-white border border-[#e8e6d9] rounded-2xl shadow-sm text-center flex flex-col justify-center">
                                                <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-2 font-mono">Monthly Queries</p>
                                                <p className="text-xl font-serif italic text-[#1a1a1a]">{(account as any).currentQueryCount || 0}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-xs font-bold text-[#1a1a1a] uppercase tracking-widest">Workspace Graphs</h3>
                                                <div className="flex items-center gap-4">
                                                    <button onClick={() => loadMyGraphs()} className="text-[10px] text-[#b4b1a1] hover:text-[#1a1a1a] uppercase tracking-widest font-bold font-serif italic">Refresh</button>
                                                    <button
                                                        onClick={() => setRegistrationStep('source')}
                                                        className="px-4 py-1.5 bg-[#1a1a1a] text-white text-[10px] font-bold uppercase tracking-widest rounded-lg"
                                                    >
                                                        + Register
                                                    </button>
                                                </div>
                                            </div>

                                            {loadingGraphs ? (
                                                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                                    <div className="w-12 h-12 border-4 border-[#e8e6d9] border-t-[#1a1a1a] rounded-full animate-spin"></div>
                                                    <p className="text-xs font-serif italic text-[#6a6a6a]">Syncing with network...</p>
                                                </div>
                                            ) : (myGraphs || []).length === 0 ? (
                                                <div className="py-24 bg-[#fdfcf2] border border-dashed border-[#e8e6d9] rounded-2xl flex flex-col items-center justify-center text-center px-8">
                                                    <div className="w-16 h-16 bg-white border border-[#e8e6d9] rounded-full flex items-center justify-center text-2xl mb-4 shadow-sm">📥</div>
                                                    <h4 className="text-lg font-serif italic text-[#1a1a1a] mb-2">Your Workspace is Empty</h4>
                                                    <p className="text-xs text-[#6a6a6a] max-w-xs mb-8">You haven't contributed any knowledge graphs yet. Upload your first report to activate your developer endpoint.</p>
                                                    <button onClick={() => setRegistrationStep('source')} className="px-10 py-3 bg-[#1a1a1a] text-white font-bold text-xs rounded-xl shadow-lg">Begin Ingestion</button>
                                                </div>
                                            ) : (
                                                <div className="space-y-8">
                                                    {myGraphs.map(g => (
                                                    <div key={g.graphSlug} className={`p-8 bg-white border rounded-3xl shadow-sm hover:shadow-md transition-all group flex flex-col gap-8 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.03)] ${
                                                        g.status === 'needs_revision' ? 'border-orange-500' : 'border-[#e8e6d9]'
                                                    }`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-6">
                                                                <div className="w-16 h-16 rounded-2xl bg-[#fdfcf2] border border-[#e8e6d9] flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                                                                    {g.headshotUrl ? <img src={g.headshotUrl} alt="" className="w-full h-full object-cover rounded-2xl" /> : '🧠'}
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <div className="flex items-center gap-3">
                                                                        <h4 className="text-base font-bold text-[#1a1a1a] uppercase tracking-wide">{g.graphName}</h4>
                                                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-colors ${
                                                                            g.status === 'active' || g.status === 'live' ? 'bg-[#10B981]/5 text-[#10B981] border-[#10B981]/20' 
                                                                            : g.status === 'needs_revision' ? 'bg-orange-50/50 text-orange-600 border-orange-200'
                                                                            : 'bg-[#F59E0B]/5 text-[#F59E0B] border-[#F59E0B]/20'
                                                                        }`}>
                                                                            {g.status}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-[#6a6a6a] line-clamp-1 max-w-lg font-serif italic">{g.oneLiner || g.description}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-6">
                                                                {(g.status === 'active' || g.status === 'live') && (
                                                                    <button 
                                                                        onClick={() => handleRefreshGraph(g.graphSlug)}
                                                                        className="text-[10px] font-bold text-[#b4b1a1] hover:text-[#1a1a1a] uppercase tracking-widest border-b border-dashed border-[#b4b1a1] pb-0.5 hover:border-[#1a1a1a] transition-all"
                                                                    >
                                                                        {refreshingSlug === g.graphSlug ? 'Refreshing...' : 'Re-index'}
                                                                    </button>
                                                                )}
                                                                <button className="w-10 h-10 rounded-full flex items-center justify-center text-[#b4b1a1] hover:text-[#1a1a1a] hover:bg-[#fdfcf2] transition-all border border-[#e8e6d9]">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2.5} /></svg>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Status-specific feedback */}
                                                        {g.status === 'needs_revision' && (
                                                            <div className="p-6 bg-orange-50 border border-orange-100 rounded-2xl relative overflow-hidden">
                                                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                                                    <svg className="w-12 h-12 text-orange-900" fill="currentColor" viewBox="0 0 24 24"><path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-orange-800 uppercase tracking-widest mb-2 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-orange-600 rounded-full"></span> Revision Feedback Required</p>
                                                                <p className="text-xs text-orange-800/70 font-serif italic leading-relaxed">{g.adminFeedback || 'Network ingestion failed semantic validation.'}</p>
                                                                <button
                                                                    onClick={() => { setRegistrationStep('source'); setRegSourceType('pdf'); setPdfUrl(g.pdfUrl || ''); setRegMeta(null); }}
                                                                    className="text-[10px] font-bold text-orange-700 hover:text-orange-900 mt-4 uppercase tracking-widest flex items-center gap-2 group"
                                                                >
                                                                    Modify & Resubmit <span className="group-hover:translate-x-1 transition-transform">→</span>
                                                                </button>
                                                            </div>
                                                        )}

                                                        <div className="grid grid-cols-4 gap-6 pt-6 border-t border-[#f3f1e8]">
                                                            {[
                                                                { label: g.sourceType === 'pdf' ? 'Trends Index' : 'Signals Index', val: g.trendCount || g.signalCount },
                                                                { label: g.sourceType === 'pdf' ? 'Semantic Nodes' : 'Pattern Nodes', val: g.evidenceCount || g.patternCount },
                                                                { label: 'Network Queries', val: g.queryCount },
                                                                { label: 'Total Queries', val: g.queryCount || 0 }
                                                            ].map(stat => (
                                                                <div key={stat.label} className="group/stat">
                                                                    <p className="text-[9px] text-[#b4b1a1] uppercase tracking-widest mb-1 group-hover/stat:text-[#1a1a1a] transition-colors">{stat.label}</p>
                                                                    <p className="text-sm font-bold text-[#1a1a1a] font-mono">{stat.val || 0}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        </div>
                                    </div>
                                )}

                                {/* Knowledge Standards */}
                                <footer className="p-6 bg-[#fdfcf2]/50 rounded-3xl border border-[#e8e6d9] text-center">
                                    <p className="text-[11px] text-[#6a6a6a] font-serif italic">
                                        Adhere to the <a href={`https://docs.google.com/spreadsheets/d/1LqUytJ_Su4CVZvGmxTxDylsQLKmd4yWr5nC8rIhcZAk`} target="_blank" rel="noopener noreferrer" className="text-[#1a1a1a] font-bold hover:underline">Fodda Semantic Standards</a> for high-rank network distribution. 
                                        Questions? <a href="mailto:hello@psfk.com" className="text-[#1a1a1a] font-bold hover:underline">Expert Support</a>
                                    </p>
                                </footer>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="space-y-10 max-w-4xl">
                                <header>
                                    <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-1">Configuration & Identity</p>
                                    <h2 className="text-3xl font-serif italic text-[#1a1a1a]">Account Settings</h2>
                                </header>

                                <div className="space-y-10">
                                    <section className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest px-1">Account Display Name</label>
                                            <input
                                                type="text"
                                                value={adminForm.name}
                                                onChange={e => setAdminForm({ ...adminForm, name: e.target.value })}
                                                className="w-full px-5 py-4 bg-white border border-[#e8e6d9] rounded-2xl text-sm text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest px-1">Institutional Context</label>
                                            <p className="text-[11px] text-[#6a6a6a] px-1 font-serif italic">Used to ground AI intelligence in your organization's specific reality.</p>
                                            {user.role === 'Owner' || user.role === 'Admin' ? (
                                                <textarea
                                                    value={adminForm.context}
                                                    onChange={e => setAdminForm({ ...adminForm, context: e.target.value })}
                                                    className="w-full h-40 px-5 py-4 bg-white border border-[#e8e6d9] rounded-2xl text-sm text-[#1a1a1a] focus:outline-none focus:border-[#1a1a1a] shadow-sm resize-none"
                                                />
                                            ) : (
                                                <div className="w-full px-5 py-4 bg-[#fdfcf2]/50 border border-[#e8e6d9] rounded-2xl text-sm text-[#6a6a6a] font-serif italic">
                                                    {adminForm.context || 'No company context set.'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Professional Services Toggle */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest px-1">Search Persona</label>
                                            <label className="flex items-start gap-4 p-6 bg-white border border-[#e8e6d9] rounded-2xl cursor-pointer hover:border-[#1a1a1a] transition-all group shadow-sm">
                                                <div className="relative mt-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={adminForm.isProfessionalServices}
                                                        onChange={e => setAdminForm({ ...adminForm, isProfessionalServices: e.target.checked })}
                                                        className="sr-only peer"
                                                        disabled={user.role !== 'Owner' && user.role !== 'Admin'}
                                                    />
                                                    <div className="w-10 h-6 bg-[#e8e6d9] rounded-full peer-checked:bg-[#1a1a1a] transition-colors"></div>
                                                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-[#1a1a1a] uppercase tracking-wide">Professional Services Mode</p>
                                                    <p className="text-[11px] text-[#6a6a6a] leading-relaxed font-serif italic">When enabled, AI framing adapts for agency/consultancy workflows on behalf of multiple clients.</p>
                                                </div>
                                            </label>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest px-1">Network Access</label>
                                            <p className="text-[11px] text-[#6a6a6a] px-1 font-serif italic">The following industry verticals are enabled for this account profile.</p>
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {(account.graphIds || []).map(gid => (
                                                    <span key={gid} className="px-3 py-1.5 bg-[#fdfcf2] border border-[#e8e6d9] rounded-full text-[10px] font-bold text-[#1a1a1a] uppercase tracking-widest shadow-sm">{gid}</span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-4 pt-6">
                                            <button
                                                onClick={() => { setAdminForm({ ...adminForm, name: account.name || '', context: account.accountContext || '', isProfessionalServices: !!account.isProfessionalServices, autoProvisionToggle: !!account.autoProvisionToggle, autoProvisionDomain: account.autoProvisionDomain || '' }); }}
                                                className="px-8 py-3 text-[#6a6a6a] hover:text-[#1a1a1a] text-xs font-bold font-serif italic transition-all"
                                            >Reset</button>
                                            <button
                                                disabled={adminForm.name === (account.name || '') && adminForm.context === (account.accountContext || '') && adminForm.isProfessionalServices === !!account.isProfessionalServices && adminForm.autoProvisionToggle === !!account.autoProvisionToggle && adminForm.autoProvisionDomain === (account.autoProvisionDomain || '')}
                                                onClick={handleAccountUpdate}
                                                className="px-10 py-3 bg-[#1a1a1a] text-white font-bold text-xs rounded-xl hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xl uppercase tracking-widest"
                                            >Save Changes</button>
                                        </div>
                                    </section>

                                    <section className="pt-10 border-t border-[#e8e6d9]">
                                        <div className="p-8 bg-red-50/30 border border-red-100 rounded-3xl space-y-4">
                                            <h3 className="text-[10px] font-bold text-red-600 uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Danger Zone</h3>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-[#1a1a1a] uppercase tracking-wide">API Key</p>
                                                    <p className="text-[10px] text-red-600/70 font-serif italic">Regenerating your API key will break all existing MCP integrations immediately.</p>
                                                </div>
                                                <button
                                                    onClick={handleRegenerateKey}
                                                    disabled={regeneratingKey}
                                                    className="px-6 py-2.5 bg-white border border-red-200 text-red-600 text-[10px] font-bold rounded-xl hover:bg-red-50 transition-all uppercase tracking-widest"
                                                >
                                                    {regeneratingKey ? 'Regenerating...' : 'Reset API Key'}
                                                </button>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}
                    </div >
                </div >
            </div >

            {/* Invite Modal Overlay */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[#1a1a1a]/40 backdrop-blur-sm" onClick={() => setIsInviteModalOpen(false)}>
                    <div className="bg-white p-10 rounded-3xl border border-[#e8e6d9] shadow-2xl w-full max-w-md animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <header className="mb-8">
                            <p className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest mb-1">Team Access</p>
                            <h3 className="text-2xl font-serif italic text-[#1a1a1a]">Invite Team Members</h3>
                        </header>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest px-1">Email Address</label>
                                <textarea
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    className="w-full px-5 py-4 bg-white border border-[#e8e6d9] rounded-2xl text-sm focus:outline-none focus:border-[#1a1a1a] placeholder:text-[#b4b1a1] shadow-sm resize-y min-h-[100px]"
                                    placeholder="colleague@psfk.com, another@psfk.com..."
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#b4b1a1] uppercase tracking-widest px-1">Role</label>
                                <div className="relative">
                                    <select
                                        value={inviteRole}
                                        onChange={e => setInviteRole(e.target.value)}
                                        className="w-full px-5 py-4 bg-white border border-[#e8e6d9] rounded-2xl text-sm focus:outline-none focus:border-[#1a1a1a] shadow-sm appearance-none cursor-pointer"
                                    >
                                        <option value="User">Standard User</option>
                                        <option value="Admin">Network Admin</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="w-4 h-4 text-[#b4b1a1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={2} /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-6 mt-10 items-center">
                            <button onClick={() => setIsInviteModalOpen(false)} className="text-xs font-bold font-serif italic text-[#6a6a6a] hover:text-[#1a1a1a] transition-all">Cancel</button>
                            <button
                                onClick={handleInviteUser}
                                disabled={sendingInvite || !inviteEmail}
                                className="px-10 py-3.5 bg-[#1a1a1a] text-white font-bold text-[10px] rounded-2xl shadow-xl hover:bg-black transition-all disabled:opacity-30 uppercase tracking-widest"
                            >
                                {sendingInvite ? 'Issuing...' : 'Issue Invites →'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
