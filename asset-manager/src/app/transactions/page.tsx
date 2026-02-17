'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
    ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown,
    Plus, Search, Calendar, DollarSign, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Account {
    id: number; name: string; type: string; currency: string; balance: number;
}

interface TransactionRecord {
    id: number; date: string; type: string; account_id: number; asset_id: number | null;
    quantity: number | null; price: number | null; fee: number | null; total: number; notes: string | null;
}

export default function TransactionsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useI18n();
    const { format } = useCurrency();

    const [txType, setTxType] = useState('DEPOSIT');
    const [accountId, setAccountId] = useState<number | ''>('');
    const [total, setTotal] = useState('');
    const [symbol, setSymbol] = useState('');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');

    const txTypes = [
        { value: 'DEPOSIT', label: t('tx.deposit'), icon: ArrowDownLeft, gradient: 'from-emerald-500 to-teal-500', soft: 'bg-emerald-50', color: 'text-emerald-600' },
        { value: 'WITHDRAW', label: t('tx.withdraw'), icon: ArrowUpRight, gradient: 'from-red-500 to-rose-500', soft: 'bg-red-50', color: 'text-red-500' },
        { value: 'BUY', label: t('tx.buy'), icon: TrendingUp, gradient: 'from-indigo-500 to-blue-500', soft: 'bg-indigo-50', color: 'text-indigo-600' },
        { value: 'SELL', label: t('tx.sell'), icon: TrendingDown, gradient: 'from-violet-500 to-purple-500', soft: 'bg-violet-50', color: 'text-violet-600' },
    ];

    const isTradeType = txType === 'BUY' || txType === 'SELL';

    const fetchData = useCallback(() => {
        Promise.all([api.get('/accounts/'), api.get('/transactions/')])
            .then(([accRes, txRes]) => { setAccounts(accRes.data); setTransactions(txRes.data); })
            .catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (isTradeType && quantity && price) {
            setTotal((parseFloat(quantity) * parseFloat(price)).toFixed(2));
        }
    }, [quantity, price, isTradeType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setSuccess(''); setSubmitting(true);
        try {
            const payload: Record<string, unknown> = {
                type: txType, account_id: accountId, total: parseFloat(total),
                date: new Date().toISOString(), notes: notes || null,
            };
            if (isTradeType) { payload.quantity = parseFloat(quantity); payload.price = parseFloat(price); }
            await api.post('/transactions/', payload);
            const txLabel = txTypes.find(tx => tx.value === txType)?.label || txType;
            setSuccess(`${txLabel} $${total} ${t('tx.success')}`);
            setTotal(''); setSymbol(''); setQuantity(''); setPrice(''); setNotes('');
            fetchData();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) { setError(err.response?.data?.detail || t('tx.insufficient')); }
        finally { setSubmitting(false); }
    };

    const getAccountName = (id: number) => accounts.find(a => a.id === id)?.name || `#${id}`;

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('tx.title')}</h1>
                <p className="text-zinc-500 mt-1 text-sm">{t('tx.subtitle')}</p>
            </header>

            {/* Form Card */}
            <div className="card">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
                    <h2 className="text-lg font-bold text-zinc-900">{t('tx.new')}</h2>
                </div>

                {/* Type Selector */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {txTypes.map((txItem) => {
                        const Icon = txItem.icon;
                        const isActive = txType === txItem.value;
                        return (
                            <button
                                key={txItem.value}
                                type="button"
                                onClick={() => { setTxType(txItem.value); setError(''); setSuccess(''); }}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-smooth border ${isActive
                                        ? `${txItem.soft} ${txItem.color} border-current shadow-sm`
                                        : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300 hover:text-zinc-500'
                                    }`}
                            >
                                <Icon size={16} />
                                {txItem.label}
                            </button>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('tx.account')}</label>
                        <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} required className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none cursor-pointer">
                            <option value="">{t('tx.select_account')}</option>
                            {accounts.map(a => (<option key={a.id} value={a.id}>{a.name} ({a.currency}) — {format(a.balance)}</option>))}
                        </select>
                    </div>

                    {isTradeType && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5"><Search size={13} className="inline mr-1" />{t('tx.symbol')}</label>
                                <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL" className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('tx.quantity')}</label>
                                <input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10" required className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('tx.price_per_unit')}</label>
                                <input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="150.00" required className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none" />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
                            <DollarSign size={13} className="inline mr-1" />{isTradeType ? t('tx.total_auto') : t('tx.amount')}
                        </label>
                        <input type="number" step="any" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="1000.00" required readOnly={isTradeType} className={`w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none ${isTradeType ? 'bg-zinc-50 text-zinc-500' : ''}`} />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('tx.notes')}</label>
                        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('tx.notes_placeholder')} className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none" />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm font-medium">
                            <AlertCircle size={16} />{error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-lg text-sm font-medium">
                            <CheckCircle2 size={16} />{success}
                        </div>
                    )}

                    <button type="submit" disabled={submitting} className="w-full btn-primary disabled:opacity-50">
                        {submitting ? t('tx.recording') : `${t('tx.record')} ${txTypes.find(tx => tx.value === txType)?.label}`}
                    </button>
                </form>
            </div>

            {/* History */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-500 to-purple-500" />
                    <h2 className="text-lg font-bold text-zinc-900">{t('tx.recent')}</h2>
                </div>

                {loading ? (
                    <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl animate-shimmer" />)}</div>
                ) : transactions.length === 0 ? (
                    <div className="card text-center py-12">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-zinc-50 flex items-center justify-center">
                            <Calendar size={24} className="text-zinc-300" />
                        </div>
                        <h3 className="text-base font-bold text-zinc-700">{t('tx.no_transactions')}</h3>
                        <p className="text-zinc-500 mt-1 text-sm">{t('tx.no_transactions_desc')}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {transactions.map((tx) => {
                            const txMeta = txTypes.find(txItem => txItem.value === tx.type);
                            const Icon = txMeta?.icon || DollarSign;
                            const isInflow = tx.type === 'DEPOSIT' || tx.type === 'SELL';
                            return (
                                <div key={tx.id} className="card flex items-center justify-between py-3 px-5">
                                    <div className="flex items-center gap-3">
                                        <div className={`icon-badge ${txMeta?.soft || 'bg-zinc-50'}`}>
                                            <Icon size={16} className={txMeta?.color || 'text-zinc-400'} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-zinc-900">{txMeta?.label || tx.type}</p>
                                            <p className="text-[11px] text-zinc-400">{getAccountName(tx.account_id)} • {new Date(tx.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-sm ${isInflow ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {isInflow ? '+' : '-'}{format(tx.total)}
                                        </p>
                                        {tx.quantity && <p className="text-[11px] text-zinc-400">{tx.quantity} × {format(tx.price || 0)}</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
