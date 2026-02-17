'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    Briefcase, TrendingUp, TrendingDown, DollarSign,
    BarChart3, ArrowUpRight, ArrowDownRight, Sparkles,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Holding {
    asset_id: number;
    symbol: string;
    name: string;
    currency: string;
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

export default function HoldingsPage() {
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalInvested, setTotalInvested] = useState(0);
    const { t } = useI18n();
    const { format, convertFrom, formatNative } = useCurrency();

    useEffect(() => {
        api.get('/portfolio/summary')
            .then(async (res) => {
                const data = res.data as PortfolioSummary;
                setTotalInvested(data.total_invested);

                // Enrich with live market data
                const enriched = await Promise.all(
                    data.holdings.map(async (h) => {
                        const holdingCurrency = h.currency || 'USD';
                        try {
                            const priceRes = await api.get(`/market/price/${h.symbol}`);
                            const currentPrice = priceRes.data.price;
                            const priceCurrency = priceRes.data.currency || holdingCurrency;
                            const marketValue = currentPrice * h.quantity;
                            const unrealizedPl = marketValue - h.total_invested;
                            const unrealizedPlPct = h.total_invested > 0
                                ? (unrealizedPl / h.total_invested) * 100
                                : 0;
                            return {
                                ...h,
                                currency: priceCurrency,
                                current_price: currentPrice,
                                market_value: marketValue,
                                unrealized_pl: unrealizedPl,
                                unrealized_pl_pct: unrealizedPlPct,
                            };
                        } catch {
                            return { ...h, currency: holdingCurrency };
                        }
                    })
                );
                setHoldings(enriched);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const totalMarketValue = holdings.reduce((sum, h) => sum + convertFrom(h.market_value || 0, h.currency || 'USD'), 0);
    const totalPl = holdings.reduce((sum, h) => sum + convertFrom(h.unrealized_pl || 0, h.currency || 'USD'), 0);
    const totalInvestedConverted = holdings.reduce((sum, h) => sum + convertFrom(h.total_invested || 0, h.currency || 'USD'), 0);
    const totalPlPct = totalInvestedConverted > 0 ? (totalPl / totalInvestedConverted) * 100 : 0;

    if (loading) {
        return (
            <div className="space-y-8">
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('holdings.title')}</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl animate-shimmer" />)}
                </div>
                <div className="h-80 rounded-xl animate-shimmer" />
            </div>
        );
    }

    const summaryCards = [
        {
            title: t('holdings.total_invested'),
            value: format(totalInvested),
            icon: DollarSign,
            soft: 'bg-indigo-50',
            iconColor: 'text-indigo-500',
        },
        {
            title: t('holdings.total_market_value'),
            value: format(totalMarketValue),
            icon: BarChart3,
            soft: 'bg-violet-50',
            iconColor: 'text-violet-500',
        },
        {
            title: t('holdings.total_pl'),
            value: `${totalPl >= 0 ? '+' : ''}${format(Math.abs(totalPl))}`,
            subtitle: `${totalPlPct >= 0 ? '+' : ''}${totalPlPct.toFixed(2)}%`,
            icon: totalPl >= 0 ? TrendingUp : TrendingDown,
            soft: totalPl >= 0 ? 'bg-emerald-50' : 'bg-red-50',
            iconColor: totalPl >= 0 ? 'text-emerald-500' : 'text-red-500',
            valueColor: totalPl >= 0 ? 'text-emerald-600' : 'text-red-500',
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <header>
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Portfolio</span>
                </div>
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('holdings.title')}</h1>
                <p className="text-zinc-500 mt-1 text-sm">{t('holdings.subtitle')}</p>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.title} className="card stat-card">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`icon-badge ${card.soft}`}>
                                    <Icon size={18} className={card.iconColor} />
                                </div>
                                <h3 className="font-medium text-zinc-500 text-sm">{card.title}</h3>
                            </div>
                            <p className={`text-2xl font-extrabold tracking-tight ${'valueColor' in card ? card.valueColor : 'text-zinc-900'}`}>
                                {card.value}
                            </p>
                            {'subtitle' in card && card.subtitle && (
                                <p className={`text-sm mt-0.5 font-semibold ${'valueColor' in card ? card.valueColor : 'text-zinc-500'}`}>
                                    {card.subtitle}
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
                        <h2 className="text-base font-bold text-zinc-900">{t('holdings.title')} ({holdings.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[11px] text-zinc-400 uppercase tracking-wider border-b border-zinc-100/80">
                                    <th className="text-left px-6 py-3 font-semibold">{t('holdings.symbol')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('holdings.qty')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('holdings.avg_cost')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('holdings.current_price')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('holdings.market_value')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('holdings.pl')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('holdings.pl_pct')}</th>
                                    <th className="text-right px-6 py-3 font-semibold">{t('holdings.allocation')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {holdings.map((h) => {
                                    const isProfit = (h.unrealized_pl || 0) >= 0;
                                    const allocation = totalMarketValue > 0
                                        ? ((h.market_value || 0) / totalMarketValue * 100)
                                        : 0;

                                    return (
                                        <tr key={h.asset_id} className="table-row border-b border-zinc-50 last:border-none">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center border border-zinc-200/50">
                                                        <span className="text-[10px] font-black text-zinc-600">{h.symbol.slice(0, 2)}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-zinc-900">{h.symbol}</p>
                                                        <p className="text-[11px] text-zinc-400">{h.name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="text-right px-6 py-4 font-semibold text-sm text-zinc-700">
                                                {h.quantity}
                                            </td>
                                            <td className="text-right px-6 py-4 text-sm text-zinc-500">
                                                {formatNative(h.avg_cost, h.currency || 'USD')}
                                            </td>
                                            <td className="text-right px-6 py-4 font-semibold text-sm text-zinc-900">
                                                {h.current_price
                                                    ? formatNative(h.current_price, h.currency || 'USD')
                                                    : <span className="inline-block w-14 h-4 rounded animate-shimmer" />
                                                }
                                            </td>
                                            <td className="text-right px-6 py-4 font-semibold text-sm text-zinc-900">
                                                {h.market_value ? formatNative(h.market_value, h.currency || 'USD') : '---'}
                                            </td>
                                            <td className="text-right px-6 py-4">
                                                {h.unrealized_pl !== undefined ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        {isProfit
                                                            ? <ArrowUpRight size={13} className="text-emerald-500" />
                                                            : <ArrowDownRight size={13} className="text-red-500" />
                                                        }
                                                        <p className={`font-bold text-sm ${isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            {isProfit ? '+' : '-'}{formatNative(Math.abs(h.unrealized_pl), h.currency || 'USD')}
                                                        </p>
                                                    </div>
                                                ) : <span className="text-zinc-300">---</span>}
                                            </td>
                                            <td className="text-right px-6 py-4">
                                                {h.unrealized_pl_pct !== undefined ? (
                                                    <span className={`text-sm font-semibold ${isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {isProfit ? '+' : ''}{h.unrealized_pl_pct.toFixed(2)}%
                                                    </span>
                                                ) : <span className="text-zinc-300">---</span>}
                                            </td>
                                            <td className="text-right px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                                            style={{ width: `${Math.min(allocation, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-zinc-500 w-12 text-right">
                                                        {allocation.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer — Totals Row */}
                    <div className="px-6 py-3 bg-zinc-50/50 border-t border-zinc-100/80 flex items-center justify-between text-sm">
                        <span className="font-bold text-zinc-700">
                            {holdings.length} {holdings.length === 1 ? 'holding' : 'holdings'}
                        </span>
                        <div className="flex items-center gap-6">
                            <span className="text-zinc-500">{t('holdings.total_invested')}: <strong className="text-zinc-900">{format(totalInvested)}</strong></span>
                            <span className="text-zinc-500">{t('holdings.total_market_value')}: <strong className="text-zinc-900">{format(totalMarketValue)}</strong></span>
                            <span className={totalPl >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                                {totalPl >= 0 ? '+' : ''}{format(Math.abs(totalPl))} ({totalPlPct >= 0 ? '+' : ''}{totalPlPct.toFixed(2)}%)
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
                        <Briefcase size={28} className="text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-800">{t('holdings.no_holdings')}</h3>
                    <p className="text-zinc-500 mt-1 text-sm">{t('holdings.no_holdings_desc')}</p>
                </div>
            )}
        </div>
    );
}
