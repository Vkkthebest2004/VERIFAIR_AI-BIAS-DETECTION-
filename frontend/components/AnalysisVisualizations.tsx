
"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { BiasRadar } from '@/components/BiasRadar';
import { Button } from '@/components/ui/button';
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

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F'];

export const AnalysisVisualizations: React.FC<AnalysisVisualizationsProps> = ({ radarData, topicData }) => {
    const [activeTab, setActiveTab] = useState<'radar' | 'bar' | 'pie'>('radar');

    return (
        <Card className="glass-panel p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Analysis Visualizations</h3>
                <div className="flex space-x-1 bg-slate-900 rounded-lg p-1 border border-slate-700">
                    <Button
                        variant={activeTab === 'radar' ? "default" : "ghost"}
                        onClick={() => setActiveTab('radar')}
                        className="h-7 px-2"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={activeTab === 'bar' ? "default" : "ghost"}
                        onClick={() => setActiveTab('bar')}
                        className="h-7 px-2"
                    >
                        <BarIcon className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={activeTab === 'pie' ? "default" : "ghost"}
                        onClick={() => setActiveTab('pie')}
                        className="h-7 px-2"
                    >
                        <PieIcon className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="h-[300px] w-full">
                {activeTab === 'radar' && <BiasRadar data={radarData} />}

                {activeTab === 'bar' && (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={radarData}>
                            <XAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                cursor={{ fill: '#1e293b' }}
                            />
                            <Bar dataKey="A" fill="#6366f1" radius={[4, 4, 0, 0]} />
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
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
};
