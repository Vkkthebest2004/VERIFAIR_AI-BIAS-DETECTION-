
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

// --- Types (Duplicated for now, ideally in a types file) ---
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

interface AnalysisResult {
    text_snippet: string;
    is_biased: boolean;
    bias_flags: BiasFlag[];
    topics: AnalysisTopic[];
    explanation?: string;
    quality_score?: number;
    advice_disparity?: AdviceDisparity;
    stereotype_analysis?: StereotypeAnalysis;
    hate_speech_analysis?: HateSpeechData;
    weat_analysis?: WeatAnalysis;
    source_file?: string; // populated for batch/multi-input results
    statistics: {
        mean_association: number;
        std_deviation: number;
    }
}

// The backend "history detail" endpoint returns the full_report_json which matches this structure
import { SelectionBiasReport, SelectionBiasResult } from '@/components/SelectionBiasReport';
import { CollectiveReport, CollectiveReportData } from '@/components/CollectiveReport';

// The backend "history detail" endpoint returns the full_report_json which matches this structure
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
    // For selection bias reports
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
                // Default to collective view if it's a batch summary
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

    // Aggregate hate speech stats across all chunks
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
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                <p>Retrieving Data Lab Results...</p>
            </div>
        );
    }

    if (!report) return null;

    // --- HANDLE SELECTION BIAS REPORTS ---
    if (report.type === "selection_bias" && report.analysis) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 font-sans">
                <header className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
                    <div className="flex items-center">
                        <Button variant="ghost" onClick={() => router.back()} className="mr-4 text-slate-400 hover:text-white">
                            <ArrowLeft className="w-5 h-5 mr-2" /> Back
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Selection Bias Analysis</h1>
                            <p className="text-slate-400 text-sm flex items-center">
                                <Activity className="w-3 h-3 mr-1 text-indigo-400" />
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
        <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans selection:bg-indigo-500/30">
            {/* Header / Nav */}
            <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center w-full md:w-auto">
                    <Button variant="ghost" onClick={() => router.back()} className="mr-4 text-slate-400 hover:text-white">
                        <ArrowLeft className="w-5 h-5 mr-2" /> Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Audit Result</h1>
                        <p className="text-slate-400 text-sm flex items-center">
                            <Activity className="w-3 h-3 mr-1 text-indigo-400" />
                            {report.filename}
                        </p>
                    </div>
                </div>

                {/* View Toggle for Batch Reports */}
                {report.is_batch_summary && (
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'collective' | 'individual')} className="w-full md:w-auto">
                        <TabsList className="bg-slate-900 border border-slate-700">
                            <TabsTrigger value="collective" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                <Layers className="w-4 h-4 mr-2" />
                                Collective Report
                            </TabsTrigger>
                            <TabsTrigger value="individual" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                                <LayoutGrid className="w-4 h-4 mr-2" />
                                Individual Analysis
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                )}
            </header>

            <div className="max-w-7xl mx-auto">
                {viewMode === 'collective' && report.is_batch_summary ? (
                    <CollectiveReport data={report as unknown as CollectiveReportData} />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* Left Column: Stats & Controls */}
                        <div className="lg:col-span-4 space-y-6">

                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <Card className="glass-panel p-4 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-bold text-white">{report.total_sentences_analyzed}</span>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider mt-1">Sentences</span>
                                </Card>
                                <Card className="glass-panel p-4 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-bold text-red-400">{filteredResults.length}</span>
                                    <span className="text-xs text-slate-400 uppercase tracking-wider mt-1">Biases Found</span>
                                </Card>
                            </div>

                            {/* Quality Score Card */}
                            <Card className="glass-panel p-6 bg-gradient-to-br from-slate-900 to-slate-800">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Advice Quality</h3>
                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded font-bold uppercase",
                                        avgQualityScore > 50 ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                                    )}>
                                        {avgQualityScore > 50 ? "Vague / Subjective" : "Specific / Actionable"}
                                    </span>
                                </div>
                                <div className="flex items-end items-baseline space-x-2">
                                    <span className="text-4xl font-bold text-white">{avgQualityScore.toFixed(0)}</span>
                                    <span className="text-sm text-slate-500 mb-1">/ 100 Vagueness Score</span>
                                </div>
                                <div className="w-full h-2 bg-slate-700 rounded-full mt-3 overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-1000", avgQualityScore > 50 ? "bg-amber-500" : "bg-emerald-500")}
                                        style={{ width: `${Math.min(avgQualityScore, 100)}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    Higher score indicates more vague, subjective, or non-actionable language.
                                </p>
                            </Card>

                            {/* Sensitivity Control */}
                            <Card className="glass-panel p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-slate-200">Sensitivity Threshold</h3>
                                    <span className="text-indigo-400 font-mono text-xl">{sensitivity.toFixed(1)}σ</span>
                                </div>
                                <input
                                    type="range"
                                    min="1.5"
                                    max="4.0"
                                    step="0.1"
                                    value={sensitivity}
                                    onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <p className="text-xs text-slate-500 mt-3">
                                    Adjust Z-Score cutoff. Flags below this line are hidden.
                                </p>
                            </Card>

                            {/* Hate Speech Summary Card */}
                            <Card className={cn(
                                "glass-panel p-6",
                                totalHateDetected > 0
                                    ? "bg-gradient-to-br from-red-950/30 to-slate-900 border-red-500/30"
                                    : "bg-gradient-to-br from-green-950/20 to-slate-900 border-green-500/20"
                            )}>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center">
                                        <ShieldAlert className="w-4 h-4 mr-2" />
                                        Hate Speech Detection
                                    </h3>
                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded font-bold uppercase",
                                        totalHateDetected > 0
                                            ? "bg-red-500/20 text-red-400"
                                            : "bg-emerald-500/20 text-emerald-400"
                                    )}>
                                        {totalHateDetected > 0 ? `${totalHateDetected} DETECTED` : 'CLEAN'}
                                    </span>
                                </div>
                                <div className="space-y-3 mt-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-500">Max Ensemble Score</span>
                                        <span className={cn(
                                            "font-mono text-lg font-bold",
                                            maxHateScore > 0.6 ? "text-red-400" :
                                                maxHateScore > 0.35 ? "text-orange-400" : "text-green-400"
                                        )}>
                                            {(maxHateScore * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-1000",
                                                maxHateScore > 0.6 ? "bg-red-500" :
                                                    maxHateScore > 0.35 ? "bg-orange-500" : "bg-green-500"
                                            )}
                                            style={{ width: `${Math.min(maxHateScore * 100, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Severity</span>
                                        <span className={cn(
                                            "font-semibold",
                                            worstSeverity === 'Critical' ? 'text-red-400' :
                                                worstSeverity === 'High' ? 'text-orange-400' :
                                                    worstSeverity === 'Medium' ? 'text-yellow-400' :
                                                        worstSeverity === 'Low' ? 'text-cyan-400' : 'text-green-400'
                                        )}>
                                            {worstSeverity}
                                        </span>
                                    </div>
                                    {allHateTypes.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {allHateTypes.map((t, i) => (
                                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                                                    {t.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-600 mt-3">
                                    Powered by Dynabench RoBERTa · ToxiGen · Lexicon+Embedding
                                </p>
                            </Card>

                            {/* Visualizations Switcher */}
                            <AnalysisVisualizations
                                radarData={getRadarData()}
                                topicData={getTopicData()}
                            />
                        </div>

                        {/* Right Column: Feed */}
                        <div className="lg:col-span-8 space-y-4">
                            {/* Conclusion / Findings List */}
                            <div className="space-y-4">

                                {/* NEW: Batch Collective Report - Now handled by Toggle View */}
                                {/* {report.is_batch_summary && (
                            <CollectiveReport data={report as unknown as CollectiveReportData} />
                        )} */}

                                {filteredResults.length === 0 && !report.batch_conclusion ? (
                                    <div className="glass-panel p-8 text-center border-dashed border-slate-700">
                                        <CheckCircle className="w-12 h-12 text-emerald-500/20 mx-auto mb-3" />
                                        <p className="text-slate-400">No statistically significant bias detected at this threshold.</p>
                                    </div>
                                ) : (
                                    filteredResults.map((res, idx) => (
                                        <Card key={idx} className={cn(
                                            "glass-card border-l-4 hover:bg-slate-900/80 transition-colors",
                                            res.is_biased ? "border-l-red-500" : "border-l-slate-600"
                                        )}>
                                            <CardContent className="p-4">
                                                {/* Source file label for batch results */}
                                                {res.source_file && (
                                                    <div className="mb-2 pb-2 border-b border-slate-800/50 flex items-center gap-2">
                                                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                                                            {res.source_file}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {res.bias_flags.filter(f => f.z_score >= sensitivity).map((flag, i) => (
                                                            <span key={i} className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-xs font-bold uppercase">
                                                                {flag.identity} (Z: {flag.z_score})
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-slate-300 leading-relaxed font-serif text-lg">
                                                    &quot;{res.text_snippet}&quot;
                                                </p>
                                                <div className="mt-3 flex gap-2">
                                                    {res.topics.map((t, i) => (
                                                        <span key={i} className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                                            #{t.category}
                                                        </span>
                                                    ))}
                                                    {res.quality_score && res.quality_score > 50 && (
                                                        <span className="text-xs text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-500/20">
                                                            Vague/Subjective
                                                        </span>
                                                    )}
                                                    {res.advice_disparity && (
                                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${res.advice_disparity.has_disparity
                                                            ? "text-orange-400 bg-orange-900/20 border-orange-500/20"
                                                            : "text-green-400 bg-green-900/20 border-green-500/20"
                                                            }`}>
                                                            {res.advice_disparity.has_disparity ? "Advice Disparity" : "Balanced Advice"}
                                                        </span>
                                                    )}
                                                    {res.stereotype_analysis && (
                                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${res.stereotype_analysis.has_stereotype
                                                            ? "text-purple-400 bg-purple-900/20 border-purple-500/20"
                                                            : "text-green-400 bg-green-900/20 border-green-500/20"
                                                            }`}>
                                                            {res.stereotype_analysis.has_stereotype ? "Stereotype Detected" : "No Stereotypes"}
                                                        </span>
                                                    )}
                                                    {res.hate_speech_analysis && (
                                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${res.hate_speech_analysis.hate_detected
                                                            ? "text-red-400 bg-red-900/20 border-red-500/20"
                                                            : "text-green-400 bg-green-900/20 border-green-500/20"
                                                            }`}>
                                                            {res.hate_speech_analysis.hate_detected
                                                                ? `Hate: ${res.hate_speech_analysis.severity} (${(res.hate_speech_analysis.ensemble_score * 100).toFixed(0)}%)`
                                                                : "No Hate Speech"}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* AI Explanation Section */}
                                                {res.explanation && (
                                                    <div className="mt-4 p-3 bg-indigo-900/20 border-l-2 border-indigo-500 rounded-r text-sm text-slate-300">
                                                        <p className="font-semibold text-indigo-300 text-xs uppercase tracking-wide mb-1">Contextual Analysis (Llama 3.2)</p>
                                                        {res.explanation}
                                                    </div>
                                                )}

                                                {/* Advice Disparity Section */}
                                                {/* Advice Disparity Section */}
                                                {res.advice_disparity && (
                                                    <div className={`mt-4 p-3 rounded-r text-sm border-l-2 ${res.advice_disparity.has_disparity
                                                        ? "bg-orange-900/10 border-orange-500 text-slate-300"
                                                        : "bg-green-900/10 border-green-500 text-slate-400"
                                                        }`}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <p className={`font-semibold text-xs uppercase tracking-wide ${res.advice_disparity.has_disparity ? "text-orange-300" : "text-green-300"
                                                                }`}>
                                                                {res.advice_disparity.has_disparity ? "Advice Disparity Detected" : "Advice Disparity Analysis: Passed"}
                                                            </p>
                                                            {!res.advice_disparity.has_disparity && (
                                                                <span className="text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded">Safe</span>
                                                            )}
                                                        </div>

                                                        {res.advice_disparity.has_disparity ? (
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div>
                                                                    <span className="text-slate-500">Disparity Score:</span>
                                                                    <span className="ml-2 text-orange-400 font-mono">{res.advice_disparity.disparity_score.toFixed(1)}/100</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-500">Advice Type:</span>
                                                                    <span className="ml-2 text-orange-400">{res.advice_disparity.dominant_advice_type?.replace('_', ' ')}</span>
                                                                </div>
                                                                {res.advice_disparity.mentioned_identities.length > 0 && (
                                                                    <div className="col-span-2 mt-1">
                                                                        <span className="text-slate-500">Identities Mentioned:</span>
                                                                        <span className="ml-2 text-orange-400">{res.advice_disparity.mentioned_identities.join(', ')}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-500">
                                                                No significant difference in advice quality detected across demographic groups.
                                                                Score: {res.advice_disparity.disparity_score.toFixed(1)}/100
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Stereotype Detection Section */}
                                                {res.stereotype_analysis && (
                                                    <div className={`mt-4 p-3 rounded-r text-sm border-l-2 ${res.stereotype_analysis.has_stereotype
                                                        ? "bg-purple-900/10 border-purple-500 text-slate-300"
                                                        : "bg-green-900/10 border-green-500 text-slate-400"
                                                        }`}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <p className={`font-semibold text-xs uppercase tracking-wide ${res.stereotype_analysis.has_stereotype ? "text-purple-300" : "text-green-300"
                                                                }`}>
                                                                {res.stereotype_analysis.has_stereotype ? "Stereotype Bias Detected" : "Stereotype Check: Passed"}
                                                            </p>
                                                            {!res.stereotype_analysis.has_stereotype && (
                                                                <span className="text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded">Safe</span>
                                                            )}
                                                        </div>

                                                        {res.stereotype_analysis.has_stereotype ? (
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div>
                                                                    <span className="text-slate-500">Stereotype Score:</span>
                                                                    <span className="ml-2 text-purple-400 font-mono">{res.stereotype_analysis.stereotype_score.toFixed(1)}/100</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-500">Severity:</span>
                                                                    <span className={`ml-2 font-semibold ${res.stereotype_analysis.severity_level === 'Critical' ? 'text-red-400' :
                                                                        res.stereotype_analysis.severity_level === 'High' ? 'text-orange-400' :
                                                                            res.stereotype_analysis.severity_level === 'Medium' ? 'text-yellow-400' :
                                                                                'text-green-400'
                                                                        }`}>{res.stereotype_analysis.severity_level}</span>
                                                                </div>
                                                                {res.stereotype_analysis.stereotype_type && (
                                                                    <div className="col-span-2 mt-1">
                                                                        <span className="text-slate-500">Type:</span>
                                                                        <span className="ml-2 text-purple-400">{res.stereotype_analysis.stereotype_type}</span>
                                                                    </div>
                                                                )}
                                                                {res.stereotype_analysis.mentioned_identities.length > 0 && (
                                                                    <div className="col-span-2 mt-1">
                                                                        <span className="text-slate-500">Identities:</span>
                                                                        <span className="ml-2 text-purple-400">{res.stereotype_analysis.mentioned_identities.join(', ')}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-500">
                                                                No known stereotype patterns detected from the 13 protected categories.
                                                                Score: {res.stereotype_analysis.stereotype_score.toFixed(1)}/100
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Hate Speech Detection Section — Interactive Plotly */}
                                                {res.hate_speech_analysis && (
                                                    <HateSpeechPanel
                                                        data={res.hate_speech_analysis}
                                                        textSnippet={res.text_snippet}
                                                    />
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div >
                        </div >

                    </div >
                )}
            </div>

            {/* Footer */}
            <footer className="mt-12 border-t border-slate-800/50 pt-6 pb-4">
                <div className="flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500">Verifair</span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400/60 border border-indigo-500/10 font-mono">
                            v3.4.0
                        </span>
                    </div>
                    <p>&copy; {new Date().getFullYear()} Verifair</p>
                </div>
            </footer>
        </main >
    );
}

