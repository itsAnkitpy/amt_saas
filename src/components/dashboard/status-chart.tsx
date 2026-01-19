'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

// Status colors matching our design system
const STATUS_COLORS: Record<string, string> = {
    AVAILABLE: '#22c55e',    // Green
    ASSIGNED: '#3b82f6',     // Blue
    MAINTENANCE: '#f59e0b',  // Amber
    RETIRED: '#94a3b8',      // Gray
};

const STATUS_LABELS: Record<string, string> = {
    AVAILABLE: 'Available',
    ASSIGNED: 'Assigned',
    MAINTENANCE: 'Maintenance',
    RETIRED: 'Retired',
};

interface StatusData {
    status: string;
    count: number;
}

interface StatusChartProps {
    data: StatusData[];
}

/**
 * Status Distribution Chart
 * 
 * Displays a donut chart showing the distribution of assets by status.
 * Uses semantic colors for intuitive understanding.
 */
export function StatusChart({ data }: StatusChartProps) {
    // Transform data for Recharts
    const chartData = data.map((item) => ({
        name: STATUS_LABELS[item.status] || item.status,
        value: item.count,
        status: item.status,
    }));

    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    // Handle empty state
    if (total === 0) {
        return (
            <div className="flex h-64 items-center justify-center text-zinc-500">
                No assets to display
            </div>
        );
    }

    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={STATUS_COLORS[entry.status] || '#94a3b8'}
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(value, name) => {
                            const numValue = Number(value) || 0;
                            return [
                                `${numValue} (${((numValue / total) * 100).toFixed(0)}%)`,
                                name,
                            ];
                        }}
                        contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e4e4e7',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                    />
                    <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        iconType="circle"
                        iconSize={10}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
