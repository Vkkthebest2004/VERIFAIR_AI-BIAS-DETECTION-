"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export interface HateSpeechData {
    hate_detected: boolean;
    ensemble_score: number;
    severity: string;
    hate_types: string[];
    summary: {
        dynabench_score: number;
        toxigen_score: number;
        lexicon_score: number;
        [key: string]: number;
    };
}

interface HateSpeechPanelProps {
    data: HateSpeechData;
    textSnippet?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
    'Critical': '#ef4444',
    'High': '#f97316',
    'Medium': '#eab308',
    'Low': '#06b6d4',
    'None': '#22c55e',
};

const SEVERITY_EMOJI: Record<string, string> = {
    'Critical': '●',
    'High': '●',
    'Medium': '●',
    'Low': '●',
    'None': '●',
};

export const HateSpeechPanel: React.FC<HateSpeechPanelProps> = ({ data }) => {
    const severityColor = SEVERITY_COLORS[data.severity] || '#94a3b8';

    // Ensemble gauge chart
    const gaugeData = useMemo(() => [{
        type: 'indicator' as const,
        mode: 'gauge+number+delta' as const,
        value: data.ensemble_score * 100,
        title: { text: 'Ensemble Hate Score', font: { color: '#f8fafc', size: 14 } },
        number: { suffix: '%', font: { color: '#f8fafc', size: 28 } },
        gauge: {
            axis: { range: [0, 100], tickcolor: '#94a3b8', dtick: 20 },
            bar: { color: severityColor, thickness: 0.7 },
            bgcolor: '#1e293b',
            borderwidth: 0,
            steps: [
                { range: [0, 35], color: 'rgba(34, 197, 94, 0.15)' },
                { range: [35, 60], color: 'rgba(234, 179, 8, 0.15)' },
                { range: [60, 80], color: 'rgba(249, 115, 22, 0.15)' },
                { range: [80, 100], color: 'rgba(239, 68, 68, 0.15)' },
            ],
            threshold: {
                line: { color: '#eab308', width: 2 },
                thickness: 0.8,
                value: 35,
            },
        },
    }], [data.ensemble_score, severityColor]);

    // Per-layer bar chart
    const layerBarData = useMemo(() => [{
        x: ['Dynabench\nRoBERTa', 'ToxiGen\n(Implicit)', 'Lexicon\n+Embed'],
        y: [
            data.summary.dynabench_score * 100,
            data.summary.toxigen_score * 100,
            data.summary.lexicon_score * 100,
        ],
        type: 'bar' as const,
        marker: {
            color: ['#ec4899', '#f97316', '#06b6d4'],
            opacity: 0.9,
            line: { width: 0 },
        },
        text: [
            `${(data.summary.dynabench_score * 100).toFixed(1)}%`,
            `${(data.summary.toxigen_score * 100).toFixed(1)}%`,
            `${(data.summary.lexicon_score * 100).toFixed(1)}%`,
        ],
        textposition: 'outside' as const,
        textfont: { color: '#f8fafc', size: 11 },
        hovertemplate: '<b>%{x}</b><br>Score: %{y:.1f}%<extra></extra>',
    }], [data.summary]);

    const radarData = useMemo(() => {
        const labels = [
            'explicit_hate', 'implicit_hate', 'dehumanization',
            'coded_hate', 'violent_hate'
        ];
        const names = [
            'Explicit Hate', 'Implicit Hate', 'Dehumanization',
            'Coded/Dog-Whistle', 'Violent Hate'
        ];
        const values = labels.map(label =>
            data.hate_types.includes(label) ? 1 : 0
        );
        return [{
            type: 'scatterpolar' as const,
            r: [...values, values[0]],
            theta: [...names, names[0]],
            fill: 'toself',
            fillcolor: `${severityColor}33`,
            line: { color: severityColor, width: 2 },
            marker: { size: 6, color: severityColor },
            name: 'Detected',
            hovertemplate: '<b>%{theta}</b><br>Detected: %{r}<extra></extra>',
        }];
    }, [data.hate_types, severityColor]);

    const darkLayout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#94a3b8', family: 'Inter, system-ui, sans-serif' },
        margin: { t: 40, b: 40, l: 40, r: 40 },
    };

    return (
        <div className={`mt-4 rounded-xl border-2 overflow-hidden transition-all
      ${data.hate_detected
                ? 'border-red-500/40 bg-gradient-to-br from-red-950/30 via-slate-900/80 to-slate-900/60'
                : 'border-green-500/30 bg-gradient-to-br from-green-950/20 via-slate-900/80 to-slate-900/60'
            }`}>

            {/* Header */}
            <div className={`px-5 py-3 flex items-center justify-between
        ${data.hate_detected
                    ? 'bg-red-900/30 border-b border-red-500/20'
                    : 'bg-green-900/20 border-b border-green-500/20'
                }`}>
                <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${data.hate_detected ? 'text-red-400' : 'text-green-400'}`}>{data.hate_detected ? '!' : 'OK'}</span>
                    <div>
                        <h4 className={`text-sm font-bold uppercase tracking-wider
              ${data.hate_detected ? 'text-red-300' : 'text-green-300'}`}>
                            Deep Hate Speech Detection
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                            3-Layer Ensemble: Dynabench · ToxiGen · Lexicon+Embedding
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border
            ${data.hate_detected
                            ? 'bg-red-500/20 text-red-300 border-red-500/30'
                            : 'bg-green-500/20 text-green-300 border-green-500/30'
                        }`}>
                        {data.hate_detected ? 'HATE DETECTED' : 'CLEAN'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded font-semibold`}
                        style={{ color: severityColor, backgroundColor: `${severityColor}22`, border: `1px solid ${severityColor}44` }}>
                        {SEVERITY_EMOJI[data.severity]} {data.severity}
                    </span>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Gauge */}
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/50">
                    <Plot
                        data={gaugeData as any /* plotly types */}
                        layout={{
                            ...darkLayout,
                            height: 220,
                            margin: { t: 40, b: 10, l: 30, r: 30 },
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%', height: 220 }}
                    />
                </div>

                {/* Per-Layer Bars */}
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/50">
                    <Plot
                        data={layerBarData as any /* plotly types */}
                        layout={{
                            ...darkLayout,
                            height: 220,
                            title: { text: 'Per-Layer Scores', font: { color: '#f8fafc', size: 13 } },
                            xaxis: {
                                tickfont: { color: '#94a3b8', size: 9 },
                                gridcolor: '#1e293b',
                            },
                            yaxis: {
                                range: [0, 110],
                                ticksuffix: '%',
                                tickfont: { color: '#94a3b8', size: 9 },
                                gridcolor: '#1e293b33',
                            },
                            margin: { t: 35, b: 55, l: 40, r: 10 },
                            shapes: [{
                                type: 'line',
                                x0: -0.5, x1: 2.5,
                                y0: 50, y1: 50,
                                line: { color: '#eab308', width: 1, dash: 'dash' },
                            }],
                            showlegend: false,
                            bargap: 0.35,
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%', height: 220 }}
                    />
                </div>

                {/* Hate Type Radar */}
                <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/50">
                    <Plot
                        data={radarData as any /* plotly types */}
                        layout={{
                            ...darkLayout,
                            height: 220,
                            title: { text: 'Hate Type Profile', font: { color: '#f8fafc', size: 13 } },
                            polar: {
                                bgcolor: 'transparent',
                                radialaxis: {
                                    visible: true,
                                    range: [0, 1],
                                    tickvals: [0, 0.5, 1],
                                    ticktext: ['', '', ''],
                                    gridcolor: '#334155',
                                    linecolor: '#334155',
                                },
                                angularaxis: {
                                    tickfont: { size: 8, color: '#94a3b8' },
                                    gridcolor: '#334155',
                                    linecolor: '#334155',
                                },
                            },
                            margin: { t: 35, b: 20, l: 50, r: 50 },
                            showlegend: false,
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%', height: 220 }}
                    />
                </div>
            </div>

            {/* Hate Types Tags */}
            {data.hate_types.length > 0 && (
                <div className="px-5 pb-4 flex flex-wrap gap-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider self-center mr-1">Detected Types:</span>
                    {data.hate_types.map((type, i) => (
                        <span key={i} className="text-[11px] px-2.5 py-1 rounded-full font-medium
              bg-red-500/10 text-red-300 border border-red-500/20">
                            {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                    ))}
                </div>
            )}

            {/* Score Details Footer */}
            <div className="px-5 pb-4">
                <div className="grid grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                        <p className="text-pink-400 font-mono font-bold">{(data.summary.dynabench_score * 100).toFixed(1)}%</p>
                        <p className="text-slate-500 mt-0.5">Dynabench</p>
                        <p className="text-slate-600 text-[9px]">Weight: 35%</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                        <p className="text-orange-400 font-mono font-bold">{(data.summary.toxigen_score * 100).toFixed(1)}%</p>
                        <p className="text-slate-500 mt-0.5">ToxiGen</p>
                        <p className="text-slate-600 text-[9px]">Weight: 40%</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                        <p className="text-cyan-400 font-mono font-bold">{(data.summary.lexicon_score * 100).toFixed(1)}%</p>
                        <p className="text-slate-500 mt-0.5">Lexicon</p>
                        <p className="text-slate-600 text-[9px]">Weight: 25%</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center border border-slate-700/50" style={{ borderColor: `${severityColor}33` }}>
                        <p className="font-mono font-bold" style={{ color: severityColor }}>{(data.ensemble_score * 100).toFixed(1)}%</p>
                        <p className="text-slate-500 mt-0.5">Ensemble</p>
                        <p className="text-slate-600 text-[9px]">Threshold: 35%</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HateSpeechPanel;
