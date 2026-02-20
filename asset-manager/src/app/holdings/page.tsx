'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    Briefcase, TrendingUp, TrendingDown, DollarSign,
    BarChart3, ArrowUpRight, ArrowDownRight, Sparkles,
    Building2, Tag as TagIcon, Edit2, X, Check
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Tag {
    id: number;
    name: string;
    color: string;
}

interface Holding {
    account_id: number;
    account_name: string;
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
    tags?: Tag[];
}

interface PortfolioSummary {
    total_invested: number;
    holdings_count: number;
    holdings: Holding[];
}

interface AccountGroup {
    account_id: number;
    account_name: string;
    holdings: Holding[];
}

export default function HoldingsPage() {
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

    const [loading, setLoading] = useState(true);
    const [totalInvested, setTotalInvested] = useState(0);
    const { t } = useI18n();
    const { format, convertFrom, formatNative, currency } = useCurrency();

    useEffect(() => {
        fetchData();
        fetchTags();
    }, []);

    const fetchTags = async () => {
        try {
            const res = await api.get('/tags/');
            setAllTags(res.data);
        } catch (error) {
            console.error('Failed to fetch tags', error);
        }
    };

    const fetchData = () => {
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
    };

    const handleEditTags = (assetId: number, currentTags: Tag[] = []) => {
        setEditingAssetId(assetId);
        setSelectedTagIds(currentTags.map(t => t.id));
    };

    const handleSaveTags = async () => {
        if (!editingAssetId) return;
        try {
            await api.put(`/assets/${editingAssetId}/tags`, selectedTagIds);
            setEditingAssetId(null);
            fetchData(); // Refresh to show new tags
        } catch (error) {
            console.error('Failed to save tags', error);
            alert('Failed to save tags');
        }
    };

    const toggleTagSelection = (tagId: number) => {
        if (selectedTagIds.includes(tagId)) {
            setSelectedTagIds(selectedTagIds.filter(id => id !== tagId));
        } else {
            setSelectedTagIds([...selectedTagIds, tagId]);
        }
    };

    // Global totals (in Selected Currency)
    const totalMarketValue = holdings.reduce((sum, h) => sum + convertFrom(h.market_value || 0, h.currency || 'USD'), 0);
    const totalPl = holdings.reduce((sum, h) => sum + convertFrom(h.unrealized_pl || 0, h.currency || 'USD'), 0);
    const totalInvestedConverted = holdings.reduce((sum, h) => sum + convertFrom(h.total_invested || 0, h.currency || 'USD'), 0);
    const totalPlPct = totalInvestedConverted > 0 ? (totalPl / totalInvestedConverted) * 100 : 0;

    // Group holdings by account
    const accountGroups: AccountGroup[] = [];
    const accountMap = new Map<number, AccountGroup>();
    for (const h of holdings) {
        let group = accountMap.get(h.account_id);
        if (!group) {
            group = { account_id: h.account_id, account_name: h.account_name, holdings: [] };
            accountMap.set(h.account_id, group);
            accountGroups.push(group);
        }
        group.holdings.push(h);
    }

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
            value: formatNative(totalInvestedConverted, currency),
            icon: DollarSign,
            soft: 'bg-indigo-50',
            iconColor: 'text-indigo-500',
        },
        {
            title: t('holdings.total_market_value'),
            value: formatNative(totalMarketValue, currency),
            icon: BarChart3,
            soft: 'bg-violet-50',
            iconColor: 'text-violet-500',
        },
        {
            title: t('holdings.total_pl'),
            value: `${totalPl >= 0 ? '+' : ''}${formatNative(Math.abs(totalPl), currency)}`,
            subtitle: `${totalPlPct >= 0 ? '+' : ''}${totalPlPct.toFixed(2)}%`,
            icon: totalPl >= 0 ? TrendingUp : TrendingDown,
            soft: totalPl >= 0 ? 'bg-emerald-50' : 'bg-red-50',
            iconColor: totalPl >= 0 ? 'text-emerald-500' : 'text-red-500',
            valueColor: totalPl >= 0 ? 'text-emerald-600' : 'text-red-500',
        },
    ];

    // Accent colors for different account sections
    const accountAccents = [
        { from: 'from-indigo-500', to: 'to-violet-500', badge: 'bg-indigo-50', text: 'text-indigo-600' },
        { from: 'from-emerald-500', to: 'to-teal-500', badge: 'bg-emerald-50', text: 'text-emerald-600' },
        { from: 'from-amber-500', to: 'to-orange-500', badge: 'bg-amber-50', text: 'text-amber-600' },
        { from: 'from-rose-500', to: 'to-pink-500', badge: 'bg-rose-50', text: 'text-rose-600' },
        { from: 'from-cyan-500', to: 'to-blue-500', badge: 'bg-cyan-50', text: 'text-cyan-600' },
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

            {/* Holdings Grouped by Account */}
            {accountGroups.length > 0 ? (
                <div className="space-y-6">
                    {accountGroups.map((group, groupIdx) => {
                        const accent = accountAccents[groupIdx % accountAccents.length];
                        const groupMV = group.holdings.reduce((s, h) => s + convertFrom(h.market_value || 0, h.currency || 'USD'), 0);
                        const groupPl = group.holdings.reduce((s, h) => s + convertFrom(h.unrealized_pl || 0, h.currency || 'USD'), 0);
                        const groupInvested = group.holdings.reduce((s, h) => s + convertFrom(h.total_invested || 0, h.currency || 'USD'), 0);
                        const groupPlPct = groupInvested > 0 ? (groupPl / groupInvested) * 100 : 0;

                        return (
                            <div key={group.account_id} className="card overflow-hidden p-0">
                                {/* Account Header */}
                                <div className="px-6 py-4 border-b border-zinc-100/80 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${accent.from} ${accent.to}`} />
                                        <div className={`icon-badge ${accent.badge}`}>
                                            <Building2 size={16} className={accent.text} />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-bold text-zinc-900">{group.account_name}</h2>
                                            <p className="text-[11px] text-zinc-400">{group.holdings.length} {group.holdings.length === 1 ? 'holding' : 'holdings'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="text-zinc-500">{t('holdings.total_market_value')}: <strong className="text-zinc-900">{formatNative(groupMV, currency)}</strong></span>
                                        <span className={groupPl >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                                            {groupPl >= 0 ? '+' : ''}{formatNative(Math.abs(groupPl), currency)} ({groupPlPct >= 0 ? '+' : ''}{groupPlPct.toFixed(2)}%)
                                        </span>
                                    </div>
                                </div>

                                {/* Holdings Table */}
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
                                            {group.holdings.map((h) => {
                                                const isProfit = (h.unrealized_pl || 0) >= 0;
                                                const allocation = totalMarketValue > 0
                                                    ? (convertFrom(h.market_value || 0, h.currency || 'USD') / totalMarketValue * 100)
                                                    : 0;

                                                return (
                                                    <tr key={`${h.account_id}-${h.asset_id}`} className="table-row border-b border-zinc-50 last:border-none">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center border border-zinc-200/50">
                                                                    <span className="text-[10px] font-black text-zinc-600">{h.symbol.slice(0, 2)}</span>
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                                                                        {h.symbol}
                                                                        <button
                                                                            onClick={() => handleEditTags(h.asset_id, h.tags)}
                                                                            className="text-zinc-300 hover:text-indigo-500 transition-colors"
                                                                        >
                                                                            <Edit2 size={12} />
                                                                        </button>
                                                                    </p>
                                                                    <p className="text-[11px] text-zinc-400">{h.name}</p>
                                                                    {h.tags && h.tags.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {h.tags.map(t => (
                                                                                <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-600 border border-zinc-200" style={{ borderColor: t.color + '40', backgroundColor: t.color + '10', color: t.color }}>
                                                                                    {t.name}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
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
                                                                        className={`h-full rounded-full bg-gradient-to-r ${accent.from} ${accent.to}`}
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

                                {/* Account Footer */}
                                <div className="px-6 py-3 bg-zinc-50/50 border-t border-zinc-100/80 flex items-center justify-between text-sm">
                                    <span className="font-bold text-zinc-700">
                                        {group.holdings.length} {group.holdings.length === 1 ? 'holding' : 'holdings'}
                                    </span>
                                    <div className="flex items-center gap-6">
                                        <span className="text-zinc-500">{t('holdings.total_invested')}: <strong className="text-zinc-900">{formatNative(groupInvested, currency)}</strong></span>
                                        <span className="text-zinc-500">{t('holdings.total_market_value')}: <strong className="text-zinc-900">{formatNative(groupMV, currency)}</strong></span>
                                        <span className={groupPl >= 0 ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                                            {groupPl >= 0 ? '+' : ''}{formatNative(Math.abs(groupPl), currency)} ({groupPlPct >= 0 ? '+' : ''}{groupPlPct.toFixed(2)}%)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
            {/* Tag Edit Modal */}
            {editingAssetId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                            <h3 className="font-bold text-lg text-zinc-900">Edit Tags</h3>
                            <button onClick={() => setEditingAssetId(null)} className="text-zinc-400 hover:text-zinc-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <p className="text-sm text-zinc-500">Select tags for this asset:</p>
                                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                                    {allTags.map(tag => {
                                        const isSelected = selectedTagIds.includes(tag.id);
                                        return (
                                            <button
                                                key={tag.id}
                                                onClick={() => toggleTagSelection(tag.id)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-2
                                                    ${isSelected
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                                                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                                                    }`}
                                            >
                                                {isSelected && <Check size={12} />}
                                                {tag.name}
                                            </button>
                                        );
                                    })}
                                    {allTags.length === 0 && (
                                        <p className="text-sm text-zinc-400 italic w-full text-center">No tags available. Go to Settings to create tags.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingAssetId(null)}
                                className="px-4 py-2 rounded-xl font-medium text-sm text-zinc-600 hover:bg-zinc-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveTags}
                                className="px-4 py-2 rounded-xl font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
