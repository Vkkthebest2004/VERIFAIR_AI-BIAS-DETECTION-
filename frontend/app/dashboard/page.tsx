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
    Sun, Moon, LogOut, BarChart3, Zap, Users, Globe, ArrowRight,
    Fingerprint, Brain, Menu, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditHistoryItem {
    id: number;
    filename: string;
    total_sentences: number;
    bias_flags_count: number;
    created_at?: string;
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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
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
        { icon: BarChart3, title: "Z-Score + WEAT", desc: "Statistical anomaly & differential association", color: "#0071e3", path: null },
        { icon: Users, title: "Stereotype Detection", desc: "13-category StereoSet + CrowS-Pairs", color: "#af52de", path: null },
        { icon: Zap, title: "Hate Speech", desc: "Dynabench RoBERTa + ToxiGen + Lexicon", color: "#ff3b30", path: null },
        { icon: Globe, title: "Selection Bias", desc: "Four-Fifths Rule, Chi-Square, adverse impact", color: "#32ade6", path: "/selection-bias" },
        { icon: Fingerprint, title: "Resume Forensics", desc: "Name-proxy, college pedigree, disparity", color: "#ff9500", path: "/resume-forensics" },
        { icon: Brain, title: "Live Copilot", desc: "Real-time speech bias via Web Speech API", color: "#af52de", path: "/live-copilot" },
    ];

    return (
        <main className="min-h-screen font-sans" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>

            {/* ─── Navbar ─── */}
            <nav
                className="sticky top-0 z-50 backdrop-blur-xl"
                style={{
                    background: "var(--glass-bg)",
                    borderBottom: "0.5px solid var(--border-primary)",
                }}
            >
                <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-2.5">
                        <Image src="/logo.svg" alt="Verifair" width={28} height={28} className="w-7 h-7" />
                        <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                            Verifair
                        </span>
                    </div>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-2">
                        {[
                            { label: "Selection Bias", path: "/selection-bias", icon: Activity, color: "var(--accent-cyan)" },
                            { label: "Resume Forensics", path: "/resume-forensics", icon: Fingerprint, color: "#ff9500" },
                            { label: "Live Copilot", path: "/live-copilot", icon: Brain, color: "var(--accent-violet)" },
                        ].map((item, i) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={i}
                                    onClick={() => router.push(item.path)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:bg-[var(--bg-card-hover)]"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full transition-all hover:bg-[var(--bg-card-hover)]"
                            style={{ color: "var(--text-muted)" }}
                            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                        >
                            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        <div className="hidden sm:flex items-center gap-3 pl-3 ml-1" style={{ borderLeft: "1px solid var(--border-primary)" }}>
                            <button
                                onClick={() => router.push("/profile")}
                                className="flex items-center gap-2 transition-opacity hover:opacity-80"
                                title="View Profile"
                            >
                                {user.profile_picture_url ? (
                                    <img src={user.profile_picture_url} alt="Profile" className="w-7 h-7 rounded-full object-cover border border-[var(--border-primary)]" />
                                ) : (
                                    <div className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-semibold" style={{ background: "var(--accent)" }}>
                                        {(user.full_name || user.email)[0].toUpperCase()}
                                    </div>
                                )}
                                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                                    {user.full_name || user.email?.split("@")[0]}
                                </span>
                            </button>
                            <button
                                onClick={logout}
                                className="p-2 rounded-full transition-all hover:bg-[var(--bg-card-hover)]"
                                style={{ color: "var(--status-danger)" }}
                                title="Sign out"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Mobile menu */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 rounded-full hover:bg-[var(--bg-card-hover)]"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown */}
                {mobileMenuOpen && (
                    <div className="md:hidden px-4 pb-4 space-y-1" style={{ background: "var(--bg-primary)", borderBottom: "0.5px solid var(--border-primary)" }}>
                        {[
                            { label: "Selection Bias", path: "/selection-bias" },
                            { label: "Resume Forensics", path: "/resume-forensics" },
                            { label: "Live Copilot", path: "/live-copilot" },
                        ].map((item, i) => (
                            <button
                                key={i}
                                onClick={() => { router.push(item.path); setMobileMenuOpen(false); }}
                                className="block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-[var(--bg-card-hover)]"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                {item.label}
                            </button>
                        ))}
                        <button
                            onClick={logout}
                            className="block w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-[#ff3b30] hover:bg-[#ff3b30]/5"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </nav>

            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">

                {/* ─── Welcome Section ─── */}
                <div className="mb-8 animate-fade-in-up">
                    <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em] mb-1">
                        Welcome back, {user.full_name || user.email?.split("@")[0]}.
                    </h2>
                    <p className="text-sm sm:text-base" style={{ color: "var(--text-secondary)" }}>
                        Upload documents or paste text to analyze for hidden bias patterns.
                    </p>
                </div>

                {/* ─── Quick Stats ─── */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8 animate-fade-in-up delay-1">
                    {[
                        { label: "Total Scans", value: stats.totalScans, color: "var(--accent)" },
                        { label: "Flags Found", value: stats.totalFlags, color: "#ff3b30" },
                        { label: "Clean Scans", value: stats.cleanScans, color: "#34c759" },
                    ].map((stat, i) => (
                        <div
                            key={i}
                            className="p-4 sm:p-5 rounded-2xl text-center"
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-primary)",
                                boxShadow: "var(--shadow-card)",
                            }}
                        >
                            <p className="text-2xl sm:text-3xl font-semibold" style={{ color: stat.color }}>{stat.value}</p>
                            <p className="text-[11px] mt-1 font-medium" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">

                    {/* ─── Sidebar: History ─── */}
                    <aside className="lg:col-span-3 animate-fade-in-up delay-2">
                        <div
                            className="rounded-2xl overflow-hidden"
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-primary)",
                                boxShadow: "var(--shadow-card)",
                            }}
                        >
                            <div className="p-4 sm:p-5">
                                <h3
                                    className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-4"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    <History className="w-3.5 h-3.5" /> Recent Audits
                                </h3>

                                <div className="space-y-1">
                                    {loadingHistory ? (
                                        <div className="py-8 flex justify-center">
                                            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
                                        </div>
                                    ) : history.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
                                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No scans yet</p>
                                            <p className="text-xs mt-1 opacity-60" style={{ color: "var(--text-muted)" }}>Upload a document to get started</p>
                                        </div>
                                    ) : (
                                        <>
                                            {history.slice(0, visibleHistoryCount).map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => router.push(`/results/${item.id}`)}
                                                    className="w-full text-left p-3 rounded-xl transition-all group"
                                                    style={{ background: "transparent" }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.background = "var(--bg-card-hover)";
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.background = "transparent";
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                                                            {item.upload_date ? new Date(item.upload_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')}
                                                        </span>
                                                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }} />
                                                    </div>
                                                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                                                        {item.filename}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className={cn(
                                                            "text-[11px] px-2 py-0.5 rounded-full font-medium",
                                                            item.bias_flags_count > 0
                                                                ? "bg-[#ff3b30]/[0.08] text-[#ff3b30]"
                                                                : "bg-[#34c759]/[0.08] text-[#34c759]"
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
                                                    className="w-full py-2 text-xs font-medium flex items-center justify-center gap-1 rounded-xl transition-all hover:opacity-80"
                                                    style={{ color: "var(--accent)" }}
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
                        </div>
                    </aside>

                    {/* ─── Main Content ─── */}
                    <div className="lg:col-span-9 space-y-6 sm:space-y-8">

                        {/* Upload Panel */}
                        <div
                            className="rounded-2xl overflow-hidden animate-fade-in-up delay-3"
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-primary)",
                                boxShadow: "var(--shadow-card)",
                            }}
                        >
                            <div className="p-5 sm:p-8">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                    <div>
                                        <h2 className="text-lg sm:text-xl font-semibold tracking-[-0.02em]">Initialize Analysis</h2>
                                        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                                            Upload documents or paste texts for deep bias auditing
                                        </p>
                                    </div>

                                    {/* Context Selector */}
                                    <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                                        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Context:</span>
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 animate-fade-in-up delay-4">
                            {features.map((feature, i) => {
                                const Icon = feature.icon;
                                return (
                                    <div
                                        key={i}
                                        onClick={() => feature.path && router.push(feature.path)}
                                        className={cn(
                                            "group p-4 sm:p-5 rounded-2xl transition-all",
                                            feature.path ? "cursor-pointer hover:shadow-lg hover:shadow-black/[0.04] hover:-translate-y-0.5" : "cursor-default"
                                        )}
                                        style={{
                                            background: "var(--bg-card)",
                                            border: "1px solid var(--border-primary)",
                                            boxShadow: "var(--shadow-card)",
                                        }}
                                    >
                                        <div
                                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-3"
                                            style={{ background: `${feature.color}10` }}
                                        >
                                            <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: feature.color }} />
                                        </div>
                                        <h3 className="font-semibold text-xs sm:text-sm mb-1" style={{ color: feature.color }}>{feature.title}</h3>
                                        <p className="text-[11px] sm:text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{feature.desc}</p>
                                        {feature.path && (
                                            <p className="text-[11px] mt-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: feature.color }}>
                                                Open →
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-12 sm:mt-16 pt-6 pb-6" style={{ borderTop: "1px solid var(--border-primary)" }}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
                        <div className="flex items-center gap-2.5">
                            <Image src="/logo.svg" alt="Verifair" width={16} height={16} className="w-4 h-4" />
                            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Verifair</span>
                            <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-mono"
                                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                            >
                                v3.6.0
                            </span>
                        </div>
                        <p>&copy; {new Date().getFullYear()} Verifair. Bias Audit System.</p>
                        <div className="flex items-center gap-4 text-xs">
                            <a href="https://github.com/Vkkthebest2004/VERIFAIR_AI-BIAS-DETECTION-" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 font-medium" style={{ color: "var(--text-secondary)" }}>
                                GitHub
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </main>
    );
}
