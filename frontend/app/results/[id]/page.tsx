
"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnalysisVisualizations } from '@/components/AnalysisVisualizations';
import { cn } from '@/lib/utils';
import { ArrowLeft, Loader2, Activity, CheckCircle } from 'lucide-react';

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

interface AnalysisResult {
    text_snippet: string;
    is_biased: boolean;
    bias_flags: BiasFlag[];
    topics: AnalysisTopic[];
    explanation?: string;
    quality_score?: number; // Quality Score (0-100)
    advice_disparity?: AdviceDisparity; // Advice Disparity Test
    stereotype_analysis?: StereotypeAnalysis; // NEW: Stereotype Detection
    statistics: {
        mean_association: number;
        std_deviation: number;
    }
}

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
    };
}

export default function ResultPage() {
    const { id } = useParams();
    const { getToken, user, loading } = useAuth();
    const router = useRouter();

    const [report, setReport] = useState<FullReport | null>(null);
    const [fetching, setFetching] = useState(true);
    const [sensitivity, setSensitivity] = useState(2.0);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
            return;
        }

        const fetchReport = async () => {
            const token = getToken();
            if (!token || !id) return;

            try {
                const res = await axios.get(`http://localhost:8000/api/v1/history/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setReport(res.data);
            } catch (e) {
                console.error("Failed to fetch report", e);
                alert("Could not load report.");
                router.push("/");
            } finally {
                setFetching(false);
            }
        };

        if (user && id) {
            fetchReport();
        }
    }, [id, user, loading, getToken, router]);

    const getRadarData = () => {
        if (!report) return [];

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
        if (!report) return [];
        const counts: Record<string, number> = {};
        report.results.forEach(res => {
            res.topics.forEach(t => {
                counts[t.category] = (counts[t.category] || 0) + 1;
            });
        });
        return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
    };

    const avgQualityScore = report ? (
        report.results.reduce((acc, curr) => acc + (curr.quality_score || 0), 0) / (report.results.length || 1)
    ) : 0;

    const filteredResults = report?.results.filter(r =>
        r.bias_flags.some(f => f.z_score >= sensitivity)
    ) || [];

    if (fetching || loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                <p>Retrieving Data Lab Results...</p>
            </div>
        );
    }

    if (!report) return null;

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans selection:bg-indigo-500/30">
            {/* Header / Nav */}
            <header className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
                <div className="flex items-center">
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
            </header>

            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

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

                        {/* NEW: Batch Executive Summary Box */}
                        {report.is_batch_summary && report.batch_conclusion && (
                            <div className="glass-panel p-6 bg-indigo-900/10 border-indigo-500/30 mb-6">
                                <h4 className="text-lg font-bold text-indigo-300 flex items-center mb-3">
                                    <Activity className="w-5 h-5 mr-2" /> Executive Summary (Multi-Document Analysis)
                                </h4>
                                <p className="text-slate-200 text-lg leading-relaxed italic font-serif">
                                    &quot;{report.batch_conclusion}&quot;
                                </p>
                                {report.batch_stats && (
                                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-400">
                                        <div>Most Biased: <span className="text-white">{report.batch_stats.most_biased_file}</span></div>
                                        <div>Top Groups: <span className="text-white">{report.batch_stats.top_identities.join(", ")}</span></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {filteredResults.length === 0 && !report.batch_conclusion ? (
                            <div className="glass-panel p-8 text-center border-dashed border-slate-700">
                                <CheckCircle className="w-12 h-12 text-emerald-500/20 mx-auto mb-3" />
                                <p className="text-slate-400">No statistically significant bias detected at this threshold.</p>
                            </div>
                        ) : (
                            filteredResults.map((res, idx) => (
                                <Card key={idx} className="glass-card border-l-4 border-l-red-500 hover:bg-slate-900/80 transition-colors">
                                    <CardContent className="p-4">
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
                                                    ⚠️ Vague/Subjective
                                                </span>
                                            )}
                                            {res.advice_disparity && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${res.advice_disparity.has_disparity
                                                    ? "text-orange-400 bg-orange-900/20 border-orange-500/20"
                                                    : "text-green-400 bg-green-900/20 border-green-500/20"
                                                    }`}>
                                                    {res.advice_disparity.has_disparity ? "🔀 Advice Disparity" : "✓ Balanced Advice"}
                                                </span>
                                            )}
                                            {res.stereotype_analysis && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${res.stereotype_analysis.has_stereotype
                                                    ? "text-purple-400 bg-purple-900/20 border-purple-500/20"
                                                    : "text-green-400 bg-green-900/20 border-green-500/20"
                                                    }`}>
                                                    {res.stereotype_analysis.has_stereotype ? "🎭 Stereotype Detected" : "✓ No Stereotypes"}
                                                </span>
                                            )}
                                        </div>

                                        {/* AI Explanation Section */}
                                        {res.explanation && (
                                            <div className="mt-4 p-3 bg-indigo-900/20 border-l-2 border-indigo-500 rounded-r text-sm text-slate-300">
                                                <p className="font-semibold text-indigo-300 text-xs uppercase tracking-wide mb-1">AI Explanation (Llama 3.2)</p>
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
                                                        {res.advice_disparity.has_disparity ? "⚠️ Advice Disparity Detected" : "✓ Advice Disparity Analysis: Passed"}
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
                                        {/* Stereotype Detection Section */}
                                        {res.stereotype_analysis && (
                                            <div className={`mt-4 p-3 rounded-r text-sm border-l-2 ${res.stereotype_analysis.has_stereotype
                                                    ? "bg-purple-900/10 border-purple-500 text-slate-300"
                                                    : "bg-green-900/10 border-green-500 text-slate-400"
                                                }`}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className={`font-semibold text-xs uppercase tracking-wide ${res.stereotype_analysis.has_stereotype ? "text-purple-300" : "text-green-300"
                                                        }`}>
                                                        {res.stereotype_analysis.has_stereotype ? "🎭 Stereotype Bias Detected" : "✓ Stereotype Check: Passed"}
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
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div >
                </div >

            </div >
        </main >
    );
}

