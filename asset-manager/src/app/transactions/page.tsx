'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
    ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown,
    Plus, Search, Calendar, DollarSign, AlertCircle,
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Account {
    id: number;
    name: string;
    type: string;
    currency: string;
    balance: number;
}

interface TransactionRecord {
    id: number;
    date: string;
    type: string;
    account_id: number;
    asset_id: number | null;
    quantity: number | null;
    price: number | null;
    fee: number | null;
    total: number;
    notes: string | null;
}

export default function TransactionsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useI18n();
    const { format } = useCurrency();

    // Form State
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
        { value: 'DEPOSIT', label: t('tx.deposit'), icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { value: 'WITHDRAW', label: t('tx.withdraw'), icon: ArrowUpRight, color: 'text-red-500', bg: 'bg-red-50' },
        { value: 'BUY', label: t('tx.buy'), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        { value: 'SELL', label: t('tx.sell'), icon: TrendingDown, color: 'text-purple-600', bg: 'bg-purple-50' },
    ];

    const isTradeType = txType === 'BUY' || txType === 'SELL';

    const fetchData = useCallback(() => {
        Promise.all([
            api.get('/accounts/'),
            api.get('/transactions/'),
        ]).then(([accRes, txRes]) => {
            setAccounts(accRes.data);
            setTransactions(txRes.data);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-calculate total for trade types
    useEffect(() => {
        if (isTradeType && quantity && price) {
            setTotal((parseFloat(quantity) * parseFloat(price)).toFixed(2));
        }
    }, [quantity, price, isTradeType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSubmitting(true);

        try {
            const payload: Record<string, unknown> = {
                type: txType,
                account_id: accountId,
                total: parseFloat(total),
                date: new Date().toISOString(),
                notes: notes || null,
            };

            if (isTradeType) {
                payload.quantity = parseFloat(quantity);
                payload.price = parseFloat(price);
            }

            await api.post('/transactions/', payload);
            const txLabel = txTypes.find(tx => tx.value === txType)?.label || txType;
            setSuccess(`${txLabel} $${total} ${t('tx.success')}`);
            setTotal('');
            setSymbol('');
            setQuantity('');
            setPrice('');
            setNotes('');
            fetchData();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.response?.data?.detail || t('tx.insufficient'));
        } finally {
            setSubmitting(false);
        }
    };

    const getAccountName = (id: number) => accounts.find(a => a.id === id)?.name || `Account #${id}`;

    return (
        <div className="space-y-8">
            {/* Header */}
            <header>
                <h1 className="text-3xl font-bold text-slate-900">{t('tx.title')}</h1>
                <p className="text-slate-500 mt-1">{t('tx.subtitle')}</p>
            </header>

            {/* Transaction Form */}
            <div className="card">
                <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                    <Plus size={20} />
                    {t('tx.new')}
                </h2>

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
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm cursor-pointer transition-smooth border-2 ${isActive
                                        ? `${txItem.bg} ${txItem.color} border-current`
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <Icon size={18} />
                                {txItem.label}
                            </button>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Account Selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('tx.account')}</label>
                        <select
                            value={accountId}
                            onChange={(e) => setAccountId(Number(e.target.value))}
                            required
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="">{t('tx.select_account')}</option>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.currency}) — {format(a.balance)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Trade-specific fields */}
                    {isTradeType && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Search size={14} className="inline mr-1" />{t('tx.symbol')}
                                </label>
                                <input
                                    type="text"
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                    placeholder="e.g. AAPL"
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('tx.quantity')}</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="10"
                                    required
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('tx.price_per_unit')}</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="150.00"
                                    required
                                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            <DollarSign size={14} className="inline mr-1" />
                            {isTradeType ? t('tx.total_auto') : t('tx.amount')}
                        </label>
                        <input
                            type="number"
                            step="any"
                            value={total}
                            onChange={(e) => setTotal(e.target.value)}
                            placeholder="1000.00"
                            required
                            readOnly={isTradeType}
                            className={`w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isTradeType ? 'bg-slate-50' : ''}`}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('tx.notes')}</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={t('tx.notes_placeholder')}
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Error / Success Messages */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-3 rounded-lg text-sm">
                            <ArrowDownLeft size={16} />
                            {success}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 rounded-lg text-white font-medium cursor-pointer transition-smooth disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {submitting ? t('tx.recording') : `${t('tx.record')} ${txTypes.find(tx => tx.value === txType)?.label}`}
                    </button>
                </form>
            </div>

            {/* Transaction History */}
            <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar size={20} />
                    {t('tx.recent')}
                </h2>

                {loading ? (
                    <div className="card animate-pulse h-24" />
                ) : transactions.length === 0 ? (
                    <div className="card text-center py-12">
                        <DollarSign size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700">{t('tx.no_transactions')}</h3>
                        <p className="text-slate-500 mt-1">{t('tx.no_transactions_desc')}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {transactions.map((tx) => {
                            const txMeta = txTypes.find(txItem => txItem.value === tx.type);
                            const Icon = txMeta?.icon || DollarSign;
                            const isInflow = tx.type === 'DEPOSIT' || tx.type === 'SELL';
                            return (
                                <div key={tx.id} className="card flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-lg ${txMeta?.bg || 'bg-slate-50'}`}>
                                            <Icon size={20} className={txMeta?.color || 'text-slate-500'} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{txMeta?.label || tx.type}</p>
                                            <p className="text-xs text-slate-500">
                                                {getAccountName(tx.account_id)} • {new Date(tx.date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${isInflow ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {isInflow ? '+' : '-'}{format(tx.total)}
                                        </p>
                                        {tx.quantity && (
                                            <p className="text-xs text-slate-500">{tx.quantity} × {format(tx.price || 0)}</p>
                                        )}
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
