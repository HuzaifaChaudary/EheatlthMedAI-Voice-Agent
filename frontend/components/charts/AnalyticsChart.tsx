"use client";

import React from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';

interface AnalyticsChartProps {
    title: string;
    description?: string;
    data: any[];
    type: 'line' | 'bar' | 'pie';
    dataKey: string;
    categoryKey?: string; // For X-axis or Pie slices
    color?: string;
    height?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
    title,
    description,
    data,
    type,
    dataKey,
    categoryKey = 'name',
    color = '#8884d8',
    height = 350,
}) => {
    const renderChart = () => {
        switch (type) {
            case 'line':
                return (
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                        <XAxis 
                            dataKey={categoryKey} 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                        />
                        <YAxis 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: '1px solid #ffffff20',
                                color: '#ffffff'
                            }}
                            labelStyle={{ color: '#ffffff' }}
                        />
                        <Legend 
                            wrapperStyle={{ color: '#ffffff' }}
                        />
                        <Line type="monotone" dataKey={dataKey} stroke={color} activeDot={{ r: 8 }} />
                    </LineChart>
                );
            case 'bar':
                return (
                    <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                        <XAxis 
                            dataKey={categoryKey} 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                        />
                        <YAxis 
                            tick={{ fill: '#ffffff' }}
                            stroke="#ffffff"
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: '1px solid #ffffff20',
                                color: '#ffffff'
                            }}
                            labelStyle={{ color: '#ffffff' }}
                        />
                        <Legend 
                            wrapperStyle={{ color: '#ffffff' }}
                        />
                        <Bar dataKey={dataKey} fill={color} />
                    </BarChart>
                );
            case 'pie':
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey={dataKey}
                            nameKey={categoryKey}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: '1px solid #ffffff20',
                                color: '#ffffff'
                            }}
                            labelStyle={{ color: '#ffffff' }}
                        />
                    </PieChart>
                );
            default:
                return null;
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-white">{title}</CardTitle>
                {description && <CardDescription className="text-slate-300">{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div style={{ width: '100%', height: height }}>
                    <ResponsiveContainer>{renderChart()!}</ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};
