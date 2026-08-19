import React, { useState } from 'react';
import { SCHEMA_SQL, supabaseUrl, updateSupabaseCredentials, isSupabaseConfigured } from '../lib/supabase';
import { Copy, Check, X, Database, Terminal, KeyRound, ExternalLink, ShieldCheck } from 'lucide-react';

interface SQLModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SQLModal: React.FC<SQLModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [urlInput, setUrlInput] = useState(supabaseUrl === 'https://demo-placeholder.supabase.co' ? '' : supabaseUrl);
  const [keyInput, setKeyInput] = useState('');
  const [activeSection, setActiveSection] = useState<'sql' | 'credentials'>('sql');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput || !keyInput) return;
    updateSupabaseCredentials(urlInput, keyInput);
    setSavedSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#121212] border border-[#27272a] rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#27272a] flex items-center justify-between bg-[#18181b]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1d9bf0]/10 rounded-xl text-[#1d9bf0]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#e5e2e1]">Supabase Setup & SQL Migrations</h2>
              <p className="text-xs text-[#89919d]">
                Schema, RLS policies, Realtime configuration & credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#89919d] hover:text-[#e5e2e1] hover:bg-[#27272a] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#27272a] px-6 bg-[#131313]">
          <button
            onClick={() => setActiveSection('sql')}
            className={`py-3.5 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeSection === 'sql'
                ? 'border-[#1d9bf0] text-[#1d9bf0]'
                : 'border-transparent text-[#89919d] hover:text-[#e5e2e1]'
            }`}
          >
            <Terminal className="w-4 h-4" />
            SQL Migration Script (5 Tables + RLS)
          </button>
          <button
            onClick={() => setActiveSection('credentials')}
            className={`py-3.5 px-4 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeSection === 'credentials'
                ? 'border-[#1d9bf0] text-[#1d9bf0]'
                : 'border-transparent text-[#89919d] hover:text-[#e5e2e1]'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Connect Live Supabase Keys
            {isSupabaseConfigured && (
              <span className="w-2 h-2 bg-green-500 rounded-full inline-block ml-1" />
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeSection === 'sql' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#1d9bf0] font-medium bg-[#1d9bf0]/10 px-3 py-1.5 rounded-full border border-[#1d9bf0]/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Ready to run in Supabase SQL Editor
                </div>
                <button
                  onClick={handleCopySQL}
                  className="px-4 py-2 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white text-xs font-bold rounded-full flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'SQL Copied!' : 'Copy SQL Script'}
                </button>
              </div>

              {/* Instructions steps */}
              <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 text-xs text-[#a1a1aa] space-y-2">
                <p className="font-semibold text-[#e5e2e1] text-sm">How to execute in Supabase:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open your Supabase Project Dashboard (<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-[#1d9bf0] hover:underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-3 h-3" /></a>).</li>
                  <li>Click on <strong>SQL Editor</strong> in the left sidebar.</li>
                  <li>Paste this script and click <strong>Run</strong>.</li>
                  <li>It automatically provisions: <code className="text-[#99cbff]">profiles</code>, <code className="text-[#99cbff]">posts</code>, <code className="text-[#99cbff]">likes</code>, <code className="text-[#99cbff]">messages</code>, <code className="text-[#99cbff]">notifications</code>, plus RLS security and Realtime publications!</li>
                </ol>
              </div>

              {/* Code display */}
              <div className="relative">
                <pre className="bg-[#0a0a0a] border border-[#27272a] rounded-2xl p-4 text-xs font-mono text-[#cfe5ff] overflow-x-auto max-h-[350px] leading-relaxed">
                  {SCHEMA_SQL}
                </pre>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveCredentials} className="space-y-4 max-w-lg mx-auto py-4">
              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl text-xs text-[#a1a1aa]">
                <p className="text-[#e5e2e1] font-semibold text-sm mb-1">Enter your Supabase Project Keys</p>
                Find these in your Supabase Dashboard under <strong>Project Settings → API</strong>.
              </div>

              {savedSuccess && (
                <div className="p-3 bg-green-950/40 border border-green-800 rounded-xl text-green-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Credentials saved! Reloading client connection...</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Project URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://xyzcompany.supabase.co"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#27272a] text-[#e5e2e1] placeholder-[#52525b] rounded-xl px-4 py-3 text-sm focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1.5">
                  Anon / Public API Key (VITE_SUPABASE_ANON_KEY)
                </label>
                <input
                  type="password"
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#27272a] text-[#e5e2e1] placeholder-[#52525b] rounded-xl px-4 py-3 text-sm focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold rounded-full text-sm transition-all shadow-lg active:scale-98 cursor-pointer"
                >
                  Save & Connect Supabase
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#27272a] bg-[#18181b] flex justify-between items-center text-xs text-[#89919d]">
          <span>Void v1.0 • Supabase Realtime Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#e5e2e1] rounded-full font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
