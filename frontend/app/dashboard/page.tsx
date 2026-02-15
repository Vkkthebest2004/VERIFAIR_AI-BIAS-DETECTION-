"use client";

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { DragDropUpload } from '@/components/DragDropUpload';
import { Activity, History, FileText, Loader2, ChevronDown, ChevronUp, Sun, Moon, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditHistoryItem {
    id: number;
    filename: string;
    total_sentences: number;
    bias_flags_count: number;
    created_at: string;
}

export default function DashboardPage() {
    const { user, loading, logout, getToken } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();

    const [isUploading, setIsUploading] = useState(false);
    const [history, setHistory] = useState<AuditHistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [visibleHistoryCount, setVisibleHistoryCount] = useState(5);

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
            setHistory(res.data.sort((a: AuditHistoryItem, b: AuditHistoryItem) => b.id - a.id));
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    logout();
                    return;
                }
                console.error("Failed to load history:", error.response?.data);
            } else {
                console.error("Failed to load history:", error);
            }
        } finally {
            setLoadingHistory(false);
        }
    }, [getToken, logout]);

    useEffect(() => {
        if (user) {
            fetchHistory();
        } else if (!loading) {
            router.push("/landing");
        }
    }, [user, loading, fetchHistory, router]);

    const handleUpload = async (files: File[], textInputs: string[]) => {
        setIsUploading(true);
        const token = getToken();
        if (!token) return;

        try {
            const formData = new FormData();
            if (files && files.length > 0) {
                files.forEach(file => formData.append('files', file));
            }
            if (textInputs && textInputs.length > 0) {
                textInputs.forEach((text, idx) => {
                    if (text.trim()) {
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
                const firstRecordId = results[0].record_id;
                router.push(`/results/${firstRecordId}`);
            } else {
                fetchHistory();
            }
        } catch (error) {
            console.error("Upload failed", error);
            alert("Error analyzing content. Check backend console.");
        } finally {
            setIsUploading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--accent-primary)" }} />
        </div>
    );
    if (!user) return null;

    return (
        <main
            className="min-h-screen p-8 font-sans selection:bg-indigo-500/30 transition-colors duration-300"
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
        >
            {/* Header */}
            <header
                className="max-w-7xl mx-auto mb-12 flex justify-between items-center p-6 rounded-2xl backdrop-blur-sm transition-colors duration-300"
                style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-primary)",
                }}
            >
                <div className="flex items-center space-x-4">
                    <div
                        className="p-3 rounded-xl shadow-lg"
                        style={{
                            background: "var(--accent-glow)",
                            border: "1px solid var(--accent-glow)",
                            boxShadow: `0 0 15px var(--accent-glow)`,
                        }}
                    >
                        <Activity className="w-8 h-8" style={{ color: "var(--accent-secondary)" }} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-1">
                            Verifair <span style={{ color: "var(--accent-primary)" }}>.ai</span>
                        </h1>
                        <p className="text-sm font-medium tracking-wide" style={{ color: "var(--text-muted)" }}>
                            Sociotechnical Bias Analysis Engine
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => router.push('/selection-bias')}
                        className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors hover:opacity-80"
                        style={{
                            background: "var(--bg-card-hover)",
                            border: "1px solid var(--border-secondary)",
                            color: "var(--text-secondary)",
                        }}
                    >
                        <Activity className="w-4 h-4" />
                        Selection Bias
                    </button>

                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-lg transition-all active:scale-90"
                        style={{
                            background: "var(--bg-card-hover)",
                            border: "1px solid var(--border-secondary)",
                            color: "var(--text-secondary)",
                        }}
                        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                    >
                        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>

                    <div className="text-right hidden md:block">
                        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                            {user.email}
                        </p>
                        <p className="text-xs flex items-center justify-end mt-1" style={{ color: "#34d399" }}>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
                            System Online
                        </p>
                    </div>

                    <button
                        onClick={logout}
                        className="p-2.5 rounded-lg transition-all hover:opacity-80 active:scale-90"
                        style={{
                            background: "var(--bg-card-hover)",
                            border: "1px solid var(--border-secondary)",
                            color: "var(--text-secondary)",
                        }}
                        title="Sign out"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar */}
                <aside className="lg:col-span-3 space-y-6">
                    <div
                        className="p-5 rounded-xl transition-colors duration-300"
                        style={{
                            background: "var(--glass-panel-bg)",
                            border: "1px solid var(--border-primary)",
                        }}
                    >
                        <div
                            className="flex items-center justify-between cursor-pointer group"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        >
                            <h3
                                className="text-sm font-bold uppercase tracking-widest flex items-center transition-colors"
                                style={{ color: "var(--text-muted)" }}
                            >
                                <History className="w-4 h-4 mr-2" /> Recent Audits
                            </h3>
                            {isSidebarOpen ? (
                                <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                            ) : (
                                <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                            )}
                        </div>

                        {isSidebarOpen && (
                            <div className="space-y-3 mt-4">
                                {loadingHistory ? (
                                    <div className="text-center py-4">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--text-muted)" }} />
                                    </div>
                                ) : history.length === 0 ? (
                                    <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>
                                        No previous scans found.
                                    </p>
                                ) : (
                                    <>
                                        {history.slice(0, visibleHistoryCount).map(item => (
                                            <div
                                                key={item.id}
                                                onClick={() => router.push(`/results/${item.id}`)}
                                                className="group p-3 rounded-lg cursor-pointer transition-all"
                                                style={{ border: "1px solid transparent" }}
                                                onMouseEnter={e => {
                                                    (e.currentTarget as HTMLDivElement).style.background = "var(--bg-card-hover)";
                                                    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-secondary)";
                                                }}
                                                onMouseLeave={e => {
                                                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                                                    (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
                                                }}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <FileText className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                                                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                                                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                                                    {item.filename}
                                                </p>
                                                <div className="flex items-center mt-2 space-x-2">
                                                    <span className={cn(
                                                        "text-xs px-1.5 py-0.5 rounded font-mono",
                                                        item.bias_flags_count > 0
                                                            ? "bg-red-500/10 text-red-400"
                                                            : "bg-emerald-500/10 text-emerald-400"
                                                    )}>
                                                        {item.bias_flags_count} Flags
                                                    </span>
                                                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                                        {item.total_sentences} sentences
                                                    </span>
                                                </div>
                                            </div>
                                        ))}

                                        {history.length > 5 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setVisibleHistoryCount(visibleHistoryCount === 5 ? history.length : 5);
                                                }}
                                                className="w-full py-2 text-xs font-medium mt-2 flex items-center justify-center gap-1 transition-colors"
                                                style={{
                                                    color: "var(--text-muted)",
                                                    borderTop: "1px solid var(--border-secondary)",
                                                }}
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

                {/* Main Content */}
                <div className="lg:col-span-9 space-y-8">
                    <div
                        className="p-8 rounded-2xl backdrop-blur-md shadow-2xl transition-colors duration-300"
                        style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-primary)",
                        }}
                    >
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-semibold mb-2">Initialize Analysis</h2>
                            <p style={{ color: "var(--text-muted)" }} className="max-w-lg mx-auto">
                                Upload documents or paste multiple texts (up to 50 items) to perform a deep-learning based sociotechnical bias audit with overall conclusions.
                            </p>
                        </div>
                        <DragDropUpload onUpload={handleUpload} isUploading={isUploading} />
                    </div>

                    {/* Feature cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center text-sm">
                        {[
                            {
                                title: "Z-Score + WEAT/SEAT",
                                desc: "Statistical anomaly & differential association bias detection.",
                                accent: "var(--accent-primary)",
                            },
                            {
                                title: "Stereotype Detection",
                                desc: "13-category StereoSet + CrowS-Pairs pattern matching.",
                                accent: "#a78bfa",
                            },
                            {
                                title: "Hate Speech (3-Layer)",
                                desc: "Dynabench RoBERTa + ToxiGen + Lexicon ensemble.",
                                accent: "#f87171",
                            },
                            {
                                title: "Selection Bias",
                                desc: "Four-Fifths Rule, Chi-Square, adverse impact ratio.",
                                accent: "#22d3ee",
                            },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="p-4 rounded-xl transition-colors duration-300 hover:opacity-90"
                                style={{
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border-secondary)",
                                }}
                            >
                                <strong className="block mb-1" style={{ color: feature.accent }}>
                                    {feature.title}
                                </strong>
                                <span style={{ color: "var(--text-muted)" }}>{feature.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="mt-16 pt-8 pb-6" style={{ borderTop: "1px solid var(--border-secondary)" }}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm" style={{ color: "var(--text-muted)" }}>
                    <div className="flex items-center gap-3">
                        <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Verifair</span>
                        <span
                            className="px-2 py-0.5 rounded text-xs font-mono"
                            style={{
                                background: "var(--accent-glow)",
                                color: "var(--accent-primary)",
                                border: "1px solid var(--accent-glow)",
                            }}
                        >
                            v3.1.0
                        </span>
                    </div>
                    <p>&copy; {new Date().getFullYear()} Verifair. AI-Powered Bias Detection.</p>
                    <div className="flex items-center gap-4">
                        <a
                            href="https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:opacity-80 transition-opacity"
                        >
                            GitHub
                        </a>
                        <a href="/selection-bias" className="hover:opacity-80 transition-opacity">
                            Selection Bias
                        </a>
                    </div>
                </div>
            </footer>
        </main>
    );
}
