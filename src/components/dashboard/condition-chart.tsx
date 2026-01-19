'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

// Condition colors - traffic light system
const CONDITION_COLORS: Record<string, string> = {
    EXCELLENT: '#22c55e', // Green
    GOOD: '#84cc16',      // Lime
    FAIR: '#f59e0b',      // Amber
    POOR: '#ef4444',      // Red
};

const CONDITION_LABELS: Record<string, string> = {
    EXCELLENT: 'Excellent',
    GOOD: 'Good',
    FAIR: 'Fair',
    POOR: 'Poor',
};

// Define order for conditions
const CONDITION_ORDER = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'];

interface ConditionData {
    condition: string;
    count: number;
}

interface ConditionChartProps {
    data: ConditionData[];
}

/**
 * Condition Health Chart
 * 
 * Displays a horizontal bar chart showing asset condition distribution.
 * Uses traffic light colors for intuitive health assessment.
 */
export function ConditionChart({ data }: ConditionChartProps) {
    const total = data.reduce((sum, item) => sum + item.count, 0);

    // Handle empty state
    if (total === 0) {
        return (
            <div className="flex h-48 items-center justify-center text-zinc-500">
                No assets to display
            </div>
        );
    }

    // Transform and sort by condition order
    const chartData = CONDITION_ORDER
        .map((condition) => {
            const item = data.find((d) => d.condition === condition);
            return {
                name: CONDITION_LABELS[condition],
                count: item?.count || 0,
                condition,
                percentage: item ? ((item.count / total) * 100).toFixed(0) : '0',
            };
        })
        .filter((item) => item.count > 0);

    return (
        <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 60, left: 5, bottom: 5 }}
                >
                    <XAxis
                        type="number"
                        hide
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#71717a' }}
                        width={70}
                    />
                    <Tooltip
                        formatter={(value) => {
                            const numValue = Number(value) || 0;
                            return [`${numValue} assets`, 'Count'];
                        }}
                        contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e4e4e7',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                    />
                    <Bar
                        dataKey="count"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={20}
                    >
                        {chartData.map((entry) => (
                            <Cell
                                key={`cell-${entry.condition}`}
                                fill={CONDITION_COLORS[entry.condition]}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
