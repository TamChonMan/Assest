'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Plus, Building2, TrendingUp, Bitcoin, Wallet } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';
import { useCurrency } from '@/context/CurrencyContext';

interface Account {
    id: number;
    name: string;
    type: 'BANK' | 'STOCK' | 'CRYPTO';
    currency: string;
    balance: number;
}

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [newAccount, setNewAccount] = useState({ name: '', type: 'BANK', currency: 'HKD', balance: 0 });
    const { t } = useI18n();
    const { format } = useCurrency();

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounts/');
            setAccounts(response.data);
        } catch (error) {
            console.error('Failed to fetch accounts', error);
        } finally {
            setLoading(false);
        }
    };

    const createAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/accounts/', newAccount);
            setNewAccount({ name: '', type: 'BANK', currency: 'HKD', balance: 0 });
            fetchAccounts();
            (document.getElementById('add-modal') as HTMLDialogElement)?.close();
        } catch (error) {
            console.error('Failed to create account', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'BANK': return <Building2 className="text-blue-500" />;
            case 'STOCK': return <TrendingUp className="text-purple-500" />;
            case 'CRYPTO': return <Bitcoin className="text-orange-500" />;
            default: return <Wallet className="text-gray-500" />;
        }
    };

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-bold text-slate-900">{t('accounts.title')}</h1>
                <p className="text-slate-500 mt-1">{t('accounts.subtitle')}</p>
            </header>

            {/* Account List */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="card h-24 animate-pulse" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {accounts.map((acc) => (
                        <div key={acc.id} className="card flex items-center justify-between hover:shadow-md transition-shadow">
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-slate-50 rounded-lg">
                                    {getIcon(acc.type)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-slate-900">{acc.name}</h3>
                                    <p className="text-slate-500 text-sm">{acc.type} • {acc.currency}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-xl text-slate-900">{format(acc.balance)}</p>
                            </div>
                        </div>
                    ))}

                    {/* Add New Card */}
                    <div
                        className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer"
                        onClick={() => (document.getElementById('add-modal') as HTMLDialogElement)?.showModal()}
                    >
                        <div className="text-center">
                            <Plus size={32} className="mx-auto mb-2" />
                            <span className="font-medium">{t('accounts.add')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Account Modal */}
            <dialog id="add-modal" className="modal p-8 rounded-xl shadow-2xl backdrop:bg-black/50">
                <h2 className="text-xl font-bold mb-4 text-slate-900">{t('accounts.add')}</h2>
                <form onSubmit={createAccount} className="space-y-4 w-96">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('accounts.name')}</label>
                        <input type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('accounts.type')}</label>
                        <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" value={newAccount.type} onChange={e => setNewAccount({ ...newAccount, type: e.target.value as 'BANK' | 'STOCK' | 'CRYPTO' })}>
                            <option value="BANK">Bank</option>
                            <option value="STOCK">Stock Broker</option>
                            <option value="CRYPTO">Crypto Wallet</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('accounts.currency')}</label>
                        <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" value={newAccount.currency} onChange={e => setNewAccount({ ...newAccount, currency: e.target.value })}>
                            <option value="HKD">HKD</option>
                            <option value="USD">USD</option>
                            <option value="TWD">TWD</option>
                            <option value="JPY">JPY</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                            <option value="CNY">CNY</option>
                            <option value="MOP">MOP</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('accounts.balance')}</label>
                        <input type="number" className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" value={newAccount.balance} onChange={e => setNewAccount({ ...newAccount, balance: parseFloat(e.target.value) })} />
                    </div>
                    <div className="flex justify-end space-x-2 mt-6">
                        <button type="button" className="px-4 py-2.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer" onClick={() => (document.getElementById('add-modal') as HTMLDialogElement)?.close()}>{t('accounts.cancel')}</button>
                        <button type="submit" className="px-4 py-2.5 text-white rounded-lg font-medium cursor-pointer" style={{ backgroundColor: 'var(--color-primary)' }}>{t('accounts.add')}</button>
                    </div>
                </form>
            </dialog>
        </div>
    );
}
