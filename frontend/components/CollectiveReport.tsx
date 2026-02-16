import { Card, CardContent } from '@/components/ui/card';
import { Shield, BarChart3, AlertTriangle, CheckCircle, Activity, Layers } from 'lucide-react';
import dynamic from 'next/dynamic';

// --- Recharts (Dynamic Import) ---
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const RadarChart = dynamic(() => import('recharts').then(mod => mod.RadarChart), { ssr: false });
const PolarGrid = dynamic(() => import('recharts').then(mod => mod.PolarGrid), { ssr: false });
const PolarAngleAxis = dynamic(() => import('recharts').then(mod => mod.PolarAngleAxis), { ssr: false });
const PolarRadiusAxis = dynamic(() => import('recharts').then(mod => mod.PolarRadiusAxis), { ssr: false });
const Radar = dynamic(() => import('recharts').then(mod => mod.Radar), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });

interface RadarDataPoint {
    subject: string;
    A: number; // Average
    B: number; // Max
    fullMark: number;
}

interface DistributionItem {
    name: string;
    value: number;
}

export interface CollectiveReportData {
    type: "collective_report";
    total_files: number;
    total_sentences: number;
    total_bias_flags: number;
    most_biased_file: string | null;
    fairness_score: number;
    radar_data: RadarDataPoint[];
    hate_speech_breakdown: DistributionItem[];
    severity_distribution: DistributionItem[];
    average_bias_intensity: number;
    bias_load: number;
    batch_conclusion?: string;
}

interface Props {
    data: CollectiveReportData;
}

const SEVERITY_COLORS = {
    "Critical": "#ef4444", // Red 500
    "High": "#f97316",     // Orange 500
    "Medium": "#eab308",   // Yellow 500
    "Low": "#22c55e",      // Green 500
    "None": "#94a3b8"      // Slate 400
};

