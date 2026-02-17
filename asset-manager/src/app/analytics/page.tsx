'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    PieChart, TrendingUp, TrendingDown, DollarSign,
    BarChart3, ArrowUpRight, ArrowDownRight, Sparkles,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Holding {
    asset_id: number; symbol: string; name: string; quantity: number;
    avg_cost: number; total_invested: number; current_price?: number;
    market_value?: number; unrealized_pl?: number; unrealized_pl_pct?: number;
}

interface PortfolioSummary {
    total_invested: number; holdings_count: number; holdings: Holding[];
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
                            const unrealizedPlPct = h.total_invested > 0 ? (unrealizedPl / h.total_invested) * 100 : 0;
                            return { ...h, current_price: currentPrice, market_value: marketValue, unrealized_pl: unrealizedPl, unrealized_pl_pct: unrealizedPlPct };
                        } catch { return h; }
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
    const totalPlPct = summary && summary.total_invested > 0 ? (totalPl / summary.total_invested) * 100 : 0;

    const stats = [
        { title: t('analytics.total_invested'), value: format(summary?.total_invested || 0), icon: DollarSign, soft: 'bg-indigo-50', iconColor: 'text-indigo-500' },
        { title: t('analytics.market_value'), value: format(totalMarketValue), icon: BarChart3, soft: 'bg-violet-50', iconColor: 'text-violet-500' },
        {
            title: t('analytics.unrealized_pl'),
            value: `${totalPl >= 0 ? '+' : ''}${format(Math.abs(totalPl))}`,
            subtitle: `${totalPlPct >= 0 ? '+' : ''}${totalPlPct.toFixed(2)}%`,
            icon: totalPl >= 0 ? TrendingUp : TrendingDown,
            soft: totalPl >= 0 ? 'bg-emerald-50' : 'bg-red-50',
            iconColor: totalPl >= 0 ? 'text-emerald-500' : 'text-red-500',
            valueColor: totalPl >= 0 ? 'text-emerald-600' : 'text-red-500',
        },
    ];

    if (loading) {
        return (
            <div className="space-y-8">
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('analytics.title')}</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl animate-shimmer" />)}
                </div>
                <div className="h-64 rounded-xl animate-shimmer" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header>
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-violet-500" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-violet-500">Portfolio</span>
                </div>
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('analytics.title')}</h1>
                <p className="text-zinc-500 mt-1 text-sm">{t('analytics.subtitle')}</p>
            </header>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.title} className="card stat-card">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`icon-badge ${stat.soft}`}>
                                    <Icon size={18} className={stat.iconColor} />
                                </div>
                                <h3 className="font-medium text-zinc-500 text-sm">{stat.title}</h3>
                            </div>
                            <p className={`text-2xl font-extrabold tracking-tight ${'valueColor' in stat ? stat.valueColor : 'text-zinc-900'}`}>
                                {stat.value}
                            </p>
                            {'subtitle' in stat && (
                                <p className={`text-sm mt-0.5 font-semibold ${'valueColor' in stat ? stat.valueColor : 'text-zinc-500'}`}>
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
                    <div className="px-6 py-4 border-b border-zinc-100/80 flex items-center gap-2">
                        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
                        <h2 className="text-base font-bold text-zinc-900">{t('analytics.holdings')} ({holdings.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[11px] text-zinc-400 uppercase tracking-wider border-b border-zinc-100/80">
                                    <th className="text-left px-6 py-3 font-semibold">{t('analytics.asset')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('analytics.qty')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('analytics.avg_cost')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('analytics.current')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('analytics.market_value')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('analytics.pl')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {holdings.map((h) => {
                                    const isProfit = (h.unrealized_pl || 0) >= 0;
                                    return (
                                        <tr key={h.asset_id} className="table-row border-b border-zinc-50">
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-sm text-zinc-900">{h.symbol}</p>
                                                <p className="text-[11px] text-zinc-400">{h.name}</p>
                                            </td>
                                            <td className="text-right px-6 py-4 font-semibold text-sm text-zinc-700">{h.quantity}</td>
                                            <td className="text-right px-6 py-4 text-sm text-zinc-500">{format(h.avg_cost)}</td>
                                            <td className="text-right px-6 py-4 font-semibold text-sm text-zinc-900">
                                                {h.current_price ? format(h.current_price) : <span className="inline-block w-12 h-4 rounded animate-shimmer" />}
                                            </td>
                                            <td className="text-right px-6 py-4 font-semibold text-sm text-zinc-900">
                                                {h.market_value ? format(h.market_value) : '---'}
                                            </td>
                                            <td className="text-right px-6 py-4">
                                                {h.unrealized_pl !== undefined ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        {isProfit ? <ArrowUpRight size={13} className="text-emerald-500" /> : <ArrowDownRight size={13} className="text-red-500" />}
                                                        <div>
                                                            <p className={`font-bold text-sm ${isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {isProfit ? '+' : '-'}{format(Math.abs(h.unrealized_pl))}
                                                            </p>
                                                            <p className={`text-[11px] ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {isProfit ? '+' : ''}{h.unrealized_pl_pct?.toFixed(2)}%
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : <span className="text-zinc-300">---</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="card text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center">
                        <PieChart size={28} className="text-violet-400" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-800">{t('analytics.no_holdings')}</h3>
                    <p className="text-zinc-500 mt-1 text-sm">{t('analytics.no_holdings_desc')}</p>
                </div>
            )}
        </div>
    );
}
