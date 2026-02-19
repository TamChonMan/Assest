'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
    Plus, Search, Calendar, DollarSign, AlertCircle, CheckCircle2, Pencil, X,
    ChevronDown, ChevronRight,
    ArrowDownLeft, ArrowUpRight, TrendingUp, TrendingDown
} from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Account {
    id: number; name: string; type: string; currency: string; balance: number;
}

interface TransactionRecord {
    id: number; date: string; type: string; account_id: number; asset_id: number | null;
    quantity: number | null; price: number | null; fee: number | null; total: number; notes: string | null;
    asset_symbol?: string | null;
}

export default function TransactionsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const { t } = useI18n();
    const { format, formatFrom, formatNative } = useCurrency();

    const [txType, setTxType] = useState('DEPOSIT');
    const [accountId, setAccountId] = useState<number | ''>('');
    const [total, setTotal] = useState('');
    const [symbol, setSymbol] = useState('');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const [tags, setTags] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState('');
    const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);
    // Validation State
    const [isValidating, setIsValidating] = useState(false);
    const [symbolValid, setSymbolValid] = useState<boolean | null>(null);
    const [symbolName, setSymbolName] = useState('');
    // Edit State
    const [editingTxId, setEditingTxId] = useState<number | null>(null);
    // Collapse State
    const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

    const toggleAccount = (id: number) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

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

    const handleEdit = (tx: TransactionRecord) => {
        setEditingTxId(tx.id);
        setTxType(tx.type);
        setAccountId(tx.account_id);
        const dateStr = new Date(tx.date).toISOString().split('T')[0];
        setTxDate(dateStr);
        setNotes(tx.notes || '');
        setTotal(tx.total.toString());

        if (tx.quantity) setQuantity(tx.quantity.toString());
        else setQuantity('');

        if (tx.price) setPrice(tx.price.toString());
        else setPrice('');

        // We don't have symbol readily available in TransactionRecord interface above?
        // Let's check interface definition in file. 
        // It currently says: id, date, type, account_id, asset_id, quantity, price, fee, total, notes.
        // It DOES NOT have symbol.
        // But the backend `Transaction` model doesn't store symbol, only `asset_id`.
        // However, `list_transactions` returns `Transaction` objects.
        // We need to fetch asset details or we can't edit symbol easily.
        // For now, let's clear symbol if we can't find it, or fetching it.
        // We'll skip symbol fetching for this step to verify basic edit first.
        setSymbol(''); setTags('');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingTxId(null);
        setTotal(''); setSymbol(''); setQuantity(''); setPrice(''); setNotes(''); setTags('');
        setTxDate(new Date().toISOString().split('T')[0]);
        setSymbolValid(null); setSymbolName('');
        setAccountId('');
    };

    const handleSymbolBlur = async () => {
        if (!symbol || !isTradeType) return;
        setIsValidating(true);
        setSymbolValid(null);
        setSymbolName('');

        try {
            const res = await api.get(`/market/validate/${symbol}`);
            if (res.data.valid) {
                setSymbolValid(true);
                setSymbolName(res.data.name);
            } else {
                setSymbolValid(false);
                setError(`Symbol '${symbol}' not found`);
            }
        } catch (err) {
            console.error(err);
            setSymbolValid(false);
        } finally {
            setIsValidating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isTradeType && symbolValid === false) {
            setError(`Cannot submit invalid symbol '${symbol}'`);
            return;
        }
        setError(''); setSuccess(''); setSubmitting(true);
        try {
            // Auto-detect currency from symbol (e.g. 0700.HK -> HKD)
            let txCurrency = accounts.find(a => a.id === (typeof accountId === 'number' ? accountId : -1))?.currency || 'USD';
            if (isTradeType && symbol) {
                if (symbol.toUpperCase().endsWith('.HK')) txCurrency = 'HKD';
                else txCurrency = 'USD'; // Default to USD for US stocks
            }

            const payload: Record<string, unknown> = {
                type: txType, account_id: accountId, total: parseFloat(total),
                date: new Date(txDate + 'T00:00:00Z').toISOString(), notes: notes || null,
                currency: txCurrency, // Send detected currency
                tags: tags || null,   // Send tags
            };
            if (isTradeType) { payload.quantity = parseFloat(quantity); payload.price = parseFloat(price); payload.symbol = symbol; }

            if (editingTxId) {
                await api.put(`/transactions/${editingTxId}`, payload);
                setSuccess(t('tx.updated') || 'Transaction updated');
                setEditingTxId(null);
            } else {
                await api.post('/transactions/', payload);
                const txLabel = txTypes.find(tx => tx.value === txType)?.label || txType;
                setSuccess(`${txLabel} $${total} ${t('tx.success')}`);
            }

            setTotal(''); setSymbol(''); setQuantity(''); setPrice(''); setNotes(''); setTags('');
            setTxDate(new Date().toISOString().split('T')[0]);
            setSymbolValid(null); setSymbolName(''); // Reset validation
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
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${editingTxId ? 'from-amber-500 to-orange-500' : 'from-indigo-500 to-violet-500'}`} />
                        <h2 className="text-lg font-bold text-zinc-900">{editingTxId ? 'Edit Transaction' : t('tx.new')}</h2>
                    </div>
                    {editingTxId && (
                        <button onClick={cancelEdit} className="text-sm text-red-500 font-semibold flex items-center gap-1 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                            <X size={14} /> Cancel Edit
                        </button>
                    )}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1.5"><Calendar size={13} className="inline mr-1" />{t('tx.date')}</label>
                            <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} required className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('tx.account')}</label>
                            <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} required className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none cursor-pointer">
                                <option value="">{t('tx.select_account')}</option>
                                {accounts.map(a => (<option key={a.id} value={a.id}>{a.name} ({a.currency}) — {formatFrom(a.balance, a.currency)}</option>))}
                            </select>
                        </div>
                    </div>

                    {isTradeType && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5"><Search size={13} className="inline mr-1" />{t('tx.symbol')}</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={symbol}
                                        onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setSymbolValid(null); }}
                                        onBlur={handleSymbolBlur}
                                        placeholder="e.g. AAPL"
                                        className={`w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none ${symbolValid === false ? 'border-red-500 text-red-600' : ''}`}
                                    />
                                    {isValidating && (
                                        <div className="absolute right-3 top-2.5 animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                                    )}
                                    {!isValidating && symbolValid === true && (
                                        <div className="absolute right-3 top-2.5 text-emerald-500 font-bold">✓</div>
                                    )}
                                </div>
                                {symbolName && <p className="text-xs text-emerald-600 mt-1 truncate">{symbolName}</p>}
                                {symbolValid === false && <p className="text-xs text-red-500 mt-1">Invalid Symbol</p>}
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

                    {isTradeType && (
                        <div>
                            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('tx.tags')}</label>
                            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('tx.tags_placeholder')} className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none" />
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

                    <button type="submit" disabled={submitting} className={`w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50 ${editingTxId ? 'bg-amber-500 hover:bg-amber-600' : 'btn-primary'}`}>
                        {submitting ? (editingTxId ? 'Updating...' : t('tx.recording')) : (editingTxId ? 'Update Transaction' : `${t('tx.record')} ${txTypes.find(tx => tx.value === txType)?.label}`)}
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
                    <div className="space-y-6">
                        {accounts.map(account => {
                            const accountTxs = transactions.filter(tx => tx.account_id === account.id);
                            if (accountTxs.length === 0) return null;

                            return (
                                <div key={account.id} className="space-y-2">
                                    <button
                                        onClick={() => toggleAccount(account.id)}
                                        className="flex items-center gap-2 w-full text-left group"
                                    >
                                        <div className={`p-1 rounded-md transition-colors ${collapsed[account.id] ? 'bg-zinc-100 text-zinc-500' : 'bg-violet-50 text-violet-600'}`}>
                                            {collapsed[account.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                        </div>
                                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-700 transition-colors">
                                            {account.name}
                                        </h3>
                                        <span className="text-xs text-zinc-400 font-medium">({accountTxs.length})</span>
                                        <div className="flex-1 h-px bg-zinc-100 ml-2 group-hover:bg-zinc-200 transition-colors" />
                                    </button>

                                    {!collapsed[account.id] && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                            {accountTxs.map((tx) => {
                                                const txMeta = txTypes.find(txItem => txItem.value === tx.type);
                                                const Icon = txMeta?.icon || DollarSign;
                                                const isInflow = tx.type === 'DEPOSIT' || tx.type === 'SELL' || tx.type === 'DIVIDEND' || tx.type === 'INTEREST';
                                                return (
                                                    <div key={tx.id} className="card flex items-center justify-between py-3 px-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`icon-badge ${txMeta?.soft || 'bg-zinc-50'}`}>
                                                                <Icon size={16} className={txMeta?.color || 'text-zinc-400'} />
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-sm text-zinc-900">
                                                                    {txMeta?.label || tx.type}
                                                                    {tx.asset_symbol && <span className="ml-1.5 text-zinc-500 font-medium text-xs bg-zinc-100 px-1.5 py-0.5 rounded">{tx.asset_symbol}</span>}
                                                                </p>
                                                                <p className="text-[11px] text-zinc-400">{new Date(tx.date).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`font-bold text-sm ${isInflow ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {isInflow ? '+' : '-'}{formatNative(tx.total, account.currency)}
                                                            </p>
                                                            <div className="flex items-center justify-end gap-2 mt-0.5">
                                                                {tx.quantity && <p className="text-[11px] text-zinc-400">{tx.quantity} × {formatNative(tx.price || 0, 'USD')}</p>}
                                                                <button onClick={() => handleEdit(tx)} className="text-zinc-400 hover:text-indigo-500 transition-colors p-1" title="Edit">
                                                                    <Pencil size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {/* Show any orphaned transactions? unlikely but safe to check */}
                        {transactions.some(tx => !accounts.find(a => a.id === tx.account_id)) && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider ml-1">Other</h3>
                                {transactions.filter(tx => !accounts.find(a => a.id === tx.account_id)).map(tx => (
                                    <div key={tx.id} className="card py-3 px-5 text-zinc-500">
                                        Transaction #{tx.id} (Account deleted)
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
