'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
    ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown,
    Plus, Search, Calendar, DollarSign, AlertCircle,
} from 'lucide-react';

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

const txTypes = [
    { value: 'DEPOSIT', label: 'Deposit', icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { value: 'WITHDRAW', label: 'Withdraw', icon: ArrowUpRight, color: 'text-red-500', bg: 'bg-red-50' },
    { value: 'BUY', label: 'Buy', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { value: 'SELL', label: 'Sell', icon: TrendingDown, color: 'text-purple-600', bg: 'bg-purple-50' },
];

export default function TransactionsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [loading, setLoading] = useState(true);

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
                // Look up or create asset by symbol (simplified: just pass null for now)
                // In a full implementation, we'd search/create the asset first
            }

            await api.post('/transactions/', payload);
            setSuccess(`${txType} of $${total} recorded successfully!`);
            setTotal('');
            setSymbol('');
            setQuantity('');
            setPrice('');
            setNotes('');
            fetchData();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create transaction');
        } finally {
            setSubmitting(false);
        }
    };

    const getAccountName = (id: number) => accounts.find(a => a.id === id)?.name || `Account #${id}`;

    return (
        <div className="space-y-8">
            {/* Header */}
            <header>
                <h1 className="text-3xl font-bold text-slate-900">Transactions</h1>
                <p className="text-slate-500 mt-1">Record and manage your financial activities.</p>
            </header>

            {/* Transaction Form */}
            <div className="card">
                <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                    <Plus size={20} />
                    New Transaction
                </h2>

                {/* Type Selector */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {txTypes.map((t) => {
                        const Icon = t.icon;
                        const isActive = txType === t.value;
                        return (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => { setTxType(t.value); setError(''); setSuccess(''); }}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm cursor-pointer transition-smooth border-2 ${isActive
                                        ? `${t.bg} ${t.color} border-current`
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                <Icon size={18} />
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Account Selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Account</label>
                        <select
                            value={accountId}
                            onChange={(e) => setAccountId(Number(e.target.value))}
                            required
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="">Select account...</option>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.currency}) — ${a.balance.toLocaleString()}</option>
                            ))}
                        </select>
                    </div>

                    {/* Trade-specific fields */}
                    {isTradeType && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    <Search size={14} className="inline mr-1" />Symbol
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Price per unit</label>
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
                            {isTradeType ? 'Total Amount (auto-calculated)' : 'Amount'}
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
                        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Salary, Rent, etc."
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
                        {submitting ? 'Recording...' : `Record ${txTypes.find(t => t.value === txType)?.label}`}
                    </button>
                </form>
            </div>

            {/* Transaction History */}
            <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar size={20} />
                    Recent Transactions
                </h2>

                {loading ? (
                    <div className="card animate-pulse h-24" />
                ) : transactions.length === 0 ? (
                    <div className="card text-center py-12">
                        <DollarSign size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700">No transactions yet</h3>
                        <p className="text-slate-500 mt-1">Use the form above to record your first transaction.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {transactions.map((tx) => {
                            const txMeta = txTypes.find(t => t.value === tx.type);
                            const Icon = txMeta?.icon || DollarSign;
                            const isInflow = tx.type === 'DEPOSIT' || tx.type === 'SELL';
                            return (
                                <div key={tx.id} className="card flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-lg ${txMeta?.bg || 'bg-slate-50'}`}>
                                            <Icon size={20} className={txMeta?.color || 'text-slate-500'} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{tx.type}</p>
                                            <p className="text-xs text-slate-500">
                                                {getAccountName(tx.account_id)} • {new Date(tx.date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${isInflow ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {isInflow ? '+' : '-'}${tx.total.toLocaleString()}
                                        </p>
                                        {tx.quantity && (
                                            <p className="text-xs text-slate-500">{tx.quantity} × ${tx.price?.toLocaleString()}</p>
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
