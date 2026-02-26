
"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnalysisVisualizations } from '@/components/AnalysisVisualizations';
import { HateSpeechPanel, HateSpeechData } from '@/components/HateSpeechPanel';
import { cn } from '@/lib/utils';
import { ArrowLeft, Loader2, Activity, CheckCircle, ShieldAlert, Layers, LayoutGrid } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- Types ---
interface BiasFlag {
    identity: string;
    z_score: number;
    similarity_score: number;
    severity: "High" | "Medium";
}

interface AnalysisTopic {
    category: string;
    relevance_score: number;
}

interface AdviceDisparity {
    disparity_score: number;
    mentioned_identities: string[];
    dominant_advice_type: string | null;
    advice_type_scores: Record<string, number>;
    has_disparity: boolean;
}

interface CategoryDetail {
    category: string;
    similarity: number;
    severity: number;
    weighted_score: number;
}

interface StereotypeAnalysis {
    stereotype_score: number;
    has_stereotype: boolean;
    severity_level: string;
    stereotype_type: string | null;
    detected_categories: string[];
    category_details: CategoryDetail[];
    mentioned_identities: string[];
    all_category_scores: Record<string, number>;
}

interface WeatAnalysis {
    seat_score: number;
    cohens_d: number;
    p_value: number;
    pleasant_mean: number;
    unpleasant_mean: number;
    interpretation: string;
    pleasant_scores: number[];
    unpleasant_scores: number[];
}

function safeExplanation(val: unknown): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
        const obj = val as Record<string, unknown>;
        if (typeof obj.explanation === 'string' && obj.explanation) return obj.explanation;
        if (typeof obj.suggestion === 'string' && obj.suggestion) return obj.suggestion;
        return JSON.stringify(val);
    }
    return String(val);
}

