"use client";

import React, { useState } from 'react';
import axios from 'axios';
import { API } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload, AlertTriangle, MessageSquare } from 'lucide-react';

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

        // Try to identify column indices
        const idIdx = headers.findIndex(h => h.includes('id') || h.includes('name') || h.includes('candidate'));
        const identityIdx = headers.findIndex(h => h.includes('identity') || h.includes('group') || h.includes('demographic') || h.includes('race') || h.includes('gender'));
        const selectedIdx = headers.findIndex(h => h.includes('load') || h.includes('select') || h.includes('hired') || h.includes('status') || h.includes('result') || h.includes('outcome'));
        const scoreIdx = headers.findIndex(h => h.includes('score') || h.includes('rating'));
        const notesIdx = headers.findIndex(h => h.includes('note') || h.includes('feedback') || h.includes('comment') || h.includes('text'));

        // Fallback to position-based if headers not found clearly
        const usePositions = selectedIdx === -1 && identityIdx === -1;

        return dataLines.map((line, idx) => {
            // Handle simple CSV splitting (naive, breaks on commas in quotes)
            const values = line.split(',').map(v => v.trim());

            let id = `candidate_${idx}`;
            let identities: string[] = [];
            let selected = false;
            let score: number | undefined = undefined;
            let notes: string | undefined = undefined;

            if (usePositions) {
                // Fallback: Default Scheme (ID, Identities, Selected, Score, Notes)
                id = values[0] || id;
                identities = values[1] ? values[1].split(';').map(s => s.trim()) : [];
                const rawSel = values[2] ? values[2].toLowerCase() : 'false';
                selected = rawSel === 'true' || rawSel === '1' || rawSel === 'yes' || rawSel === 'hired';
                score = values[3] ? parseFloat(values[3]) : undefined;
                notes = values[4] || undefined;
            } else {
                // Mapped Scheme
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
        const parsedCandidates = parseCSV(text);
        setCandidates(parsedCandidates);
    };

    const handleAnalyze = async () => {
        if (candidates.length < 2) {
            alert('Please upload at least 2 candidates for analysis');
            return;
        }

        const token = getToken();
        if (!token) {
            router.push('/landing');
            return;
        }

        setAnalyzing(true);
        setResult(null); // Clear previous results

        try {
            const response = await axios.post(
                `${API}/analyze-selection-bias`,
                {
                    candidates,
                    identity_groups: identityGroups
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            setResult(response.data.analysis);
        } catch (error) {
            console.error('Analysis failed:', error);
            if (axios.isAxiosError(error) && error.response?.status === 401) {
                logout(); // Logout if token is invalid/expired
                return;
            }
            alert('Analysis failed. Please check your data and try again.');
        } finally {
            setAnalyzing(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Critical': return 'text-red-400 bg-red-900/20 border-red-500/20';
            case 'High': return 'text-orange-400 bg-orange-900/20 border-orange-500/20';
            case 'Medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/20';
            case 'Low': return 'text-green-400 bg-green-900/20 border-green-500/20';
            default: return 'text-blue-400 bg-blue-900/20 border-blue-500/20';
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            onClick={() => router.push('/dashboard')}
                            className="glass-card"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Dashboard
                        </Button>
                        <h1 className="text-4xl font-bold text-white">Selection Bias Analysis</h1>
                    </div>
                </div>

                {/* Upload Section */}
                <Card className="glass-card mb-8">
                    <CardContent className="p-6">
                        <h2 className="text-2xl font-semibold text-white mb-4">Upload Candidate Data</h2>
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6 text-sm text-slate-300">
                            <p className="mb-2 font-semibold">Supported Columns (Auto-Detected):</p>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-slate-400">
                                <li><strong>Identity:</strong> &quot;Identities&quot;, &quot;Group&quot;, &quot;Race&quot;, &quot;Gender&quot; (semicolon-separated)</li>
                                <li><strong>Outcome:</strong> &quot;Selected&quot;, &quot;Hired&quot;, &quot;Status&quot;, &quot;Result&quot; (1/0, True/False, Yes/No)</li>
                                <li><strong>Text Analysis:</strong> &quot;Notes&quot;, &quot;Feedback&quot;, &quot;Comments&quot;</li>
                            </ul>
                        </div>

                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleCSVUpload}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label
                                htmlFor="csv-upload"
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer flex items-center gap-2 transition-colors"
                            >
                                <Upload className="w-5 h-5" />
                                Choose CSV File
                            </label>

                            {csvFile && (
                                <span className="text-green-400">
                                    {csvFile.name} ({candidates.length} candidates found)
                                </span>
                            )}
                        </div>

                        {candidates.length > 0 && (
                            <Button
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-8 py-3"
                            >
                                {analyzing ? 'Analyzing...' : `Analyze ${candidates.length} Candidates`}
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Results Section */}
                {result && (
                    <div className="space-y-6">

                        {/* 1. Overview Card */}
                        <Card className="glass-card">
                            <CardContent className="p-6">
                                <h2 className="text-2xl font-semibold text-white mb-6">Analysis Summary</h2>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                    <div className="p-4 bg-slate-800/50 rounded-lg">
                                        <p className="text-slate-400 text-sm">Total Candidates</p>
                                        <p className="text-3xl font-bold text-white">{result.total_candidates}</p>
                                    </div>
                                    <div className="p-4 bg-slate-800/50 rounded-lg">
                                        <p className="text-slate-400 text-sm">Selected</p>
                                        <p className="text-3xl font-bold text-white">{result.total_selected}</p>
                                    </div>
                                    <div className="p-4 bg-slate-800/50 rounded-lg">
                                        <p className="text-slate-400 text-sm">Selection Rate</p>
                                        <p className="text-3xl font-bold text-white">{(result.overall_selection_rate * 100).toFixed(1)}%</p>
                                    </div>
                                    <div className={`p-4 rounded-lg border-2 ${getSeverityColor(result.severity)}`}>
                                        <p className="text-sm mb-1">Bias Severity</p>
                                        <p className="text-2xl font-bold">{result.severity}</p>
                                        <p className="text-sm mt-1">{result.bias_score?.toFixed(1) ?? 0}/100</p>
                                    </div>
                                </div>

                                {result.bias_detected && (
                                    <div className="p-4 bg-red-900/20 border-l-4 border-red-500 rounded-r">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                                            <div>
                                                <p className="font-semibold text-red-300 text-lg">Selection Bias Detected</p>
                                                <p className="text-red-200 mt-1">
                                                    Four-Fifths Rule violations: {result.four_fifths_violations.join(', ')}
                                                </p>
                                                {result.chi_square_test.significant && (
                                                    <p className="text-red-200 mt-1">
                                                        Chi-square test: p = {result.chi_square_test.p_value?.toFixed(4) ?? 'N/A'} (significant)
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 2. Keyword Analysis (NEW) */}
                        {result.keyword_analysis && result.keyword_analysis.analyzed_count > 0 && (
                            <Card className="glass-card border-indigo-500/30 bg-slate-900/40">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                                            <MessageSquare className="w-6 h-6 text-indigo-400" />
                                            Linguistic Bias Analysis
                                        </h2>
                                        <span className="text-slate-400 text-sm bg-slate-800 px-3 py-1 rounded-full">
                                            Scanned {result.keyword_analysis.analyzed_count} text fields
                                        </span>
                                    </div>

                                    {Object.keys(result.keyword_analysis.keyword_summary).length === 0 ? (
                                        <div className="text-center p-8 text-slate-500 italic">
                                            No problematic bias keywords detected in candidate notes.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {Object.entries(result.keyword_analysis.keyword_summary).map(([category, data]) => (
                                                <div key={category} className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
                                                    <h3 className="text-indigo-300 font-semibold mb-2 flex justify-between">
                                                        {category.replace(/_/g, ' ')}
                                                        <span className="text-xs bg-indigo-900 px-2 py-0.5 rounded text-indigo-200">
                                                            {data.total_hits} hits
                                                        </span>
                                                    </h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(data.top_keywords).map(([word, count]) => (
                                                            <span key={word} className="text-xs px-2 py-1 bg-slate-700 text-slate-200 rounded flex items-center gap-1 border border-slate-600">
                                                                {word}
                                                                <span className="text-slate-400 text-[10px]">x{count}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* 3. Group Statistics */}
                        <Card className="glass-card">
                            <CardContent className="p-6">
                                <h2 className="text-2xl font-semibold text-white mb-6">Group Analysis</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(result.group_statistics).map(([group, stats]) => {
                                        if (stats.total_candidates === 0) return null;

                                        return (
                                            <div
                                                key={group}
                                                className={`p-4 rounded-lg border-2 ${stats.has_bias
                                                    ? 'bg-red-900/10 border-red-500/30'
                                                    : 'bg-slate-800/50 border-slate-700'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-lg font-semibold text-white">{group}</h3>
                                                    {stats.has_bias && (
                                                        <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                                                            BIAS DETECTED
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Candidates:</span>
                                                        <span className="text-white font-mono">{stats.total_candidates}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Selected:</span>
                                                        <span className="text-white font-mono">{stats.selected}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Selection Rate:</span>
                                                        <span className="text-white font-mono">{(stats.selection_rate * 100).toFixed(1)}%</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">AIR (vs rest):</span>
                                                        <span className={`font-mono font-semibold ${stats.four_fifths_violation ? 'text-red-400' : 'text-green-400'
                                                            }`}>
                                                            {stats.adverse_impact_ratio?.toFixed(2) ?? 'N/A'}
                                                            {stats.four_fifths_violation && ' < 0.80'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400" title="Difference in selection rates between groups (Fairlearn metric)">Demographic Parity Diff:</span>
                                                        <span className={`font-mono ${(stats.demographic_parity_difference || 0) > 0.1 ? 'text-orange-400' : 'text-green-400'
                                                            }`}>
                                                            {stats.demographic_parity_difference !== undefined
                                                                ? stats.demographic_parity_difference?.toFixed(3) ?? 'N/A'
                                                                : 'N/A'}
                                                        </span>
                                                    </div>
                                                    {stats.p_value !== null && (
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-400">p-value:</span>
                                                            <span className={`font-mono ${stats.p_value < 0.05 ? 'text-orange-400' : 'text-slate-400'
                                                                }`}>
                                                                {stats.p_value?.toFixed(4) ?? 'N/A'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 4. Statistical Tests */}
                        <Card className="glass-card">
                            <CardContent className="p-6">
                                <h2 className="text-2xl font-semibold text-white mb-6">Statistical Tests</h2>

                                {result.chi_square_test && (
                                    <div className="p-4 bg-slate-800/50 rounded-lg">
                                        <h3 className="text-lg font-semibold text-white mb-3">Chi-Square Test</h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="text-slate-400">Test Statistic:</p>
                                                <p className="text-white font-mono text-lg">{result.chi_square_test.statistic?.toFixed(3) ?? 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400">p-value:</p>
                                                <p className={`font-mono text-lg ${result.chi_square_test.significant ? 'text-orange-400' : 'text-green-400'
                                                    }`}>
                                                    {result.chi_square_test.p_value?.toFixed(4) ?? 'N/A'}
                                                </p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-slate-400">Interpretation:</p>
                                                <p className={`font-medium ${result.chi_square_test.significant ? 'text-red-400' : 'text-green-400'
                                                    }`}>
                                                    {result.chi_square_test.interpretation}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </main>
    );
}