export function CollectiveReport({ data }: Props) {

    // Sort severity distribution for chart consistency
    const sortedSeverity = [
        ...(data.severity_distribution || [])
    ].sort((a, b) => {
        const order = ["Critical", "High", "Medium", "Low", "None"];
        return order.indexOf(a.name) - order.indexOf(b.name);
    });

    return (
        <div className="space-y-6 animate-fade-in-up">

            {/* ─── HEADER SECTION ─── */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950/50 rounded-2xl p-8 border border-indigo-500/20 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                    <div className="col-span-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-mono font-semibold mb-4">
                            <Layers className="w-3 h-3" />
                            COLLECTIVE INTELLIGENCE REPORT
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                            Sentinel Engine Analysis
                        </h2>
                        <p className="text-slate-400 text-lg">
                            Aggregated insights across <span className="text-white font-semibold">{data.total_files} documents</span> and <span className="text-white font-semibold">{data.total_sentences} data points</span>.
                        </p>
                    </div>

                    {/* Fairness Score Circle */}
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-950/50 rounded-xl border border-slate-800 backdrop-blur-sm">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="64" cy="64" r="56"
                                    stroke="currentColor" strokeWidth="8"
                                    fill="transparent"
                                    className="text-slate-800"
                                />
                                <circle
                                    cx="64" cy="64" r="56"
                                    stroke="currentColor" strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={351.86}
                                    strokeDashoffset={351.86 - (351.86 * data.fairness_score) / 100}
                                    className={`transition-all duration-1000 ${data.fairness_score > 80 ? 'text-emerald-500' :
                                        data.fairness_score > 60 ? 'text-yellow-500' :
                                            'text-red-500'
                                        }`}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-3xl font-bold ${data.fairness_score > 80 ? 'text-emerald-400' :
                                    data.fairness_score > 60 ? 'text-yellow-400' :
                                        'text-red-400'
                                    }`}>
                                    {data.fairness_score.toFixed(0)}
                                </span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-1">Fairness</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── KEY METRICS ROW ─── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="glass-panel border-indigo-500/10 bg-slate-900/40">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                        <Shield className="w-8 h-8 text-indigo-400 mb-2 opacity-80" />
                        <span className="text-3xl font-bold text-white">{data.total_bias_flags}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Total Flags</span>
                    </CardContent>
                </Card>

                <Card className="glass-panel border-indigo-500/10 bg-slate-900/40">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                        <Activity className="w-8 h-8 text-cyan-400 mb-2 opacity-80" />
                        <span className="text-3xl font-bold text-white">{data.average_bias_intensity.toFixed(2)}σ</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Avg. Bias Intensity</span>
                    </CardContent>
                </Card>

                <Card className="glass-panel border-indigo-500/10 bg-slate-900/40">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                        <AlertTriangle className="w-8 h-8 text-orange-400 mb-2 opacity-80" />
                        <span className="text-3xl font-bold text-white truncate max-w-full px-2" title={data.most_biased_file || "None"}>
                            {data.most_biased_file ? "Found" : "None"}
                        </span>
                        <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">Most Biased Input</span>
                    </CardContent>
                </Card>

                <Card className="glass-panel border-indigo-500/10 bg-slate-900/40">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                        <BarChart3 className="w-8 h-8 text-emerald-400 mb-2 opacity-80" />
                        <span className="text-3xl font-bold text-white">{data.bias_load.toFixed(0)}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wider mt-1">System Bias Load</span>
                    </CardContent>
                </Card>
            </div>

            {/* ─── CHARTS ROW ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Radar Chart: Systemic Bias Profile */}
                <Card className="glass-panel p-6 bg-slate-900/60 h-[400px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-slate-200">Systemic Bias Profile</h3>
                        <div className="flex gap-4 text-xs">
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-indigo-500/50"></span>
                                <span className="text-slate-400">Mean Bias</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-cyan-400/50"></span>
                                <span className="text-slate-400">Peak Bias</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.radar_data || []}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 4]} tick={{ fill: '#475569', fontSize: 10 }} />
                                <Radar
                                    name="Peak Bias"
                                    dataKey="B"
                                    stroke="#22d3ee"
                                    strokeWidth={2}
                                    fill="#22d3ee"
                                    fillOpacity={0.1}
                                />
                                <Radar
                                    name="Average Bias"
                                    dataKey="A"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fill="#6366f1"
                                    fillOpacity={0.3}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                    itemStyle={{ color: '#f8fafc' }}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 2. Bar Chart: Severity Distribution */}
                <Card className="glass-panel p-6 bg-slate-900/60 h-[400px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-slate-200">Severity Distribution</h3>
                        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                            Flags by Impact Level
                        </span>
                    </div>
                    <div className="h-[320px] w-full flex items-center justify-center">
                        {sortedSeverity.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sortedSeverity} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                                        width={60}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                                        {sortedSeverity.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS] || "#94a3b8"}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-center text-slate-500 flex flex-col items-center">
                                <CheckCircle className="w-12 h-12 mb-3 text-emerald-500/20" />
                                <p>No severity flags detected.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* ─── AI CONCLUSION ─── */}
            {data.batch_conclusion && (
                <div className="bg-gradient-to-br from-indigo-950/30 to-slate-900 border border-indigo-500/20 rounded-xl p-6">
                    <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-3 flex items-center">
                        <Activity className="w-4 h-4 mr-2" />
                        Sentinel Engine Executive Summary
                    </h3>
                    <p className="text-slate-300 leading-relaxed font-serif text-lg italic">
                        &quot;{data.batch_conclusion}&quot;
                    </p>
                </div>
            )}

            {/* ─── HATE SPEECH BREAKDOWN ─── */}
            {(data.hate_speech_breakdown || []).length > 0 && (
                <Card className="glass-panel p-6 bg-red-950/10 border-red-500/20">
                    <h3 className="font-semibold text-red-200 mb-4 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Hate Speech Composition
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {(data.hate_speech_breakdown || []).map((item, idx) => (
                            <div key={idx} className="bg-red-900/20 border border-red-500/20 rounded-lg px-4 py-2 flex items-center gap-3">
                                <span className="text-red-300 font-medium">{item.name}</span>
                                <span className="bg-red-500/20 text-red-200 text-xs py-0.5 px-2 rounded-full font-mono">
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

        </div>
    );
}
