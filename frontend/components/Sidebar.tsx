
import React, { useState, useEffect } from 'react';
import { dataService } from '../../shared/dataService';
import { KnowledgeGraph } from '../../shared/types';
import { API_BASE_URL } from '../apiConfig';

interface SidebarProps {
  currentVertical: string;
  onVerticalChange: (v: string) => void;
  onQuestionClick: (q: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onAdminClick: () => void;
}

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const PSFKLogo = () => (
  <img 
    src="https://ucarecdn.com/97231f29-210c-4df4-bcb7-80c2234779e8/psfklogo40x40.png" 
    alt="PSFK" 
    className="mr-2 h-4 w-4 flex-shrink-0 object-contain rounded-sm" 
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      target.style.display = 'none';
    }}
  />
);

const ApiModal: React.FC<{ vertical: string; isOpen: boolean; onClose: () => void }> = ({ vertical, isOpen, onClose }) => {
  const [copied, setCopied] = useState<'url' | 'snippet' | null>(null);
  const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'openapi'>('curl');
  const LIVE_URL = API_BASE_URL;
  
  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: 'url' | 'snippet') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const curlCmd = `curl -X POST ${LIVE_URL}/api/query \\
-H "Content-Type: application/json" \\
-d '{
  "query": "omnichannel",
  "vertical": "${vertical}"
}'`;

  const pythonTool = `get_retail_context_tool = {
    "name": "get_retail_context",
    "description": "Retrieves curated ${vertical.toLowerCase()} expertise and context for a specific query and vertical. Use this to ground answers in specialized ${vertical.toLowerCase()} knowledge.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The specific concept or topic to search for (e.g., 'omnichannel', 'biotech')."
            },
            "vertical": {
                "type": "string",
                "description": "The industry vertical (e.g., 'Retail', 'Beauty', 'Sports')."
            }
        },
        "required": ["query", "vertical"]
    }
}`;

  const openApiSpec = `openapi: 3.0.0
info:
  title: Fodda Contextual Demo API
  description: API to retrieve curated ${vertical.toLowerCase()} context for LLM grounding.
  version: 1.0.0
servers:
  - url: ${LIVE_URL}/api
paths:
  /query:
    post:
      operationId: getRetailContext
      summary: Retrieve context
      description: Returns curated text context based on a query and vertical.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  type: string
                  description: The topic to search (e.g., "omnichannel")
                vertical:
                  type: string
                  description: The industry vertical (e.g., "${vertical}")
              required:
                - query
                - vertical
      responses:
        '200':
          description: Successful retrieval of context
          content:
            application/json:
              schema:
                type: object
                additionalProperties: true`;

  const getContent = () => {
    switch(activeTab) {
      case 'curl': return { text: curlCmd, label: 'Shell / CURL' };
      case 'python': return { text: pythonTool, label: 'Vertex AI Python SDK' };
      case 'openapi': return { text: openApiSpec, label: 'OpenAPI / YAML Spec' };
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up border border-stone-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50 shrink-0">
          <div>
            <h3 className="font-serif text-xl font-bold text-stone-900">Developer Integration Portal</h3>
            <p className="text-[10px] text-stone-500 mt-1 uppercase tracking-widest font-bold">Status: <span className="text-green-600">Live & Operational</span></p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Base Endpoint Info */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.2em]">Base Endpoint</h4>
            <div className="flex items-center space-x-2">
               <div className="flex-1 p-3 bg-stone-100 border border-stone-200 rounded-lg font-mono text-[10px] text-stone-600 break-all select-all">
                {LIVE_URL}
               </div>
               <button 
                  onClick={() => copyToClipboard(LIVE_URL, 'url')}
                  className={`p-3 rounded-lg transition-all shadow-sm shrink-0 border flex items-center justify-center ${
                    copied === 'url' 
                    ? 'bg-green-50 border-green-200 text-green-600' 
                    : 'bg-white border-stone-200 text-stone-500 hover:border-fodda-accent hover:text-fodda-accent'
                  }`}
                  title="Copy Endpoint"
               >
                 {copied === 'url' ? <CheckIcon /> : <CopyIcon />}
               </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
            <h4 className="text-[11px] font-bold text-purple-900 uppercase tracking-wider mb-1">Enterprise Grounding</h4>
            <p className="text-[11px] text-purple-700 leading-relaxed">
              Use these specifications to connect the <strong>Fodda {vertical} Graph</strong> directly to your own LLM agents, custom applications, or Vertex AI extensions.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-stone-200">
            {(['curl', 'python', 'openapi'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-[10px] font-bold uppercase tracking-tighter transition-all border-b-2 ${
                  activeTab === tab 
                    ? 'border-fodda-accent text-fodda-accent bg-purple-50/50' 
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab === 'curl' ? 'CURL (Test)' : tab === 'python' ? 'Python SDK' : 'OpenAPI Spec'}
              </button>
            ))}
          </div>

          {/* Code Content */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{getContent().label}</span>
              <button 
                onClick={() => copyToClipboard(getContent().text, 'snippet')}
                className={`p-1.5 rounded transition-colors flex items-center space-x-1.5 ${
                  copied === 'snippet'
                  ? 'text-green-600 bg-green-50'
                  : 'text-stone-400 hover:text-fodda-accent hover:bg-purple-50'
                }`}
                title="Copy Snippet"
              >
                {copied === 'snippet' ? (
                  <>
                    <CheckIcon />
                    <span className="text-[9px] font-bold uppercase">Copied</span>
                  </>
                ) : (
                  <>
                    <CopyIcon />
                    <span className="text-[9px] font-bold uppercase">Copy Snippet</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-stone-900 rounded-xl p-5 font-mono text-[10px] text-stone-300 overflow-x-auto relative shadow-inner group/code">
              <pre className="whitespace-pre">
                {getContent().text}
              </pre>
            </div>
          </div>
        </div>

        <div className="p-4 bg-stone-50 border-t border-stone-100 text-center shrink-0">
           <button onClick={onClose} className="text-xs font-bold text-fodda-accent uppercase tracking-widest">Close Documentation</button>
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentVertical, onVerticalChange, isOpen, onClose, onAdminClick }) => {
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([]);

  useEffect(() => {
    setGraphs(dataService.getGraphs());
  }, [isOpen]);

  const futureVerticals = [
    { 
      name: 'Culture', 
      person: 'Ben Dietz', 
      label: 'The SIC Graph',
      img: 'https://ucarecdn.com/e1711558-ce22-46a2-9720-2423a35d8edf/BENDIETZ.png' 
    },
    { 
      name: 'Media', 
      person: 'Johanna Salazar', 
      label: 'Media Machine',
      img: 'https://ucarecdn.com/455c0584-e8f9-442d-8bb9-348bc12b03e4/JOHANNASALAZAR.png' 
    },
    { 
      name: 'Trends', 
      person: 'Rohit Bhargava', 
      label: 'Non-Obvious Graph',
      img: 'https://ucarecdn.com/a872c8c0-1b7b-4218-b4b6-3da3865c3e21/ROHITBHARGAVA.png' 
    },
  ];

  return (
    <>
      <ApiModal vertical={currentVertical} isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} />
      {isOpen && <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 h-full bg-stone-50 border-r border-stone-200 flex flex-col p-6 transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 flex items-center justify-between">
          <div className="group relative cursor-help">
            <h1 className="font-serif text-2xl font-bold text-stone-900">Fodda</h1>
            <p className="text-[10px] uppercase tracking-widest text-stone-500 mt-1 font-medium">Contextual Intelligence</p>
            <div className="absolute left-0 top-full mt-2 w-56 p-3 bg-stone-900 text-stone-50 text-[11px] leading-relaxed rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none border border-stone-700">
              Fodda turns curated insights into AI-ready knowledge graphs, enabling grounded answers with traceable evidence.
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-1 text-stone-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-8 pr-1 -mr-1">
          {/* Active Graphs */}
          <div>
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 pl-1">Knowledge Graphs</h2>
            <div className="space-y-1.5">
              {graphs.map((g) => (
                <button
                  key={g.id}
                  onClick={() => { onVerticalChange(g.id); onClose(); }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between group ${
                    currentVertical === g.id 
                      ? 'bg-white text-stone-900 shadow-sm border border-stone-200 ring-1 ring-stone-900/5' 
                      : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                  }`}
                >
                  <div className="flex items-center">
                    <PSFKLogo />
                    <span className="truncate pr-2">{g.name}</span>
                  </div>
                  {currentVertical === g.id && <div className="w-1.5 h-1.5 shrink-0 rounded-full bg-fodda-accent animate-pulse"></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Graph Pipeline */}
          <div>
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 pl-1">Graph Pipeline</h2>
            <div className="space-y-2.5">
              {futureVerticals.map((fv) => (
                <div key={fv.name} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-stone-200 bg-white shadow-sm hover:border-fodda-accent/30 transition-all group cursor-not-allowed opacity-80 hover:opacity-100">
                  <div className="flex items-center space-x-3">
                    <div className="relative h-10 w-10 shrink-0">
                      <img src={fv.img} alt={fv.person} className="h-full w-full rounded-lg border border-stone-100 object-cover bg-stone-200" />
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-stone-100">
                        <svg className="w-2.5 h-2.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <span className="text-stone-800 font-bold text-xs leading-none">{fv.name}</span>
                        <span className="ml-1.5 text-[7px] font-bold text-stone-400 uppercase tracking-tighter">Coming Soon</span>
                      </div>
                      <span className="text-[9px] text-stone-400 mt-1 font-medium">Curated by {fv.person}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-stone-200 space-y-3">
          <button onClick={() => setIsApiModalOpen(true)} className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-white shadow-sm hover:border-fodda-accent transition-all group">
              <div className="text-left">
                <div className="text-[11px] font-bold text-stone-700 group-hover:text-fodda-accent transition-colors">Developer API</div>
                <div className="text-[9px] text-stone-400 uppercase font-semibold">Grounded Context</div>
              </div>
              <div className="p-1.5 bg-stone-50 rounded-lg group-hover:bg-purple-50 transition-colors">
                <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-fodda-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              </div>
          </button>
          
          <div className="flex justify-between items-center px-1 text-[10px] text-stone-400 font-medium pt-4 border-t border-stone-100">
             <div className="flex items-center space-x-2.5">
               <a href="https://www.fodda.ai" target="_blank" rel="noopener noreferrer" className="hover:text-fodda-accent transition-colors">Fodda AI</a>
               <span className="text-stone-300">•</span>
               <a href="https://www.psfk.com" target="_blank" rel="noopener noreferrer" className="hover:text-fodda-accent transition-colors">PSFK</a>
               <span className="text-stone-300">•</span>
               <button onClick={onAdminClick} className="flex items-center hover:text-fodda-accent transition-colors group">
                 <svg className="w-2.5 h-2.5 mr-1 text-stone-400 group-hover:text-fodda-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                 Admin
               </button>
             </div>
          </div>
        </div>
      </div>
    </>
  );
};
