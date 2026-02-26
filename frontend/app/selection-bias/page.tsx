"use client";

import React, { useState } from 'react';
import axios from 'axios';
import { API } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ArrowLeft, Upload, AlertTriangle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Candidate {
    id: string;
    identities: string[];
    selected: boolean;
    score?: number;
    notes?: string;
}

interface KeywordHit {
    total_hits: number;
    top_keywords: Record<string, number>;
}

interface KeywordAnalysis {
    analyzed_count: number;
    keyword_summary: Record<string, KeywordHit>;
}

interface GroupStatistic {
    total_candidates: number;
    selected: number;
    selection_rate: number;
    comparison_group_rate: number;
    adverse_impact_ratio: number;
    z_score: number | null;
    p_value: number | null;
    effect_size: number;
    has_bias: boolean;
    four_fifths_violation: boolean;
    demographic_parity_difference?: number;
}

interface ChiSquareTest {
    statistic: number;
    p_value: number;
    degrees_of_freedom: number;
    significant: boolean;
    interpretation: string;
}

interface SelectionBiasResult {
    total_candidates: number;
    total_selected: number;
    overall_selection_rate: number;
    group_statistics: Record<string, GroupStatistic>;
    chi_square_test: ChiSquareTest;
    four_fifths_violations: string[];
    bias_detected: boolean;
    bias_score: number;
    severity: string;
    keyword_analysis?: KeywordAnalysis;
}