interface AnalysisResult {
    text_snippet: string;
    is_biased: boolean;
    bias_flags: BiasFlag[];
    topics: AnalysisTopic[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    explanation?: any;
    quality_score?: number;
    advice_disparity?: AdviceDisparity;
    stereotype_analysis?: StereotypeAnalysis;
    hate_speech_analysis?: HateSpeechData;
    weat_analysis?: WeatAnalysis;
    source_file?: string;
    statistics: {
        mean_association: number;
        std_deviation: number;
    }
}

import { SelectionBiasReport, SelectionBiasResult } from '@/components/SelectionBiasReport';
import { CollectiveReport, CollectiveReportData } from '@/components/CollectiveReport';

interface FullReport {
    record_id: number;
    filename: string;
    total_sentences_analyzed: number;
    bias_flags_count: number;
    results: AnalysisResult[];
    is_batch_summary?: boolean;
    batch_conclusion?: string;
    batch_stats?: {
        most_biased_file: string;
        top_identities: string[];
        total_files: number;
        total_flags: number;
        hate_speech_summary?: {
            total_hate_detected: number;
            max_ensemble_score: number;
            worst_severity: string;
            hate_types_found: string[];
        };
    };
    type?: "selection_bias";
    analysis?: SelectionBiasResult;
}

export default function ResultPage() {
    const { id } = useParams();
    const { getToken, user, loading } = useAuth();
    const router = useRouter();

    const [report, setReport] = useState<FullReport | null>(null);
    const [fetching, setFetching] = useState(true);
    const [sensitivity, setSensitivity] = useState(2.0);
    const [viewMode, setViewMode] = useState<'collective' | 'individual'>('individual');

    useEffect(() => {
        if (!loading && !user) {
            router.push("/landing");
            return;
        }

        const fetchReport = async () => {
            const token = getToken();
            if (!token || !id) return;

            try {
                const res = await axios.get(`${API}/history/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setReport(res.data);
                if (res.data.is_batch_summary) {
                    setViewMode('collective');
                }
            } catch (e) {
                console.error("Failed to fetch report", e);
                alert("Could not load report.");
                router.push("/dashboard");
            } finally {
                setFetching(false);
            }
        };

        if (user && id) {
            fetchReport();
        }
    }, [id, user, loading, getToken, router]);

    const getRadarData = () => {
        if (!report || !report.results) return [];
        const scores: Record<string, number> = {};
        report.results.forEach(res => {
            res.bias_flags.forEach(flag => {
                if (!scores[flag.identity] || flag.z_score > scores[flag.identity]) {
                    scores[flag.identity] = flag.z_score;
                }
            });
        });
        return Object.keys(scores).map(identity => ({
            subject: identity,
            A: scores[identity],
            fullMark: 5
        }));
    };

    const getTopicData = () => {
        if (!report || !report.results) return [];
        const counts: Record<string, number> = {};
        report.results.forEach(res => {
            res.topics.forEach(t => {
                counts[t.category] = (counts[t.category] || 0) + 1;
            });
        });
        return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
    };

    const avgQualityScore = report && report.results ? (
        report.results.reduce((acc, curr) => acc + (curr.quality_score || 0), 0) / (report.results.length || 1)
    ) : 0;

    const filteredResults = report?.results?.filter(r =>
        r.bias_flags.some(f => f.z_score >= sensitivity) ||
        r.hate_speech_analysis?.hate_detected ||
        r.stereotype_analysis?.has_stereotype ||
        r.advice_disparity?.has_disparity
    ) || [];

    const hateChunks = report?.results?.filter(r => r.hate_speech_analysis?.hate_detected) || [];
    const totalHateDetected = hateChunks.length;
    const maxHateScore = report?.results?.reduce((max, r) => {
        const score = r.hate_speech_analysis?.ensemble_score || 0;
        return score > max ? score : max;
    }, 0) || 0;
    const worstSeverity = report?.results?.reduce((worst, r) => {
        const sev = r.hate_speech_analysis?.severity || 'None';
        const order: Record<string, number> = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'None': 0 };
        return (order[sev] || 0) > (order[worst] || 0) ? sev : worst;
    }, 'None') || 'None';
    const allHateTypes = [...new Set(report?.results?.flatMap(r => r.hate_speech_analysis?.hate_types || []) || [])];

    if (fetching || loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-muted)" }}>
                <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: "var(--accent)" }} />
                <p className="text-sm">Loading report...</p>
            </div>
        );
    }

    if (!report) return null;

    // --- SELECTION BIAS REPORTS ---
    if (report.type === "selection_bias" && report.analysis) {
        return (
            <main className="min-h-screen p-4 sm:p-8 font-sans" style={{ background: "var(--bg-secondary)" }}>
                <header className="max-w-7xl mx-auto mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center">
                        <button onClick={() => router.back()} className="mr-4 text-sm font-medium flex items-center gap-1.5 hover:underline" style={{ color: "var(--accent)" }}>
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>Selection Bias Analysis</h1>
                            <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                                <Activity className="w-3 h-3" style={{ color: "var(--accent)" }} />
                                {report.filename}
                            </p>
                        </div>
                    </div>
                </header>
                <div className="max-w-7xl mx-auto">
                    <SelectionBiasReport data={report.analysis} />
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen font-sans" style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>
            {/* Header */}
            <div className="backdrop-blur-xl sticky top-0 z-40" style={{ background: "var(--glass-bg)", borderBottom: "0.5px solid var(--border-primary)" }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex flex-col sm:flex-row justify-between items-center">
                    <div className="flex items-center w-full sm:w-auto py-2 sm:py-0">
                        <button onClick={() => router.back()} className="mr-3 text-sm font-medium flex items-center gap-1.5 hover:underline" style={{ color: "var(--accent)" }}>
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <div>
                            <h1 className="text-base font-semibold tracking-[-0.02em]">Audit Result</h1>
                            <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                                <Activity className="w-3 h-3" style={{ color: "var(--accent)" }} />
                                {report.filename}
                            </p>
                        </div>
                    </div>

                    {report.is_batch_summary && (
                        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'collective' | 'individual')} className="w-full sm:w-auto">
                            <TabsList className="h-9 rounded-xl p-1" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                                <TabsTrigger value="collective" className="text-xs rounded-lg data-[state=active]:bg-[var(--accent)] data-[state=active]:text-white data-[state=active]:shadow-sm">
                                    <Layers className="w-3.5 h-3.5 mr-1.5" />
                                    Collective
                                </TabsTrigger>
                                <TabsTrigger value="individual" className="text-xs rounded-lg data-[state=active]:bg-[var(--accent)] data-[state=active]:text-white data-[state=active]:shadow-sm">
                                    <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />
                                    Individual
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
                {viewMode === 'collective' && report.is_batch_summary ? (
                    <CollectiveReport data={report as unknown as CollectiveReportData} />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">

                        {/* Left Sidebar */}
                        <div className="lg:col-span-4 space-y-4 sm:space-y-5">

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-2xl text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                                    <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{report.total_sentences_analyzed}</span>
                                    <p className="text-[10px] uppercase tracking-wider mt-1 font-medium" style={{ color: "var(--text-muted)" }}>Sentences</p>
                                </div>
                                <div className="p-4 rounded-2xl text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                                    <span className="text-2xl font-semibold" style={{ color: "#ff3b30" }}>{filteredResults.length}</span>
                                    <p className="text-[10px] uppercase tracking-wider mt-1 font-medium" style={{ color: "var(--text-muted)" }}>Biases Found</p>
                                </div>
                            </div>

                            {/* Quality Score */}
                            <div className="p-5 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Advice Quality</h3>
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                                        avgQualityScore > 50
                                            ? "bg-[#ff9500]/10 text-[#ff9500]"
                                            : "bg-[#34c759]/10 text-[#34c759]"
                                    )}>
                                        {avgQualityScore > 50 ? "Vague" : "Specific"}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-semibold">{avgQualityScore.toFixed(0)}</span>
                                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>/100</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full overflow-hidden mt-3" style={{ background: "var(--bg-secondary)" }}>
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-1000", avgQualityScore > 50 ? "bg-[#ff9500]" : "bg-[#34c759]")}
                                        style={{ width: `${Math.min(avgQualityScore, 100)}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                                    Higher = more vague, subjective language.
                                </p>
                            </div>

                            {/* Sensitivity */}
                            <div className="p-5 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-semibold">Sensitivity</h3>
                                    <span className="text-lg font-mono font-semibold" style={{ color: "var(--accent)" }}>{sensitivity.toFixed(1)}σ</span>
                                </div>
                                <input
                                    type="range"
                                    min="1.5"
                                    max="4.0"
                                    step="0.1"
                                    value={sensitivity}
                                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                                    style={{ background: "var(--bg-secondary)", accentColor: "var(--accent)" }}
                                />
                                <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>Flags below threshold are hidden.</p>
                            </div>

                            {/* Hate Speech Summary */}
                            <div className={cn(
                                "p-5 rounded-2xl",
                                totalHateDetected > 0
                                    ? "bg-[#ff3b30]/[0.03] border-[#ff3b30]/20"
                                    : "bg-[#34c759]/[0.03] border-[#34c759]/20"
                            )} style={{ border: "1px solid" }}>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-[11px] font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                                        <ShieldAlert className="w-3.5 h-3.5" /> Hate Speech
                                    </h3>
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                                        totalHateDetected > 0
                                            ? "bg-[#ff3b30]/10 text-[#ff3b30]"
                                            : "bg-[#34c759]/10 text-[#34c759]"
                                    )}>
                                        {totalHateDetected > 0 ? `${totalHateDetected} DETECTED` : 'CLEAN'}
                                    </span>
                                </div>
                                <div className="space-y-2 mt-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Max Score</span>
                                        <span className={cn(
                                            "font-mono text-base font-semibold",
                                            maxHateScore > 0.6 ? "text-[#ff3b30]" :
                                                maxHateScore > 0.35 ? "text-[#ff9500]" : "text-[#34c759]"
                                        )}>
                                            {(maxHateScore * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000",
                                                maxHateScore > 0.6 ? "bg-[#ff3b30]" :
                                                    maxHateScore > 0.35 ? "bg-[#ff9500]" : "bg-[#34c759]"
                                            )}
                                            style={{ width: `${Math.min(maxHateScore * 100, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span style={{ color: "var(--text-muted)" }}>Severity</span>
                                        <span className={cn(
                                            "font-semibold",
                                            worstSeverity === 'Critical' ? 'text-[#ff3b30]' :
                                                worstSeverity === 'High' ? 'text-[#ff9500]' :
                                                    worstSeverity === 'Medium' ? 'text-[#ffcc00]' :
                                                        worstSeverity === 'Low' ? 'text-[#32ade6]' : 'text-[#34c759]'
                                        )}>
                                            {worstSeverity}
                                        </span>
                                    </div>
                                    {allHateTypes.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {allHateTypes.map((t, i) => (
                                                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#ff3b30]/[0.06] text-[#ff3b30] font-medium">
                                                    {t.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <p className="text-[9px] mt-3" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                                    Dynabench RoBERTa · ToxiGen · Lexicon
                                </p>
                            </div>

                            {/* Visualizations */}
                            <AnalysisVisualizations
                                radarData={getRadarData()}
                                topicData={getTopicData()}
                            />
                        </div>

                        {/* Right: Results Feed */}
                        <div className="lg:col-span-8 space-y-3 sm:space-y-4">
                            {filteredResults.length === 0 && !report.batch_conclusion ? (
                                <div className="p-8 sm:p-12 text-center rounded-2xl border-2 border-dashed" style={{ borderColor: "var(--border-primary)" }}>
                                    <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "#34c759" }} />
                                    <p style={{ color: "var(--text-muted)" }}>No statistically significant bias detected at this threshold.</p>
                                </div>
                            ) : (
                                filteredResults.map((res, idx) => (
                                    <div key={idx} className={cn(
                                        "rounded-2xl overflow-hidden border-l-[3px] transition-all hover:shadow-md",
                                        res.is_biased ? "border-l-[#ff3b30]" : "border-l-[var(--border-primary)]"
                                    )} style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                                        <div className="p-4 sm:p-5">
                                            {/* Source file label */}
                                            {res.source_file && (
                                                <div className="mb-3 pb-2" style={{ borderBottom: "1px solid var(--border-secondary)" }}>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                                                        {res.source_file}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Flags */}
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {res.bias_flags.filter(f => f.z_score >= sensitivity).map((flag, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-[#ff3b30]/[0.06] text-[#ff3b30] rounded-full text-[11px] font-semibold">
                                                        {flag.identity} (Z: {flag.z_score})
                                                    </span>
                                                ))}
                                            </div>

                                            {/* Text */}
                                            <p className="leading-relaxed text-[15px]" style={{ color: "var(--text-primary)" }}>
                                                &quot;{res.text_snippet}&quot;
                                            </p>

                                            {/* Tags */}
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {res.topics.map((t, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                                                        #{t.category}
                                                    </span>
                                                ))}
                                                {res.quality_score && res.quality_score > 50 && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ff9500]/[0.08] text-[#ff9500] font-medium">
                                                        Vague/Subjective
                                                    </span>
                                                )}
                                                {res.advice_disparity && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${res.advice_disparity.has_disparity
                                                        ? "bg-[#ff9500]/[0.08] text-[#ff9500]"
                                                        : "bg-[#34c759]/[0.08] text-[#34c759]"
                                                        }`}>
                                                        {res.advice_disparity.has_disparity ? "Advice Disparity" : "Balanced Advice"}
                                                    </span>
                                                )}
                                                {res.stereotype_analysis && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${res.stereotype_analysis.has_stereotype
                                                        ? "bg-[#af52de]/[0.08] text-[#af52de]"
                                                        : "bg-[#34c759]/[0.08] text-[#34c759]"
                                                        }`}>
                                                        {res.stereotype_analysis.has_stereotype ? "Stereotype Detected" : "No Stereotypes"}
                                                    </span>
                                                )}
                                                {res.hate_speech_analysis && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${res.hate_speech_analysis.hate_detected
                                                        ? "bg-[#ff3b30]/[0.08] text-[#ff3b30]"
                                                        : "bg-[#34c759]/[0.08] text-[#34c759]"
                                                        }`}>
                                                        {res.hate_speech_analysis.hate_detected
                                                            ? `Hate: ${res.hate_speech_analysis.severity} (${(res.hate_speech_analysis.ensemble_score * 100).toFixed(0)}%)`
                                                            : "No Hate Speech"}
                                                    </span>
                                                )}
                                            </div>

                                            {/* AI Explanation */}
                                            {res.explanation && (
                                                <div className="mt-4 p-3 rounded-xl border-l-2" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
                                                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--accent)" }}>Contextual Analysis (Llama 3.2)</p>
                                                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{safeExplanation(res.explanation)}</p>
                                                </div>
                                            )}

