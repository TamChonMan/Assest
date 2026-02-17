'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Plus, Building2, TrendingUp, Bitcoin, Wallet } from 'lucide-react';

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
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Your Accounts</h1>

            {/* Account List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((acc) => (
                    <div key={acc.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-slate-50 rounded-lg">
                                {getIcon(acc.type)}
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">{acc.name}</h3>
                                <p className="text-slate-500 text-sm">{acc.type} • {acc.currency}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-xl">${acc.balance.toLocaleString()}</p>
                        </div>
                    </div>
                ))}

                {/* Add New Card */}
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer" onClick={() => (document.getElementById('add-modal') as HTMLDialogElement)?.showModal()}>
                    <div className="text-center">
                        <Plus size={32} className="mx-auto mb-2" />
                        <span className="font-medium">Add New Account</span>
                    </div>
                </div>
            </div>

            {/* Modal would go here, but for simplicity I'll put a simple inline form or use a native dialog for now */}
            <dialog id="add-modal" className="modal p-8 rounded-xl shadow-2xl backdrop:bg-black/50">
                <h2 className="text-xl font-bold mb-4">Add Account</h2>
                <form onSubmit={createAccount} className="space-y-4 w-96">
                    <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input type="text" className="w-full p-2 border rounded" value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Type</label>
                        <select className="w-full p-2 border rounded" value={newAccount.type} onChange={e => setNewAccount({ ...newAccount, type: e.target.value as any })}>
                            <option value="BANK">Bank</option>
                            <option value="STOCK">Stock Broker</option>
                            <option value="CRYPTO">Crypto Wallet</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Currency</label>
                        <select className="w-full p-2 border rounded" value={newAccount.currency} onChange={e => setNewAccount({ ...newAccount, currency: e.target.value })}>
                            <option value="HKD">HKD</option>
                            <option value="USD">USD</option>
                            <option value="MOP">MOP</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Initial Balance</label>
                        <input type="number" className="w-full p-2 border rounded" value={newAccount.balance} onChange={e => setNewAccount({ ...newAccount, balance: parseFloat(e.target.value) })} />
                    </div>
                    <div className="flex justify-end space-x-2 mt-6">
                        <button type="button" className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded" onClick={() => (document.getElementById('add-modal') as HTMLDialogElement)?.close()}>Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
                    </div>
                </form>
            </dialog>
        </div>
    );
}
