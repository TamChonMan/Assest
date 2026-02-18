'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Plus, Building2, TrendingUp, Bitcoin, Wallet, X, Calendar, Trash2 } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Account {
    id: number;
    name: string;
    type: 'BANK' | 'STOCK' | 'CRYPTO';
    currency: string;
    balance: number;
    inception_date?: string;
}

const typeConfig = {
    BANK: { icon: Building2, gradient: 'from-blue-500 to-cyan-500', soft: 'bg-blue-50', emoji: '🏦' },
    STOCK: { icon: TrendingUp, gradient: 'from-violet-500 to-purple-500', soft: 'bg-violet-50', emoji: '📈' },
    CRYPTO: { icon: Bitcoin, gradient: 'from-amber-500 to-orange-500', soft: 'bg-amber-50', emoji: '₿' },
};

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newAccount, setNewAccount] = useState({
        name: '',
        type: 'BANK',
        currency: 'HKD',
        balance: 0,
        inception_date: '',
    });
    const { t } = useI18n();
    const { formatNative } = useCurrency(); // Use formatNative instead of format

    useEffect(() => { fetchAccounts(); }, []);

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounts/');
            setAccounts(response.data);
        } catch (error) {
            console.error('Failed to fetch accounts', error);
        } finally { setLoading(false); }
    };

    const createAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = {
                name: newAccount.name,
                type: newAccount.type,
                currency: newAccount.currency,
                balance: newAccount.balance,
            };
            // Only include inception_date if user specified one
            if (newAccount.inception_date) {
                payload.inception_date = newAccount.inception_date + 'T00:00:00';
            }
            await api.post('/accounts/', payload);
            setNewAccount({ name: '', type: 'BANK', currency: 'HKD', balance: 0, inception_date: '' });
            setShowModal(false);
            fetchAccounts();
        } catch (error) { console.error('Failed to create account', error); }
    };

    const deleteAccount = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm(t('accounts.delete_confirm') || 'Are you sure you want to delete this account? This will delete all associated transactions.')) return;
        try {
            await api.delete(`/accounts/${id}`);
            fetchAccounts();
        } catch (error) {
            console.error('Failed to delete account', error);
            alert('Failed to delete account');
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('accounts.title')}</h1>
                    <p className="text-zinc-500 mt-1 text-sm">{t('accounts.subtitle')}</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-primary text-sm flex items-center gap-2">
                    <Plus size={16} />
                    {t('accounts.add')}
                </button>
            </header>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl animate-shimmer" />)}
                </div>
            ) : accounts.length === 0 ? (
                <div className="card text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
                        <Wallet size={28} className="text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-800">{t('dashboard.no_accounts')}</h3>
                    <p className="text-zinc-500 mt-1 text-sm">{t('dashboard.no_accounts_desc')}</p>
                    <button onClick={() => setShowModal(true)} className="btn-primary inline-block mt-5 text-sm">
                        {t('accounts.add')}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {accounts.map((acc) => {
                        const config = typeConfig[acc.type] || typeConfig.BANK;
                        return (
                            <div key={acc.id} className="card group cursor-pointer relative overflow-hidden">
                                {/* Gradient top bar */}
                                <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${config.gradient} opacity-0 group-hover:opacity-100 transition-smooth`} />
                                <button
                                    onClick={(e) => deleteAccount(acc.id, e)}
                                    className="absolute top-3 right-3 p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 z-10"
                                    title="Delete Account"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`icon-badge ${config.soft}`}>
                                        <span className="text-sm">{config.emoji}</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-zinc-900">{acc.name}</h3>
                                        <p className="text-[11px] text-zinc-400 font-medium">{acc.type} • {acc.currency}</p>
                                    </div>
                                </div>
                                <p className="text-2xl font-extrabold text-zinc-900 tracking-tight">
                                    {formatNative(acc.balance, acc.currency)}
                                </p>
                                {acc.inception_date && (
                                    <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                                        <Calendar size={10} />
                                        Since {new Date(acc.inception_date).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        );
                    })}

                    {/* Add Card */}
                    <div
                        onClick={() => setShowModal(true)}
                        className="border-2 border-dashed border-zinc-200 rounded-xl p-6 flex items-center justify-center text-zinc-400 hover:border-indigo-400 hover:text-indigo-500 transition-smooth cursor-pointer group"
                    >
                        <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-zinc-50 group-hover:bg-indigo-50 flex items-center justify-center transition-smooth">
                                <Plus size={24} className="transition-smooth" />
                            </div>
                            <span className="font-semibold text-sm">{t('accounts.add')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md z-10">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-zinc-900">{t('accounts.add')}</h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-smooth cursor-pointer">
                                <X size={18} className="text-zinc-400" />
                            </button>
                        </div>
                        <form onSubmit={createAccount} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('accounts.name')}</label>
                                <input type="text" className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none" value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} placeholder="e.g. HSBC Savings" required />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('accounts.type')}</label>
                                <select className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none cursor-pointer" value={newAccount.type} onChange={e => setNewAccount({ ...newAccount, type: e.target.value as 'BANK' | 'STOCK' | 'CRYPTO' })}>
                                    <option value="BANK">🏦 Bank</option>
                                    <option value="STOCK">📈 Stock Broker</option>
                                    <option value="CRYPTO">₿ Crypto Wallet</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('accounts.currency')}</label>
                                <select className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none cursor-pointer" value={newAccount.currency} onChange={e => setNewAccount({ ...newAccount, currency: e.target.value })}>
                                    <option value="HKD">HKD</option>
                                    <option value="USD">USD</option>
                                    <option value="TWD">TWD</option>
                                    <option value="JPY">JPY</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                    <option value="CNY">CNY</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('accounts.balance')}</label>
                                <input type="number" step="any" className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none" value={newAccount.balance} onChange={e => setNewAccount({ ...newAccount, balance: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={14} className="text-zinc-400" />
                                        Inception Date
                                    </span>
                                </label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2.5 text-zinc-900 bg-white focus:outline-none"
                                    value={newAccount.inception_date}
                                    onChange={e => setNewAccount({ ...newAccount, inception_date: e.target.value })}
                                    placeholder="Leave empty for today"
                                />
                                <p className="text-[11px] text-zinc-400 mt-1">Leave empty to default to today</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg text-zinc-600 font-medium hover:bg-zinc-100 transition-smooth cursor-pointer">
                                    {t('accounts.cancel')}
                                </button>
                                <button type="submit" className="flex-1 btn-primary">
                                    {t('accounts.add')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