export default function SelectionBiasPage() {
    const router = useRouter();
    const { getToken, logout } = useAuth();
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<SelectionBiasResult | null>(null);

    const identityGroups = ["Male", "Female", "Non-binary", "Asian", "Black", "White", "Hispanic", "Muslim", "Christian", "Jewish", "LGBTQ", "Disabled", "Elderly"];

    const parseCSV = (text: string): Candidate[] => {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const dataLines = lines.slice(1);

        const idIdx = headers.findIndex(h => h.includes('id') || h.includes('name') || h.includes('candidate'));
        const identityIdx = headers.findIndex(h => h.includes('identity') || h.includes('group') || h.includes('demographic') || h.includes('race') || h.includes('gender'));
        const selectedIdx = headers.findIndex(h => h.includes('load') || h.includes('select') || h.includes('hired') || h.includes('status') || h.includes('result') || h.includes('outcome'));
        const scoreIdx = headers.findIndex(h => h.includes('score') || h.includes('rating'));
        const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('feedback') || h.includes('comment') || h.includes('text'));

        const usePositions = selectedIdx === -1 && identityIdx === -1;

        return dataLines.map((line, idx) => {
            const values = line.split(',').map(v => v.trim());
            let id = `candidate_${idx}`;
            let identities: string[] = [];
            let selected = false;
            let score: number | undefined = undefined;
            let notes: string | undefined = undefined;

            if (usePositions) {
                id = values[0] || id;
                identities = values[1] ? values[1].split(';').map(s => s.trim()) : [];
                const rawSel = values[2] ? values[2].toLowerCase() : 'false';
                selected = rawSel === 'true' || rawSel === '1' || rawSel === 'yes' || rawSel === 'hired';
                score = values[3] ? parseFloat(values[3]) : undefined;
                notes = values[4] || undefined;
            } else {
                if (idIdx !== -1) id = values[idIdx];
                if (identityIdx !== -1) identities = values[identityIdx] ? values[identityIdx].split(';').map(s => s.trim()) : [];
                if (selectedIdx !== -1) {
                    const rawSel = values[selectedIdx] ? values[selectedIdx].toLowerCase() : 'false';
                    selected = rawSel === 'true' || rawSel === '1' || rawSel === 'yes' || rawSel === 'hired' || rawSel === 'selected';
                }
                if (scoreIdx !== -1) score = values[scoreIdx] ? parseFloat(values[scoreIdx]) : undefined;
                if (notesIdx !== -1) notes = values[notesIdx];
            }
            return { id, identities, selected, score, notes };
        });
    };

    const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCsvFile(file);
        const text = await file.text();
        setCandidates(parseCSV(text));
    };

    const handleAnalyze = async () => {
        if (candidates.length < 2) {
            alert('Please upload at least 2 candidates for analysis');
            return;
        }
        const token = getToken();
        if (!token) { router.push('/landing'); return; }

        setAnalyzing(true);
        setResult(null);

        try {
            const response = await axios.post(
                `${API}/analyze-selection-bias`,
                { candidates, identity_groups: identityGroups },
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );
            setResult(response.data.analysis);
        } catch (error) {
            console.error('Analysis failed:', error);
            if (axios.isAxiosError(error) && error.response?.status === 401) { logout(); return; }
            alert('Analysis failed. Please check your data and try again.');
        } finally {
            setAnalyzing(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Critical': return 'text-[#ff3b30] bg-[#ff3b30]/[0.06] border-[#ff3b30]/20';
            case 'High': return 'text-[#ff9500] bg-[#ff9500]/[0.06] border-[#ff9500]/20';
            case 'Medium': return 'text-[#ffcc00] bg-[#ffcc00]/[0.06] border-[#ffcc00]/20';
            case 'Low': return 'text-[#34c759] bg-[#34c759]/[0.06] border-[#34c759]/20';
            default: return 'text-[#0071e3] bg-[#0071e3]/[0.06] border-[#0071e3]/20';
        }
    };

    return (
        <main className="min-h-screen font-sans" style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

                {/* Header */}
                <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="text-sm font-medium flex items-center gap-1.5 hover:underline"
                            style={{ color: "var(--accent)" }}
                        >
                            <ArrowLeft className="w-4 h-4" /> Back
                        </button>
                        <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-[-0.03em]">
                            Selection Bias Analysis
                        </h1>
                    </div>
                </div>

                {/* Upload Section */}
                <div className="rounded-2xl overflow-hidden mb-8" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                    <div className="p-5 sm:p-8">
                        <h2 className="text-lg sm:text-xl font-semibold mb-4">Upload Candidate Data</h2>
                        <div className="p-4 rounded-xl text-sm mb-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                            <p className="mb-2 font-semibold text-sm">Supported Columns (Auto-Detected):</p>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                                <li><strong>Identity:</strong> &quot;Identities&quot;, &quot;Group&quot;, &quot;Race&quot;, &quot;Gender&quot; (semicolon-separated)</li>
                                <li><strong>Outcome:</strong> &quot;Selected&quot;, &quot;Hired&quot;, &quot;Status&quot;, &quot;Result&quot; (1/0, True/False, Yes/No)</li>
                                <li><strong>Text Analysis:</strong> &quot;Notes&quot;, &quot;Feedback&quot;, &quot;Comments&quot;</li>
                            </ul>
                        </div>

                        <div className="flex items-center gap-4">
                            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" id="csv-upload" />
                            <label
                                htmlFor="csv-upload"
                                className="px-5 py-2.5 text-sm font-medium text-white rounded-xl cursor-pointer flex items-center gap-2 transition-all active:scale-95"
                                style={{ background: "var(--accent)" }}
                            >
                                <Upload className="w-4 h-4" /> Choose CSV File
                            </label>
                            {csvFile && (
                                <span className="text-sm font-medium text-[#34c759]">
                                    {csvFile.name} ({candidates.length} candidates)
                                </span>
                            )}
                        </div>

                        {candidates.length > 0 && (
                            <button
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className="mt-5 px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
                                style={{ background: "#af52de" }}
                            >
                                {analyzing ? 'Analyzing...' : `Analyze ${candidates.length} Candidates`}
                            </button>
                        )}
                    </div>
                </div>

                {/* Results */}
                {result && (
                    <div className="space-y-5 animate-fade-in-up">

                        {/* Overview */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                            <div className="p-5 sm:p-8">
                                <h2 className="text-lg sm:text-xl font-semibold mb-6">Analysis Summary</h2>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
                                    {[
                                        { l: "Total Candidates", v: result.total_candidates, c: "var(--text-primary)" },
                                        { l: "Selected", v: result.total_selected, c: "var(--text-primary)" },
                                        { l: "Selection Rate", v: `${(result.overall_selection_rate * 100).toFixed(1)}%`, c: "var(--text-primary)" },
                                    ].map((s, i) => (
                                        <div key={i} className="p-4 rounded-xl text-center" style={{ background: "var(--bg-secondary)" }}>
                                            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{s.l}</p>
                                            <p className="text-2xl font-semibold" style={{ color: s.c }}>{s.v}</p>
                                        </div>
                                    ))}
                                    <div className={`p-4 rounded-xl text-center border-2 ${getSeverityColor(result.severity)}`}>
                                        <p className="text-xs mb-1">Bias Severity</p>
                                        <p className="text-xl font-bold">{result.severity}</p>
                                        <p className="text-xs mt-1">{result.bias_score?.toFixed(1) ?? 0}/100</p>
                                    </div>
                                </div>

                                {result.bias_detected && (
                                    <div className="p-4 bg-[#ff3b30]/[0.04] border-l-[3px] border-[#ff3b30] rounded-r-xl">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="w-5 h-5 text-[#ff3b30] flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-semibold text-[#ff3b30] text-base">Selection Bias Detected</p>
                                                <p className="text-[#ff3b30]/80 mt-1 text-sm">Four-Fifths Rule violations: {result.four_fifths_violations.join(', ')}</p>
                                                {result.chi_square_test.significant && (
                                                    <p className="text-[#ff3b30]/80 mt-1 text-sm">Chi-square: p = {result.chi_square_test.p_value?.toFixed(4) ?? 'N/A'} (significant)</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Keyword Analysis */}
                        {result.keyword_analysis && result.keyword_analysis.analyzed_count > 0 && (
                            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                                <div className="p-5 sm:p-8">
                                    <div className="flex items-center justify-between mb-5">
                                        <h2 className="text-lg font-semibold flex items-center gap-2">
                                            <MessageSquare className="w-5 h-5" style={{ color: "var(--accent)" }} />
                                            Linguistic Bias Analysis
                                        </h2>
                                        <span className="text-xs px-3 py-1 rounded-full" style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                                            {result.keyword_analysis.analyzed_count} text fields
                                        </span>
                                    </div>

                                    {Object.keys(result.keyword_analysis.keyword_summary).length === 0 ? (
                                        <div className="text-center p-8 italic" style={{ color: "var(--text-muted)" }}>
                                            No problematic bias keywords detected.
                                        </div>
                                    ) : (
                                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {Object.entries(result.keyword_analysis.keyword_summary).map(([category, data]) => (
                                                <div key={category} className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                                                    <h3 className="text-sm font-semibold mb-2 flex justify-between" style={{ color: "var(--accent)" }}>
                                                        {category.replace(/_/g, ' ')}
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                                                            {data.total_hits} hits
                                                        </span>
                                                    </h3>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {Object.entries(data.top_keywords).map(([word, count]) => (
                                                            <span key={word} className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)" }}>
                                                                {word}
                                                                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>x{count}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Group Statistics */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                            <div className="p-5 sm:p-8">
                                <h2 className="text-lg font-semibold mb-6">Group Analysis</h2>
                                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                                    {Object.entries(result.group_statistics).map(([group, stats]) => {
                                        if (stats.total_candidates === 0) return null;
                                        return (
                                            <div
                                                key={group}
                                                className={cn(
                                                    "p-4 rounded-xl border-2 transition-all",
                                                    stats.has_bias
                                                        ? 'bg-[#ff3b30]/[0.02] border-[#ff3b30]/20'
                                                        : 'border-[var(--border-primary)]'
                                                )}
                                                style={{ background: stats.has_bias ? undefined : "var(--bg-secondary)" }}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-base font-semibold">{group}</h3>
                                                    {stats.has_bias && (
                                                        <span className="px-2 py-0.5 bg-[#ff3b30]/10 text-[#ff3b30] text-[10px] rounded-full font-semibold">
                                                            BIAS DETECTED
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="space-y-1.5 text-sm">
                                                    {[
                                                        { l: "Candidates", v: stats.total_candidates },
                                                        { l: "Selected", v: stats.selected },
                                                        { l: "Selection Rate", v: `${(stats.selection_rate * 100).toFixed(1)}%` },
                                                    ].map((r, i) => (
                                                        <div key={i} className="flex justify-between">
                                                            <span style={{ color: "var(--text-muted)" }}>{r.l}:</span>
                                                            <span className="font-mono">{r.v}</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between">
                                                        <span style={{ color: "var(--text-muted)" }}>AIR (vs rest):</span>
                                                        <span className={cn("font-mono font-semibold", stats.four_fifths_violation ? 'text-[#ff3b30]' : 'text-[#34c759]')}>
                                                            {stats.adverse_impact_ratio?.toFixed(2) ?? 'N/A'}
                                                            {stats.four_fifths_violation && ' < 0.80'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span style={{ color: "var(--text-muted)" }} title="Demographic Parity Difference">DP Diff:</span>
                                                        <span className={cn("font-mono", (stats.demographic_parity_difference || 0) > 0.1 ? 'text-[#ff9500]' : 'text-[#34c759]')}>
                                                            {stats.demographic_parity_difference !== undefined ? stats.demographic_parity_difference?.toFixed(3) ?? 'N/A' : 'N/A'}
                                                        </span>
                                                    </div>
                                                    {stats.p_value !== null && (
                                                        <div className="flex justify-between">
                                                            <span style={{ color: "var(--text-muted)" }}>p-value:</span>
                                                            <span className={cn("font-mono", stats.p_value < 0.05 ? 'text-[#ff9500]' : '')}>
                                                                {stats.p_value?.toFixed(4) ?? 'N/A'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Statistical Tests */}
                        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
                            <div className="p-5 sm:p-8">
                                <h2 className="text-lg font-semibold mb-6">Statistical Tests</h2>
                                {result.chi_square_test && (
                                    <div className="p-4 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                                        <h3 className="text-base font-semibold mb-3">Chi-Square Test</h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p style={{ color: "var(--text-muted)" }}>Test Statistic:</p>
                                                <p className="font-mono text-lg font-semibold">{result.chi_square_test.statistic?.toFixed(3) ?? 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p style={{ color: "var(--text-muted)" }}>p-value:</p>
                                                <p className={cn("font-mono text-lg font-semibold", result.chi_square_test.significant ? 'text-[#ff9500]' : 'text-[#34c759]')}>
                                                    {result.chi_square_test.p_value?.toFixed(4) ?? 'N/A'}
                                                </p>
                                            </div>
                                            <div className="col-span-2">
                                                <p style={{ color: "var(--text-muted)" }}>Interpretation:</p>
                                                <p className={cn("font-medium", result.chi_square_test.significant ? 'text-[#ff3b30]' : 'text-[#34c759]')}>
                                                    {result.chi_square_test.interpretation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
