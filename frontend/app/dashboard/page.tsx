"use client";

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { DragDropUpload } from '@/components/DragDropUpload';
import {
    Shield, Activity, History, FileText, Loader2, ChevronDown, ChevronUp,
    Sun, Moon, LogOut, BarChart3, Zap, Users, Globe, Sparkles, ArrowRight,
    Fingerprint,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditHistoryItem {
    id: number;
    filename: string;
    total_sentences: number;
    bias_flags_count: number;
    created_at?: string;  // Optional, for backward compatibility if needed
    upload_date: string;
}

export default function DashboardPage() {
    const { user, loading, logout, getToken } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();

    const [isUploading, setIsUploading] = useState(false);
    const [history, setHistory] = useState<AuditHistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [visibleHistoryCount, setVisibleHistoryCount] = useState(5);
    const [auditContext, setAuditContext] = useState("General Audit");

    const fetchHistory = useCallback(async () => {
        const token = getToken();
        if (!token) { setLoadingHistory(false); return; }

        try {
            const res = await axios.get(`${API}/history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(res.data.sort((a: AuditHistoryItem, b: AuditHistoryItem) => b.id - a.id));
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                logout(); return;
            }
            console.error("Failed to load history:", error);
        } finally {
            setLoadingHistory(false);
        }
    }, [getToken, logout]);

    useEffect(() => {
        if (user) fetchHistory();
        else if (!loading) router.push("/landing");
    }, [user, loading, fetchHistory, router]);

    const handleUpload = async (files: File[], textInputs: string[]) => {
        setIsUploading(true);
        const token = getToken();
        if (!token) return;

        try {
            const formData = new FormData();
            files?.forEach(file => formData.append('files', file));
            textInputs?.forEach((text, idx) => {
                if (text.trim()) {
                    const blob = new Blob([text], { type: 'text/plain' });
                    formData.append('files', new File([blob], `text_input_${idx + 1}.txt`, { type: 'text/plain' }));
                }
            });

            // Add Context
            formData.append('context', auditContext);

            const response = await axios.post(`${API}/audit`, formData, {
                headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` },
            });

            const results = response.data;
            if (Array.isArray(results) && results.length > 0) {
                router.push(`/results/${results[0].record_id}`);
            } else {
                fetchHistory();
            }
        } catch {
            alert("Error analyzing content. Check backend console.");
        } finally {
            setIsUploading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse-glow"
                    style={{ background: "var(--accent-glow)", border: "1px solid var(--accent-primary)" }}>
                    <Shield className="w-6 h-6" style={{ color: "var(--accent-primary)" }} />
                </div>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent-primary)" }} />
            </div>
        </div>
    );
    if (!user) return null;

    const stats = {
        totalScans: history.length,
        totalFlags: history.reduce((sum, h) => sum + h.bias_flags_count, 0),
        cleanScans: history.filter(h => h.bias_flags_count === 0).length,
    };

    const features = [
        { icon: BarChart3, title: "Z-Score + WEAT/SEAT", desc: "Statistical anomaly & differential association", color: "#6366f1" },
        { icon: Users, title: "Stereotype Detection", desc: "13-category StereoSet + CrowS-Pairs", color: "#a78bfa" },
        { icon: Zap, title: "Hate Speech (3-Layer)", desc: "Dynabench RoBERTa + ToxiGen + Lexicon", color: "#f87171" },
        { icon: Globe, title: "Selection Bias", desc: "Four-Fifths Rule, Chi-Square, adverse impact", color: "#06b6d4" },
        { icon: Fingerprint, title: "Resume Forensics", desc: "Name-proxy, college pedigree, language disparity", color: "#f59e0b" },
    ];

    return (
        <main className="min-h-screen font-sans selection:bg-indigo-500/30" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>

            {/* ─── Sticky Navbar ─── */}
            <nav
                className="sticky top-0 z-50 px-6 py-4 backdrop-blur-xl"
                style={{
                    background: "var(--glass-bg)",
                    borderBottom: "1px solid var(--border-primary)",
                }}
            >
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <Image src="/logo.svg" alt="Verifair Logo" width={40} height={40} className="w-10 h-10" />
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-none">
                                Veri<span style={{ color: "var(--accent-primary)" }}>fair</span>
                            </h1>
                            <p className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                                Algorithmic Bias Audit
                            </p>
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/selection-bias')}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-secondary)",
                                color: "var(--text-secondary)",
                                boxShadow: "var(--shadow-card)",
                            }}
                        >
                            <Activity className="w-4 h-4" style={{ color: "var(--accent-cyan)" }} />
                            Selection Bias
                        </button>

                        <button
                            onClick={() => router.push('/resume-forensics')}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-secondary)",
                                color: "var(--text-secondary)",
                                boxShadow: "var(--shadow-card)",
                            }}
                        >
                            <Fingerprint className="w-4 h-4" style={{ color: "#f59e0b" }} />
                            Resume Forensics
                        </button>

                        <button
                            onClick={toggleTheme}
                            className="p-2.5 rounded-xl transition-all hover:scale-105 active:scale-90"
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-secondary)",
                                color: "var(--text-secondary)",
                                boxShadow: "var(--shadow-card)",
                            }}
                            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                        >
                            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        <div className="hidden md:flex items-center gap-3 pl-3 ml-1" style={{ borderLeft: "1px solid var(--border-secondary)" }}>
                            <div className="text-right">
                                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                    {user.full_name || user.email?.split("@")[0]}
                                </p>
                                <p className="text-[11px] flex items-center justify-end gap-1.5" style={{ color: "var(--accent-emerald)" }}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Online
                                </p>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2.5 rounded-xl transition-all hover:scale-105 active:scale-90"
                                style={{
                                    background: "var(--bg-card)",
                                    border: "1px solid var(--border-secondary)",
                                    color: "var(--text-muted)",
                                    boxShadow: "var(--shadow-card)",
                                }}
                                title="Sign out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6 py-8">

                {/* ─── Welcome Banner ─── */}
                <div
                    className="rounded-2xl p-8 mb-8 relative overflow-hidden animate-fade-in-up"
                    style={{
                        background: "var(--btn-primary-bg)",
                        boxShadow: "0 10px 40px -10px rgba(79, 70, 229, 0.35)",
                    }}
                >
                    {/* Decorative orbs */}
                    <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-20"
                        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.3), transparent)" }} />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10"
                        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.4), transparent)" }} />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-4 h-4 text-indigo-200" />
                                <span className="text-indigo-200 text-sm font-medium">Dashboard</span>
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">
                                Welcome back, {user.full_name || user.email?.split("@")[0]}
                            </h2>
                            <p className="text-indigo-200/80 max-w-md">
                                Upload documents or paste text to analyze for hidden bias patterns using 6-stage statistical & neural analysis.
                            </p>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex gap-4">
                            {[
                                { label: "Total Scans", value: stats.totalScans },
                                { label: "Flags Found", value: stats.totalFlags },
                                { label: "Clean Scans", value: stats.cleanScans },
                            ].map((stat, i) => (
                                <div key={i} className="px-5 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-center min-w-[90px]">
                                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                                    <p className="text-[11px] text-indigo-200/70 font-medium">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* ─── Sidebar ─── */}
                    <aside className="lg:col-span-3 space-y-6 animate-fade-in-up delay-1">
                        {/* History Panel */}
                        <div
                            className="rounded-2xl overflow-hidden"
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-primary)",
                                boxShadow: "var(--shadow-card)",
                            }}
                        >
                            <div className="p-5 pb-0">
                                <h3
                                    className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    <History className="w-3.5 h-3.5" /> Recent Audits
                                </h3>
                            </div>

                            <div className="px-3 pb-4 space-y-1">
                                {loadingHistory ? (
                                    <div className="py-8 flex justify-center">
                                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
                                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No scans yet</p>
                                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>Upload a document to get started</p>
                                    </div>
                                ) : (
                                    <>
                                        {history.slice(0, visibleHistoryCount).map((item, idx) => (
                                            <button
                                                key={item.id}
                                                onClick={() => router.push(`/results/${item.id}`)}
                                                className="w-full text-left p-3 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] group"
                                                style={{
                                                    background: "transparent",
                                                    border: "1px solid transparent",
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = "var(--bg-card-hover)";
                                                    e.currentTarget.style.borderColor = "var(--border-secondary)";
                                                    e.currentTarget.style.boxShadow = "var(--shadow-card)";
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.borderColor = "transparent";
                                                    e.currentTarget.style.boxShadow = "none";
                                                }}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
                                                            style={{
                                                                background: item.bias_flags_count > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                                                color: item.bias_flags_count > 0 ? "#ef4444" : "#10b981",
                                                            }}>
                                                            {idx + 1}
                                                        </div>
                                                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                                                            {item.upload_date ? new Date(item.upload_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')}
                                                        </span>
                                                    </div>
                                                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }} />
                                                </div>
                                                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                                                    {item.filename}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={cn(
                                                        "text-[11px] px-2 py-0.5 rounded-md font-semibold",
                                                        item.bias_flags_count > 0
                                                            ? "bg-red-500/10 text-red-500"
                                                            : "bg-emerald-500/10 text-emerald-600"
                                                    )}>
                                                        {item.bias_flags_count} flags
                                                    </span>
                                                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                                        · {item.total_sentences} sentences
                                                    </span>
                                                </div>
                                            </button>
                                        ))}

                                        {history.length > 5 && (
                                            <button
                                                onClick={() => setVisibleHistoryCount(visibleHistoryCount === 5 ? history.length : 5)}
                                                className="w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1 rounded-xl transition-all hover:opacity-80"
                                                style={{ color: "var(--accent-primary)" }}
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
                        </div>
                    </aside>

                    {/* ─── Main Content ─── */}
                    <div className="lg:col-span-9 space-y-8">

                        {/* Upload Panel */}
                        <div
                            className="rounded-2xl overflow-hidden animate-fade-in-up delay-2"
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-primary)",
                                boxShadow: "var(--shadow-card)",
                            }}
                        >
                            <div className="p-8">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                            style={{ background: "var(--accent-glow)" }}>
                                            <Activity className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold">Initialize Analysis</h2>
                                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                                                Upload documents or paste texts for deep bias auditing
                                            </p>
                                        </div>
                                    </div>

                                    {/* Context Selector */}
                                    <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-lg p-1 pr-3 border border-transparent focus-within:border-indigo-500/50 transition-all">
                                        <span className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Context:</span>
                                        <select
                                            value={auditContext}
                                            onChange={(e) => setAuditContext(e.target.value)}
                                            className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
                                            style={{ color: "var(--text-primary)" }}
                                        >
                                            <option value="General Audit">General Audit</option>
                                            <option value="Job Description">Job Description</option>
                                            <option value="Resume / CV">Resume / CV</option>
                                            <option value="Performance Review">Performance Review</option>
                                            <option value="Email Communication">Email Communication</option>
                                            <option value="Marketing Material">Marketing Material</option>
                                            <option value="Legal Contract">Legal Contract</option>
                                            <option value="Medical / Health Record">Medical / Health Record</option>
                                            <option value="News Article">News Article</option>
                                        </select>
                                    </div>
                                </div>

                                <DragDropUpload onUpload={handleUpload} isUploading={isUploading} />
                            </div>
                        </div>

                        {/* Feature Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in-up delay-3">
                            {features.map((feature, i) => {
                                const Icon = feature.icon;
                                return (
                                    <div
                                        key={i}
                                        className="group p-5 rounded-2xl transition-all hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] cursor-default"
                                        style={{
                                            background: "var(--bg-card)",
                                            border: "1px solid var(--border-secondary)",
                                            boxShadow: "var(--shadow-card)",
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
                                            e.currentTarget.style.borderColor = `${feature.color}33`;
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.boxShadow = "var(--shadow-card)";
                                            e.currentTarget.style.borderColor = "var(--border-secondary)";
                                        }}
                                    >
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                                            style={{ background: `${feature.color}15` }}
                                        >
                                            <Icon className="w-5 h-5" style={{ color: feature.color }} />
                                        </div>
                                        <h3 className="font-bold text-sm mb-1.5" style={{ color: feature.color }}>{feature.title}</h3>
                                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{feature.desc}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-16 pt-6 pb-6" style={{ borderTop: "1px solid var(--border-secondary)" }}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm" style={{ color: "var(--text-muted)" }}>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Image src="/logo.svg" alt="Verifair Logo" width={20} height={20} className="w-5 h-5" />
                                <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Verifair</span>
                            </div>
                            <span
                                className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold"
                                style={{ background: "var(--accent-glow)", color: "var(--accent-primary)" }}
                            >
                                v3.3.0
                            </span>
                        </div>
                        <p className="text-xs">&copy; {new Date().getFullYear()} Verifair. Bias Audit System.</p>
                        <div className="flex items-center gap-4 text-xs">
                            <a
                                href="https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-"
                                target="_blank" rel="noopener noreferrer"
                                className="hover:opacity-80 font-medium" style={{ color: "var(--text-secondary)" }}
                            >
                                GitHub
                            </a>
                            <a href="/selection-bias" className="hover:opacity-80 font-medium" style={{ color: "var(--text-secondary)" }}>
                                Selection Bias
                            </a>
                            <a href="/resume-forensics" className="hover:opacity-80 font-medium" style={{ color: "var(--text-secondary)" }}>
                                Resume Forensics
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </main>
    );
}
