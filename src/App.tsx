import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Copy, ExternalLink, Loader2, AlertCircle, 
  TerminalSquare
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility for Tailwind Classes ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Main Application Component ---
export default function App() {
  // State: Stats
  const [stats, setStats] = useState({ total: 0, business: 0, plus: 0 });
  
  // State: Form Inputs
  const [plan, setPlan] = useState<'business' | 'plus'>('business');
  const [paymentMethod, setPaymentMethod] = useState('direct');
  const [currency, setCurrency] = useState('IDR');
  const [jsonInput, setJsonInput] = useState('');
  
  // State: Processing
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resultLink, setResultLink] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load stats from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gpt-checkout-stats');
    if (saved) {
      try {
        setStats(JSON.parse(saved));
      } catch (e) {
        console.error("Could not parse stats", e);
      }
    }
  }, []);

  // Helper to persist stats
  const saveStats = (newStats: typeof stats) => {
    setStats(newStats);
    localStorage.setItem('gpt-checkout-stats', JSON.stringify(newStats));
  };

  const handleGenerate = async () => {
    setStatus('idle');
    setErrorMsg('');

    // 1. Validation
    if (!jsonInput.trim()) {
      setErrorMsg('Please paste the Auth Session JSON payload below.');
      setStatus('error');
      return;
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonInput);
    } catch (e) {
      setErrorMsg('Invalid JSON format. Please ensure it is valid JSON.');
      setStatus('error');
      return;
    }

    // Extract access token and account ID
    const accessToken = parsedData.accessToken || parsedData.access_token || parsedData.token;
    // Mengambil account ID dari JSON (Penting untuk deteksi region IDR)
    const accountId = parsedData.account?.id || parsedData.user?.id || "";
    
    if (!accessToken) {
      setErrorMsg('JSON must contain an "accessToken" property.');
      setStatus('error');
      return;
    }

    setStatus('loading');

    try {
      const response = await fetch('/api/generate-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessToken,
          accountId, // <-- INI YANG BARU, MENGIRIM ACCOUNT ID KE BACKEND
          planType: plan
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate checkout link');
      }

      if (data.url) {
        setResultLink(data.url);
        setStatus('success');
        
        saveStats({
          total: stats.total + 1,
          business: plan === 'business' ? stats.business + 1 : stats.business,
          plus: plan === 'plus' ? stats.plus + 1 : stats.plus,
        });
      } else {
        throw new Error('No URL returned from backend');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An unexpected error occurred while communicating with the proxy.');
      setStatus('error');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resultLink);
    // Optional tooltip or toast feedback could be added here
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 p-4 md:p-8 font-sans flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        
        {/* Header Section */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 border-b border-white/5 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-500">
              Checkout Generator
            </h1>
            <p className="text-slate-500 text-sm mt-1">GPT subscription checkout link provisioning system</p>
          </div>
          <div className="flex gap-3">
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-400">API Live</span>
            </div>
          </div>
        </header>

        {/* Stats Dashboard Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <StatCard label="Total Generated" value={stats.total} color="blue" />
          <StatCard label="Plus Subscriptions" value={stats.plus} color="green" />
          <StatCard label="Business Plan" value={stats.business} color="purple" />
        </div>

        {/* Main Content Split */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-8">
          
          {/* Left side: Configuration */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col gap-6 h-full shadow-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/5 w-full sm:w-auto">
                  <button
                    onClick={() => setPlan('plus')}
                    className={cn("flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-medium transition-colors", plan === 'plus' ? "bg-purple-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}
                  >
                    Plus Plan
                  </button>
                  <button
                    onClick={() => setPlan('business')}
                    className={cn("flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-medium transition-colors", plan === 'business' ? "bg-purple-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}
                  >
                    Business Plan
                  </button>
                </div>
                <div className="flex gap-4 w-full sm:w-auto">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-tighter">Currency</label>
                    <select 
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded px-3 py-2 sm:py-1 text-sm outline-none text-slate-300 w-full"
                    >
                      <option value="IDR">IDR (Rp)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] uppercase text-slate-500 font-bold tracking-tighter">Method</label>
                    <select 
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded px-3 py-2 sm:py-1 text-sm outline-none text-slate-300 w-full"
                    >
                      <option value="direct">Direct Checkout</option>
                      <option value="invoice">Stripe Link</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
                <label className="text-xs text-slate-400 flex justify-between">
                  <span>Paste Auth/Session JSON</span>
                  <span className="text-purple-400 opacity-70 italic">Required*</span>
                </label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => {
                    setJsonInput(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                  }}
                  className="flex-1 w-full bg-black/60 border border-white/10 rounded-xl p-4 font-mono text-sm text-purple-300 resize-none focus:ring-1 focus:ring-purple-500 outline-none"
                  placeholder='{ "accessToken": "eyJhbG...", "user": { "id": "user-8X3..." }, "plan_type": "free" }'
                  spellCheck={false}
                />
              </div>

              {status === 'error' && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{errorMsg}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={status === 'loading'}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl font-bold lg:text-lg text-white hover:brightness-110 transition-all shadow-xl shadow-purple-900/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Session...
                  </>
                ) : (
                  <>Generate Checkout Session</>
                )}
              </button>
            </div>
          </div>

          {/* Right side: Results/Status */}
          <div className="lg:col-span-5 flex flex-col mt-8 lg:mt-0">
            {status === 'success' ? (
              <div className="flex-1 bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
                {/* Success Badge */}
                <div className="w-20 h-20 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mb-6 z-10">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>

                <h2 className="text-xl font-bold text-white mb-2 text-center z-10">Checkout link created!</h2>
                <p className="text-slate-400 text-sm mb-8 text-center px-4 z-10">Validated against Stripe Live and OpenAI Payment Gateway.</p>

                <div className="w-full bg-black/40 border border-white/5 rounded-lg p-4 mb-8 z-10">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Link Preview</div>
                  <div className="text-green-400/80 font-mono text-xs truncate filter blur-[2px] opacity-60">
                    {resultLink}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-auto z-10">
                  <button 
                    onClick={copyToClipboard}
                    className="py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 text-sm transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </button>
                  <a 
                    href={resultLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2 text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Link
                  </a>
                </div>

                {/* Decorative element */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-green-500/10 blur-[60px] rounded-full pointer-events-none"></div>
              </div>
            ) : (
              <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px]">
                {status === 'loading' ? (
                  <div className="flex flex-col items-center gap-4 text-slate-400 animate-pulse">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
                    <p className="font-mono text-sm uppercase tracking-widest">Processing</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-slate-600">
                    <TerminalSquare className="w-12 h-12 opacity-20" />
                    <p className="text-sm">Link preview will appear here</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer/Notes */}
        <div className="mt-auto flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-600 border-t border-white/5 pt-4 uppercase tracking-[0.2em] font-semibold gap-4">
          <div className="flex gap-4 sm:gap-8 flex-wrap justify-center sm:justify-start">
            <span>Version 4.2.0-STABLE</span>
            <span>Cloudflare Proxy Enabled</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-400">Encryption:</span>
            <span className="bg-white/5 px-2 py-0.5 rounded text-indigo-400">AES-256-GCM</span>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- Reusable Sub-components ---

interface StatCardProps {
  label: string;
  value: number;
  color: 'purple' | 'green' | 'blue';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorStyles = {
    purple: 'bg-indigo-500 w-1/3',
    green: 'bg-green-500 w-1/2',
    blue: 'bg-purple-500 w-3/4',
  };
  
  const textStyles = {
    purple: 'text-indigo-400',
    green: 'text-green-400',
    blue: 'text-white',
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 flex flex-col gap-1 backdrop-blur-md">
      <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
      <span className={cn("text-3xl font-mono", textStyles[color])}>{value.toLocaleString()}</span>
      <div className="mt-4 w-full h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", colorStyles[color])}></div>
      </div>
    </div>
  );
}


