
"use client";

import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';

export interface RadarDataPoint {
    subject: string;
    A: number;
    fullMark: number;
}

interface BiasRadarProps {
    data: RadarDataPoint[];
}

export const BiasRadar: React.FC<BiasRadarProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
                No bias data available
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                <PolarGrid stroke="var(--border-primary)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 4]} tick={{ fill: 'var(--text-muted)' }} />
                <Radar
                    name="Bias Z-Score"
                    dataKey="A"
                    stroke="#0071e3"
                    strokeWidth={2}
                    fill="#0071e3"
                    fillOpacity={0.15}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                        borderRadius: '12px',
                        fontSize: '12px',
                    }}
                    itemStyle={{ color: '#0071e3' }}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
};
