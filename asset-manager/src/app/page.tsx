'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { ArrowUpRight, DollarSign, Wallet, TrendingUp } from 'lucide-react';

interface Account {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/accounts/')
      .then(res => setAccounts(res.data))
      .catch(err => console.error('Failed to load accounts', err))
      .finally(() => setLoading(false));
  }, []);

  const totalBalance = accounts.reduce((acc, curr) => acc + (curr.balance || 0), 0);
  const bankAccounts = accounts.filter(a => a.type === 'BANK');
  const investAccounts = accounts.filter(a => a.type === 'STOCK' || a.type === 'CRYPTO');

  const stats = [
    {
      title: 'Net Worth',
      value: `$${totalBalance.toLocaleString()}`,
      icon: DollarSign,
      change: '+2.5%',
      changeColor: 'text-emerald-600',
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Bank Accounts',
      value: bankAccounts.length.toString(),
      icon: Wallet,
      change: `${bankAccounts.length} active`,
      changeColor: 'text-slate-500',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      title: 'Investments',
      value: investAccounts.length.toString(),
      icon: TrendingUp,
      change: `${investAccounts.length} active`,
      changeColor: 'text-slate-500',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back. Here&apos;s your financial overview.</p>
        </div>
        <Link
          href="/accounts"
          className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-smooth"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        >
          Manage Accounts
        </Link>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="card cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-lg ${stat.iconBg}`}>
                  <Icon size={20} className={stat.iconColor} />
                </div>
                <h3 className="font-medium text-slate-500 text-sm">{stat.title}</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
              <div className={`flex items-center mt-2 text-sm ${stat.changeColor}`}>
                <ArrowUpRight size={14} className="mr-1" />
                <span>{stat.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Market Overview */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Market Overview</h2>
        <MarketTicker symbols={['AAPL', 'TSLA', 'MSFT', 'BTC-USD', 'ETH-USD', '0700.HK']} />
      </div>

      {/* Accounts Preview */}
      {accounts.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Your Accounts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {accounts.slice(0, 8).map((acc) => (
              <div key={acc.id} className="card cursor-pointer">
                <p className="font-medium text-slate-900">{acc.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{acc.type} • {acc.currency}</p>
                <p className="text-lg font-bold mt-3 text-slate-800">
                  ${acc.balance.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && accounts.length === 0 && (
        <div className="card text-center py-12">
          <Wallet size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">No accounts yet</h3>
          <p className="text-slate-500 mt-1">Start by adding your first account.</p>
          <Link
            href="/accounts"
            className="inline-block mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium cursor-pointer transition-smooth"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Add Account
          </Link>
        </div>
      )}
    </div>
  );
}

function MarketTicker({ symbols }: { symbols: string[] }) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    symbols.forEach(symbol => {
      api.get(`/market/price/${symbol}`).then(res => {
        setPrices(prev => ({ ...prev, [symbol]: res.data.price }));
      });
    });
  }, [symbols]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {symbols.map(symbol => (
        <div key={symbol} className="card p-4 text-center">
          <p className="text-xs font-bold text-slate-500 mb-1">{symbol}</p>
          <p className={`text-lg font-bold ${prices[symbol] ? 'text-slate-900' : 'text-slate-300 animate-pulse'}`}>
            {prices[symbol] ? `$${prices[symbol].toLocaleString()}` : '---'}
          </p>
        </div>
      ))}
    </div>
  );
}
