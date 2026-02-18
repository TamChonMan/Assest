'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface AllocationChartProps {
    data: { name: string; value: number; color?: string }[];
}

const COLORS = [
    '#6366f1', // Indigo 500
    '#8b5cf6', // Violet 500
    '#ec4899', // Pink 500
    '#f43f5e', // Rose 500
    '#10b981', // Emerald 500
    '#3b82f6', // Blue 500
    '#f59e0b', // Amber 500
];

export default function AllocationChart({ data }: AllocationChartProps) {
    const { t } = useI18n();
    const { formatNative, currency } = useCurrency();

    // Sort by value desc
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    // Add colors
    const chartData = sortedData.map((item, index) => ({
        ...item,
        color: item.color || COLORS[index % COLORS.length]
    }));

    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-zinc-400 text-sm">
                No data available
            </div>
        );
    }

    return (
        <div className="h-64 flex items-center">
            <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: any) => formatNative(Number(value), currency)}
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff' }}
                            itemStyle={{ color: '#e4e4e7' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {/* Custom Legend */}
            <div className="w-1/3 pl-4 space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {chartData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-zinc-600 truncate flex-1">{item.name}</span>
                        <span className="font-semibold text-zinc-900">{((item.value / chartData.reduce((a, b) => a + b.value, 0)) * 100).toFixed(0)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
