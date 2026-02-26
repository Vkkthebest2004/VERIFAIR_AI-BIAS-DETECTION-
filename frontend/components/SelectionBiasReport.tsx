import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Users, CheckCircle } from 'lucide-react';

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

export interface SelectionBiasResult {
    total_candidates: number;
    total_selected: number;
    overall_selection_rate: number;
    group_statistics: Record<string, GroupStatistic>;
    chi_square_test: ChiSquareTest;
    four_fifths_violations: string[];
    bias_detected: boolean;
    bias_score: number;
    severity: string;
}

export const SelectionBiasReport: React.FC<{ data: SelectionBiasResult }> = ({ data }) => {
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
        <div className="space-y-6 animate-fade-in-up">
            {/* Overview Card */}
            <Card className="glass-card">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Users className="w-6 h-6 text-indigo-400" />
                            Overview
                        </h2>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${getSeverityColor(data.severity)}`}>
                            {data.severity} Severity
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 bg-[var(--bg-secondary)]/50 rounded-xl text-center border border-slate-700/50">
                            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Total</p>
                            <p className="text-3xl font-bold text-white">{data.total_candidates}</p>
                            <p className="text-[var(--text-secondary)] text-[10px]">Candidates</p>
                        </div>
                        <div className="p-4 bg-[var(--bg-secondary)]/50 rounded-xl text-center border border-slate-700/50">
                            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Selected</p>
                            <p className="text-3xl font-bold text-white">{data.total_selected}</p>
                            <p className="text-[var(--text-secondary)] text-[10px]">Candidates</p>
                        </div>
                        <div className="p-4 bg-[var(--bg-secondary)]/50 rounded-xl text-center border border-slate-700/50">
                            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Select Rate</p>
                            <p className="text-3xl font-bold text-white">{(data.overall_selection_rate * 100).toFixed(1)}%</p>
                            <p className="text-[var(--text-secondary)] text-[10px]">Overall</p>
                        </div>
                        <div className="p-4 bg-[var(--bg-secondary)]/50 rounded-xl text-center border border-slate-700/50">
                            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-1">Bias Score</p>
                            <p className={`text-3xl font-bold ${data.bias_score > 50 ? 'text-red-400' : 'text-green-400'}`}>
                                {data.bias_score?.toFixed(1) ?? 0}
                            </p>
                            <p className="text-[var(--text-secondary)] text-[10px]">/ 100</p>
                        </div>
                    </div>

                    {data.bias_detected ? (
                        <div className="p-4 bg-red-900/20 border-l-4 border-red-500 rounded-r shadow-sm">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-red-300">Selection Bias Detected</p>
                                    <p className="text-red-200/80 text-sm mt-1 leading-relaxed">
                                        Found violations of the Four-Fifths Rule in groups: <span className="text-white font-mono bg-red-500/20 px-1 rounded">{data.four_fifths_violations.join(', ')}</span>
                                    </p>
                                    {data.chi_square_test.significant && (
                                        <p className="text-red-200/80 text-sm mt-1">
                                            Chi-square test indicates discrepancies are statistically significant (p = {data.chi_square_test.p_value?.toFixed(4) ?? 'N/A'}).
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-emerald-900/20 border-l-4 border-emerald-500 rounded-r shadow-sm flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-emerald-300">No Significant Bias Detected</p>
                                <p className="text-emerald-200/80 text-sm mt-1">
                                    Selection rates across groups appear balanced according to statistical fairness metrics.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Group Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(data.group_statistics).map(([group, stats]) => {
                    if (stats.total_candidates === 0) return null;

                    return (
                        <Card key={group} className={`glass-card transition-all hover:scale-[1.01] ${stats.has_bias ? 'border-red-500/30 bg-red-900/5' : 'border-slate-700/50'}`}>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        {group}
                                    </h3>
                                    {stats.has_bias ? (
                                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase rounded border border-red-500/20">
                                            Bias Detected
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded border border-emerald-500/20">
                                            Fair
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                                        <span className="text-[var(--text-muted)]">Selection Rate</span>
                                        <span className="text-white font-mono font-bold">{(stats.selection_rate * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                                        <span className="text-[var(--text-muted)]">Adverse Impact Ratio</span>
                                        <span className={`font-mono font-bold ${stats.four_fifths_violation ? 'text-red-400' : 'text-emerald-400'}`}>
                                            {stats.adverse_impact_ratio?.toFixed(2) ?? 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                                        <span className="text-[var(--text-muted)]">Demographic Parity Diff</span>
                                        <span className={`font-mono ${(stats.demographic_parity_difference || 0) > 0.1 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                            {stats.demographic_parity_difference !== undefined
                                                ? stats.demographic_parity_difference?.toFixed(3) ?? 'N/A'
                                                : 'N/A'}
                                        </span>
                                    </div>

                                    <div className="pt-2 flex gap-4 text-xs text-[var(--text-secondary)]">
                                        <div>
                                            <span className="block mb-0.5">Start</span>
                                            <span className="text-[var(--text-faint)] font-mono">{stats.total_candidates}</span>
                                        </div>
                                        <div>
                                            <span className="block mb-0.5">Selected</span>
                                            <span className="text-[var(--text-faint)] font-mono">{stats.selected}</span>
                                        </div>
                                        {stats.p_value !== null && (
                                            <div className="ml-auto text-right">
                                                <span className="block mb-0.5">p-value</span>
                                                <span className={`font-mono ${stats.p_value < 0.05 ? 'text-orange-400' : 'text-[var(--text-secondary)]'}`}>
                                                    {stats.p_value?.toFixed(4)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Statistical Tests Box */}
            {data.chi_square_test && (
                <Card className="glass-card bg-[var(--bg-primary)]/50 border-dashed border-slate-700">
                    <CardContent className="p-5">
                        <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Chi-Square Significance Test</h3>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
                            <div className="flex gap-6">
                                <div>
                                    <span className="text-[var(--text-secondary)] text-xs block">Statistic</span>
                                    <span className="text-white font-mono">{data.chi_square_test.statistic?.toFixed(3) ?? 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-[var(--text-secondary)] text-xs block">p-value</span>
                                    <span className={`font-mono font-bold ${data.chi_square_test.significant ? 'text-orange-400' : 'text-emerald-400'}`}>
                                        {data.chi_square_test.p_value?.toFixed(4) ?? 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <p className={`font-medium italic ${data.chi_square_test.significant ? 'text-red-400' : 'text-emerald-400'}`}>
                                &quot;{data.chi_square_test.interpretation}&quot;
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
