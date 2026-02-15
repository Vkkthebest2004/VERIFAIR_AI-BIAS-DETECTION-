"use client";

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { DragDropUpload } from '@/components/DragDropUpload';
import { Activity, History, FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Type Definitions ---




interface AuditHistoryItem {
  id: number;
  filename: string;
  total_sentences: number;
  bias_flags_count: number;
  created_at: string;
}

export default function Home() {
  const { user, loading, logout, getToken } = useAuth();
  const router = useRouter();

  const [isUploading, setIsUploading] = useState(false);
  const [history, setHistory] = useState<AuditHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(5);

  // --- Fetch History ---
  const fetchHistory = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoadingHistory(false);
      return;
    }

    try {
      const res = await axios.get('http://localhost:8000/api/v1/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Sort by newest
      setHistory(res.data.sort((a: AuditHistoryItem, b: AuditHistoryItem) => b.id - a.id));
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.log("Session expired while fetching history.");
          logout();
          return; // Stop here
        }
        console.error("Failed to load history - Response Error:", {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers
        });
      } else if (error.request) {
        console.error("Failed to load history - No Response:", error.request);
      } else {
        console.error("Failed to load history - Setup Error:", error.message);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [getToken, logout]);

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else if (!loading) {
      router.push("/login");
    }
  }, [user, loading, fetchHistory, router]);


  const handleUpload = async (files: File[], textInputs: string[]) => {
    setIsUploading(true);
    const token = getToken();
    if (!token) return;

    try {
      const formData = new FormData();

      // Append files
      if (files && files.length > 0) {
        files.forEach(file => {
          formData.append('files', file);
        });
      }

      // Append each text input as a separate item
      if (textInputs && textInputs.length > 0) {
        textInputs.forEach((text, idx) => {
          if (text.trim()) {
            // Create a blob for each text and append as a file
            const blob = new Blob([text], { type: 'text/plain' });
            const textFile = new File([blob], `text_input_${idx + 1}.txt`, { type: 'text/plain' });
            formData.append('files', textFile);
          }
        });
      }

      const response = await axios.post('http://localhost:8000/api/v1/audit', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });

      const results = response.data;
      if (Array.isArray(results) && results.length > 0) {
        // Redirect to the first result page (or batch summary if multiple)
        const firstRecordId = results[0].record_id;
        router.push(`/results/${firstRecordId}`);
      } else {
        fetchHistory(); // Refresh history list
      }

    } catch (error) {
      console.error("Upload failed", error);
      alert("Error analyzing content. Check backend console.");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
    </div>
  );
  if (!user) return null; // Auth effect handles redirect

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans selection:bg-indigo-500/30">
      <header className="max-w-7xl mx-auto mb-12 flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Activity className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
              Verifair <span className="text-indigo-500">.ai</span>
            </h1>
            <p className="text-slate-400 text-sm font-medium tracking-wide">Sociotechnical Bias Analysis Engine</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/selection-bias')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Selection Bias
            </button>
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-slate-300">{user.email}</p>
              <p className="text-xs text-emerald-400 flex items-center justify-end mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
                System Online
              </p>
            </div>
          </div>
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 border-2 border-slate-800 shadow-xl cursor-pointer"
            title="User Profile"
            onClick={logout}
          ></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar history */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="glass-panel p-5 rounded-xl border border-slate-800 bg-slate-900/40">
            <div
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center group-hover:text-slate-300 transition-colors">
                <History className="w-4 h-4 mr-2" /> Recent Audits
              </h3>
              {isSidebarOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
              )}
            </div>

            {isSidebarOpen && (
              <div className="space-y-3 mt-4 animate-in slide-in-from-top-2 duration-200">
                {loadingHistory ? (
                  <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-600" /></div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No previous scans found.</p>
                ) : (
                  <>
                    {history.slice(0, visibleHistoryCount).map(item => (
                      <div
                        key={item.id}
                        onClick={() => router.push(`/results/${item.id}`)}
                        className="group p-3 rounded-lg hover:bg-slate-800/80 cursor-pointer transition-all border border-transparent hover:border-slate-700"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <FileText className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                          <span className="text-[10px] text-slate-600 font-mono">{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-300 truncate group-hover:text-white transition-colors">{item.filename}</p>
                        <div className="flex items-center mt-2 space-x-2">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded font-mono", item.bias_flags_count > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400")}>
                            {item.bias_flags_count} Flags
                          </span>
                          <span className="text-[10px] text-slate-600">{item.total_sentences} sentences</span>
                        </div>
                      </div>
                    ))}

                    {history.length > 5 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisibleHistoryCount(visibleHistoryCount === 5 ? history.length : 5);
                        }}
                        className="w-full py-2 text-xs font-medium text-slate-500 hover:text-indigo-400 border-t border-slate-800/50 mt-2 flex items-center justify-center gap-1 transition-colors"
                      >
                        {visibleHistoryCount === 5 ? (
                          <>Show All ({history.length}) <ChevronDown className="w-3 h-3" /></>
                        ) : (
                          <>Show Less <ChevronUp className="w-3 h-3" /></>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-9 space-y-8">
          {/* Upload Zone */}
          <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-900/20 backdrop-blur-md shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-white mb-2">Initialize Analysis</h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Upload documents or paste multiple texts (up to 50 items) to perform a deep-learning based sociotechnical bias audit with overall conclusions.
              </p>
            </div>
            <DragDropUpload onUpload={handleUpload} isUploading={isUploading} />
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center text-slate-500 text-sm">
            <div className="p-4 rounded-xl border border-slate-800/50 bg-slate-900/20 hover:border-indigo-500/30 transition-colors">
              <strong className="block text-indigo-400 mb-1">Z-Score + WEAT/SEAT</strong>
              Statistical anomaly &amp; differential association bias detection.
            </div>
            <div className="p-4 rounded-xl border border-slate-800/50 bg-slate-900/20 hover:border-purple-500/30 transition-colors">
              <strong className="block text-purple-400 mb-1">Stereotype Detection</strong>
              13-category StereoSet + CrowS-Pairs pattern matching.
            </div>
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/10 hover:border-red-500/40 transition-colors">
              <strong className="block text-red-400 mb-1">Hate Speech (3-Layer)</strong>
              Dynabench RoBERTa + ToxiGen + Lexicon ensemble.
            </div>
            <div className="p-4 rounded-xl border border-slate-800/50 bg-slate-900/20 hover:border-cyan-500/30 transition-colors">
              <strong className="block text-cyan-400 mb-1">Selection Bias</strong>
              Four-Fifths Rule, Chi-Square, adverse impact ratio.
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-800/50 pt-8 pb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-400">Verifair</span>
            <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono">
              v3.1.0
            </span>
          </div>
          <p>&copy; {new Date().getFullYear()} Verifair. AI-Powered Bias Detection.</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
              GitHub
            </a>
            <a href="/selection-bias" className="hover:text-slate-300 transition-colors">
              Selection Bias
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
