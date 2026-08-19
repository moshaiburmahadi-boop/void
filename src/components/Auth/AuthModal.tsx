import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Database, AlertCircle, Sparkles, Loader2 } from 'lucide-react';

interface AuthModalProps {
  onOpenSQLHelper?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onOpenSQLHelper }) => {
  const { signIn, signUp, enterDemoMode, isConfigured } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message || 'Failed to sign in. Please check your credentials.');
        }
      } else {
        const { error: signUpError } = await signUp(email, password, username, fullName);
        if (signUpError) {
          setError(signUpError.message || 'Failed to sign up. Please try again.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95 p-4 overflow-y-auto">
      <main className="w-full max-w-md my-auto flex flex-col items-center justify-center relative">
        {/* Brand Logo */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#e5e2e1] mb-8 tracking-tight font-sans">
          Void
        </h1>

        {/* Database notice if not yet connected */}
        {!isConfigured && (
          <div className="w-full mb-6 p-3.5 bg-[#18181b] border border-[#27272a] rounded-2xl flex items-start gap-3 text-xs text-[#a1a1aa]">
            <Database className="w-4 h-4 text-[#1d9bf0] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-[#e5e2e1] font-semibold">Supabase Ready: </span>
              Connect your project URL & Anon Key in Settings or explore with live guest data.
              {onOpenSQLHelper && (
                <button
                  onClick={onOpenSQLHelper}
                  className="block mt-1 text-[#1d9bf0] hover:underline font-medium"
                >
                  View SQL Migration Schema →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Form Container */}
        <div className="w-full flex flex-col gap-4">
          {/* Toggle Group */}
          <div className="flex bg-[#131313] rounded-full p-1 w-full border border-[#27272a]">
            <button
              id="tab-login"
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 rounded-full py-2.5 text-center text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-[#e5e2e1] text-[#131313] shadow-md'
                  : 'text-[#89919d] hover:text-[#e5e2e1]'
              }`}
            >
              Login
            </button>
            <button
              id="tab-signup"
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 rounded-full py-2.5 text-center text-sm font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-[#e5e2e1] text-[#131313] shadow-md'
                  : 'text-[#89919d] hover:text-[#e5e2e1]'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span className="font-semibold">{error}</span>
              </div>
              {error.includes('Invalid path') && (
                <div className="text-[11px] text-red-200/80 pl-6 space-y-1">
                  <p>• Supabase Project Settings → <strong>API</strong> → Copy the <strong>anon public key</strong> (starts with <code className="bg-black/40 px-1 py-0.5 rounded">eyJhbGci...</code>).</p>
                  {onOpenSQLHelper && (
                    <button
                      type="button"
                      onClick={onOpenSQLHelper}
                      className="text-[#1d9bf0] underline font-medium block pt-1"
                    >
                      Update API Keys in Settings →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
            {mode === 'signup' && (
              <>
                <div>
                  <input
                    id="input-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full bg-[#131313] border border-[#27272a] text-[#e5e2e1] placeholder-[#89919d] rounded-full px-5 py-3.5 outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] text-sm transition-all"
                  />
                </div>
                <div>
                  <input
                    id="input-username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    placeholder="Username (e.g. alex_chen)"
                    className="w-full bg-[#131313] border border-[#27272a] text-[#e5e2e1] placeholder-[#89919d] rounded-full px-5 py-3.5 outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] text-sm transition-all"
                  />
                </div>
              </>
            )}

            <div>
              <input
                id="input-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-[#131313] border border-[#27272a] text-[#e5e2e1] placeholder-[#89919d] rounded-full px-5 py-3.5 outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] text-sm transition-all"
              />
            </div>

            <div>
              <input
                id="input-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                minLength={6}
                className="w-full bg-[#131313] border border-[#27272a] text-[#e5e2e1] placeholder-[#89919d] rounded-full px-5 py-3.5 outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] text-sm transition-all"
              />
            </div>

            {/* Action Button */}
            <button
              id="btn-submit"
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#e5e2e1] text-[#131313] font-bold text-base rounded-full py-3.5 hover:bg-white active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center w-full my-2">
            <div className="flex-grow border-t border-[#27272a]" />
            <span className="px-3 text-[#89919d] text-[11px] font-semibold uppercase tracking-widest">
              or
            </span>
            <div className="flex-grow border-t border-[#27272a]" />
          </div>

          {/* Instant Demo Access Button */}
          <button
            id="btn-guest-mode"
            type="button"
            onClick={enterDemoMode}
            className="w-full bg-[#18181b] border border-[#27272a] text-[#e5e2e1] rounded-full py-3.5 text-sm font-semibold flex justify-center items-center gap-2 hover:bg-[#27272a] hover:border-[#3f3f46] transition-all active:scale-[0.99] cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#1d9bf0]" />
            Continue as Guest (Demo Mode)
          </button>

          {/* Social Logins */}
          <div className="flex flex-col gap-2.5 w-full">
            <button
              type="button"
              onClick={enterDemoMode}
              className="w-full bg-[#e5e2e1] text-[#131313] rounded-full py-3.5 text-sm font-semibold flex justify-center items-center gap-3 hover:bg-white transition-colors active:scale-[0.99] cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={enterDemoMode}
              className="w-full bg-[#e5e2e1] text-[#131313] rounded-full py-3.5 text-sm font-semibold flex justify-center items-center gap-3 hover:bg-white transition-colors active:scale-[0.99] cursor-pointer"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.24-.86 3.44-.88 1.5-.06 2.57.57 3.23 1.48-2.69 1.47-2.25 5.16.32 6.12-.66 1.76-1.57 3.5-3.07 5.45zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </button>
          </div>
        </div>

        {/* Footer Links */}
        <footer className="w-full mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[#89919d] text-xs">
          <a href="#" className="hover:text-[#e5e2e1] transition-colors">Help</a>
          <span className="opacity-30">•</span>
          <a href="#" className="hover:text-[#e5e2e1] transition-colors">Privacy</a>
          <span className="opacity-30">•</span>
          <a href="#" className="hover:text-[#e5e2e1] transition-colors">Terms</a>
          <span className="opacity-30">•</span>
          <a href="#" className="hover:text-[#e5e2e1] transition-colors">About</a>
        </footer>
      </main>
    </div>
  );
};
