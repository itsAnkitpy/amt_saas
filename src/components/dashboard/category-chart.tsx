'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

interface CategoryData {
    name: string;
    count: number;
}

interface CategoryChartProps {
    data: CategoryData[];
}

// Generate shades of violet for categories
function getBarColor(index: number, total: number): string {
    // Use violet as base color with varying opacity
    const baseOpacity = 0.4;
    const maxOpacity = 1;
    const opacity = maxOpacity - ((index / Math.max(total - 1, 1)) * (maxOpacity - baseOpacity));
    return `rgba(139, 92, 246, ${opacity})`; // violet-500 with varying opacity
}

/**
 * Category Breakdown Chart
 * 
 * Displays a horizontal bar chart showing asset counts by category.
 * Uses brand violet color with opacity variations.
 */
export function CategoryChart({ data }: CategoryChartProps) {
    // Handle empty state
    if (data.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center text-zinc-500">
                No categories to display
            </div>
        );
    }

    // Sort by count descending and take all categories
    const sortedData = [...data].sort((a, b) => b.count - a.count);

    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={sortedData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                >
                    <XAxis
                        type="number"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#71717a' }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#71717a' }}
                        width={100}
                    />
                    <Tooltip
                        formatter={(value) => [`${Number(value) || 0} assets`, 'Count']}
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
                        maxBarSize={30}
                    >
                        {sortedData.map((_, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={getBarColor(index, sortedData.length)}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