                                            {/* Advice Disparity */}
                                            {res.advice_disparity && (
                                                <div className={`mt-4 p-3 rounded-xl border-l-2 ${res.advice_disparity.has_disparity
                                                    ? "bg-[#ff9500]/[0.04] border-[#ff9500]"
                                                    : "bg-[#34c759]/[0.04] border-[#34c759]"
                                                    }`}>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className={`text-[10px] font-semibold uppercase tracking-wide ${res.advice_disparity.has_disparity ? "text-[#ff9500]" : "text-[#34c759]"}`}>
                                                            {res.advice_disparity.has_disparity ? "Advice Disparity Detected" : "Advice Disparity Analysis: Passed"}
                                                        </p>
                                                        {!res.advice_disparity.has_disparity && (
                                                            <span className="text-[10px] text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full">Safe</span>
                                                        )}
                                                    </div>
                                                    {res.advice_disparity.has_disparity ? (
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <span style={{ color: "var(--text-muted)" }}>Disparity Score:</span>
                                                                <span className="ml-2 text-[#ff9500] font-mono">{res.advice_disparity.disparity_score.toFixed(1)}/100</span>
                                                            </div>
                                                            <div>
                                                                <span style={{ color: "var(--text-muted)" }}>Advice Type:</span>
                                                                <span className="ml-2 text-[#ff9500]">{res.advice_disparity.dominant_advice_type?.replace('_', ' ')}</span>
                                                            </div>
                                                            {res.advice_disparity.mentioned_identities.length > 0 && (
                                                                <div className="col-span-2 mt-1">
                                                                    <span style={{ color: "var(--text-muted)" }}>Identities:</span>
                                                                    <span className="ml-2 text-[#ff9500]">{res.advice_disparity.mentioned_identities.join(', ')}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                                            No significant difference. Score: {res.advice_disparity.disparity_score.toFixed(1)}/100
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Stereotype */}
                                            {res.stereotype_analysis && (
                                                <div className={`mt-4 p-3 rounded-xl border-l-2 ${res.stereotype_analysis.has_stereotype
                                                    ? "bg-[#af52de]/[0.04] border-[#af52de]"
                                                    : "bg-[#34c759]/[0.04] border-[#34c759]"
                                                    }`}>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <p className={`text-[10px] font-semibold uppercase tracking-wide ${res.stereotype_analysis.has_stereotype ? "text-[#af52de]" : "text-[#34c759]"}`}>
                                                            {res.stereotype_analysis.has_stereotype ? "Stereotype Bias Detected" : "Stereotype Check: Passed"}
                                                        </p>
                                                        {!res.stereotype_analysis.has_stereotype && (
                                                            <span className="text-[10px] text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full">Safe</span>
                                                        )}
                                                    </div>
                                                    {res.stereotype_analysis.has_stereotype ? (
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <span style={{ color: "var(--text-muted)" }}>Score:</span>
                                                                <span className="ml-2 text-[#af52de] font-mono">{res.stereotype_analysis.stereotype_score.toFixed(1)}/100</span>
                                                            </div>
                                                            <div>
                                                                <span style={{ color: "var(--text-muted)" }}>Severity:</span>
                                                                <span className={`ml-2 font-semibold ${res.stereotype_analysis.severity_level === 'Critical' ? 'text-[#ff3b30]' :
                                                                    res.stereotype_analysis.severity_level === 'High' ? 'text-[#ff9500]' :
                                                                        res.stereotype_analysis.severity_level === 'Medium' ? 'text-[#ffcc00]' :
                                                                            'text-[#34c759]'
                                                                    }`}>{res.stereotype_analysis.severity_level}</span>
                                                            </div>
                                                            {res.stereotype_analysis.stereotype_type && (
                                                                <div className="col-span-2 mt-1">
                                                                    <span style={{ color: "var(--text-muted)" }}>Type:</span>
                                                                    <span className="ml-2 text-[#af52de]">{res.stereotype_analysis.stereotype_type}</span>
                                                                </div>
                                                            )}
                                                            {res.stereotype_analysis.mentioned_identities.length > 0 && (
                                                                <div className="col-span-2 mt-1">
                                                                    <span style={{ color: "var(--text-muted)" }}>Identities:</span>
                                                                    <span className="ml-2 text-[#af52de]">{res.stereotype_analysis.mentioned_identities.join(', ')}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                                            No stereotype patterns detected. Score: {res.stereotype_analysis.stereotype_score.toFixed(1)}/100
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            {/* Hate Speech Panel */}
                                            {res.hate_speech_analysis && (
                                                <HateSpeechPanel
                                                    data={res.hate_speech_analysis}
                                                    textSnippet={res.text_snippet}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="mt-8" style={{ borderTop: "1px solid var(--border-primary)" }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    <div className="flex items-center gap-2">
                        <span style={{ color: "var(--text-secondary)" }}>Verifair</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                            v3.6.0
                        </span>
                    </div>
                    <p>&copy; {new Date().getFullYear()} Verifair</p>
                </div>
            </footer>
        </main>
    );
}
