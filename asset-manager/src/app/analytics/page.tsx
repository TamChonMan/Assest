'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    PieChart, TrendingUp, TrendingDown, DollarSign,
    BarChart3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Holding {
    asset_id: number;
    symbol: string;
    name: string;
    quantity: number;
    avg_cost: number;
    total_invested: number;
    current_price?: number;
    market_value?: number;
    unrealized_pl?: number;
    unrealized_pl_pct?: number;
}

interface PortfolioSummary {
    total_invested: number;
    holdings_count: number;
    holdings: Holding[];
}

export default function AnalyticsPage() {
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useI18n();
    const { format } = useCurrency();

    useEffect(() => {
        api.get('/portfolio/summary')
            .then(async (res) => {
                const data = res.data as PortfolioSummary;

                const enriched = await Promise.all(
                    data.holdings.map(async (h) => {
                        try {
                            const priceRes = await api.get(`/market/price/${h.symbol}`);
                            const currentPrice = priceRes.data.price;
                            const marketValue = currentPrice * h.quantity;
                            const unrealizedPl = marketValue - h.total_invested;
                            const unrealizedPlPct = h.total_invested > 0
                                ? (unrealizedPl / h.total_invested) * 100
                                : 0;
                            return {
                                ...h,
                                current_price: currentPrice,
                                market_value: marketValue,
                                unrealized_pl: unrealizedPl,
                                unrealized_pl_pct: unrealizedPlPct,
                            };
                        } catch {
                            return h;
                        }
                    })
                );

                setSummary(data);
                setHoldings(enriched);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const totalMarketValue = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);
    const totalPl = holdings.reduce((sum, h) => sum + (h.unrealized_pl || 0), 0);
    const totalPlPct = summary && summary.total_invested > 0
        ? (totalPl / summary.total_invested) * 100
        : 0;

    const stats = [
        {
            title: t('analytics.total_invested'),
            value: format(summary?.total_invested || 0),
            icon: DollarSign,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
        },
        {
            title: t('analytics.market_value'),
            value: format(totalMarketValue),
            icon: BarChart3,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-600',
        },
        {
            title: t('analytics.unrealized_pl'),
            value: `${totalPl >= 0 ? '+' : ''}${format(Math.abs(totalPl))}`,
            subtitle: `${totalPlPct >= 0 ? '+' : ''}${totalPlPct.toFixed(2)}%`,
            icon: totalPl >= 0 ? TrendingUp : TrendingDown,
            iconBg: totalPl >= 0 ? 'bg-emerald-50' : 'bg-red-50',
            iconColor: totalPl >= 0 ? 'text-emerald-600' : 'text-red-500',
            valueColor: totalPl >= 0 ? 'text-emerald-600' : 'text-red-500',
        },
    ];

    if (loading) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold text-slate-900">{t('analytics.title')}</h1>
                <div className="grid grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="card h-28 animate-pulse" />)}
                </div>
                <div className="card h-64 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <header>
                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <PieChart size={28} className="text-purple-600" />
                    {t('analytics.title')}
                </h1>
                <p className="text-slate-500 mt-1">{t('analytics.subtitle')}</p>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.title} className="card">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2.5 rounded-lg ${stat.iconBg}`}>
                                    <Icon size={20} className={stat.iconColor} />
                                </div>
                                <h3 className="font-medium text-slate-500 text-sm">{stat.title}</h3>
                            </div>
                            <p className={`text-2xl font-bold tracking-tight ${'valueColor' in stat ? stat.valueColor : 'text-slate-900'}`}>
                                {stat.value}
                            </p>
                            {'subtitle' in stat && (
                                <p className={`text-sm mt-1 font-medium ${'valueColor' in stat ? stat.valueColor : 'text-slate-500'}`}>
                                    {stat.subtitle}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Holdings Table */}
            {holdings.length > 0 ? (
                <div className="card overflow-hidden p-0">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-semibold text-slate-900">{t('analytics.holdings')} ({holdings.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                                    <th className="text-left px-6 py-3 font-medium">{t('analytics.asset')}</th>
                                    <th className="text-right px-6 py-3 font-medium">{t('analytics.qty')}</th>
                                    <th className="text-right px-6 py-3 font-medium">{t('analytics.avg_cost')}</th>
                                    <th className="text-right px-6 py-3 font-medium">{t('analytics.current')}</th>
                                    <th className="text-right px-6 py-3 font-medium">{t('analytics.market_value')}</th>
                                    <th className="text-right px-6 py-3 font-medium">{t('analytics.pl')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {holdings.map((h) => {
                                    const isProfit = (h.unrealized_pl || 0) >= 0;
                                    return (
                                        <tr key={h.asset_id} className="border-b border-slate-50 hover:bg-slate-50 transition-smooth">
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-slate-900">{h.symbol}</p>
                                                <p className="text-xs text-slate-500">{h.name}</p>
                                            </td>
                                            <td className="text-right px-6 py-4 font-medium text-slate-700">
                                                {h.quantity}
                                            </td>
                                            <td className="text-right px-6 py-4 text-slate-600">
                                                {format(h.avg_cost)}
                                            </td>
                                            <td className="text-right px-6 py-4 font-medium text-slate-900">
                                                {h.current_price ? format(h.current_price) : '---'}
                                            </td>
                                            <td className="text-right px-6 py-4 font-medium text-slate-900">
                                                {h.market_value ? format(h.market_value) : '---'}
                                            </td>
                                            <td className="text-right px-6 py-4">
                                                {h.unrealized_pl !== undefined ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        {isProfit ? (
                                                            <ArrowUpRight size={14} className="text-emerald-600" />
                                                        ) : (
                                                            <ArrowDownRight size={14} className="text-red-500" />
                                                        )}
                                                        <div>
                                                            <p className={`font-bold ${isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {isProfit ? '+' : '-'}{format(Math.abs(h.unrealized_pl))}
                                                            </p>
                                                            <p className={`text-xs ${isProfit ? 'text-emerald-500' : 'text-red-400'}`}>
                                                                {isProfit ? '+' : ''}{h.unrealized_pl_pct?.toFixed(2)}%
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">---</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="card text-center py-12">
                    <PieChart size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700">{t('analytics.no_holdings')}</h3>
                    <p className="text-slate-500 mt-1">{t('analytics.no_holdings_desc')}</p>
                </div>
            )}
        </div>
    );
}
