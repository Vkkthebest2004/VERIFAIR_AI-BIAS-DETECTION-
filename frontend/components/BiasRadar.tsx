
"use client";

import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

export interface RadarDataPoint {
    subject: string;
    A: number;
    fullMark: number;
}

interface BiasRadarProps {
    data: RadarDataPoint[];
}

export const BiasRadar: React.FC<BiasRadarProps> = ({ data }) => {
    // If no data, show a placeholder or empty state
    if (!data || data.length === 0) {
        return (
            <Card className="h-[400px] flex items-center justify-center text-slate-500">
                No Bias Detected (Yet)
            </Card>
        )
    }

    // Transform data for Radar Chart if needed
    // We expect data to be like [{ subject: 'Male', A: 2.5, fullMark: 5 }, ...]

    return (
        <Card className="h-[500px] w-full flex flex-col">
            <CardHeader>
                <CardTitle className="text-xl text-center text-glow">Bias Distribution Radar</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 4]} tick={{ fill: '#475569' }} />
                        <Radar
                            name="Bias Z-Score"
                            dataKey="A"
                            stroke="#818cf8"
                            strokeWidth={3}
                            fill="#6366f1"
                            fillOpacity={0.4}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                            itemStyle={{ color: '#818cf8' }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};
