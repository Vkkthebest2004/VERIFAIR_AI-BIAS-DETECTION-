
"use client";

import React, { useState } from 'react';
import { BiasRadar } from '@/components/BiasRadar';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';
import { LayoutGrid, PieChart as PieIcon, BarChart as BarIcon } from 'lucide-react';

interface RadarDataPoint {
    subject: string;
    A: number;
    fullMark: number;
}

interface TopicDataPoint {
    name: string;
    value: number;
}

interface AnalysisVisualizationsProps {
    radarData: RadarDataPoint[];
    topicData: TopicDataPoint[];
}

const COLORS = ['#0071e3', '#af52de', '#ff9500', '#ff3b30', '#34c759', '#32ade6'];

export const AnalysisVisualizations: React.FC<AnalysisVisualizationsProps> = ({ radarData, topicData }) => {
    const [activeTab, setActiveTab] = useState<'radar' | 'bar' | 'pie'>('radar');

    return (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)", boxShadow: "var(--shadow-card)" }}>
            <div className="p-4 sm:p-5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                        Analysis Visualizations
                    </h3>
                    <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                        {[
                            { key: 'radar' as const, icon: LayoutGrid },
                            { key: 'bar' as const, icon: BarIcon },
                            { key: 'pie' as const, icon: PieIcon },
                        ].map(({ key, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className="p-1.5 rounded-lg transition-all"
                                style={{
                                    background: activeTab === key ? "var(--accent)" : "transparent",
                                    color: activeTab === key ? "#fff" : "var(--text-muted)",
                                }}
                            >
                                <Icon className="w-3.5 h-3.5" />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-[280px] w-full">
                    {activeTab === 'radar' && <BiasRadar data={radarData} />}

                    {activeTab === 'bar' && (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={radarData}>
                                <XAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-card)',
                                        borderColor: 'var(--border-primary)',
                                        color: 'var(--text-primary)',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                    }}
                                    cursor={{ fill: 'var(--bg-secondary)' }}
                                />
                                <Bar dataKey="A" fill="#0071e3" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}

                    {activeTab === 'pie' && (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={topicData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {topicData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-card)',
                                        borderColor: 'var(--border-primary)',
                                        color: 'var(--text-primary)',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                    }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};
