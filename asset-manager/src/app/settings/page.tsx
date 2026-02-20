'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Globe, Coins, Tag as TagIcon, Plus, X, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/context/I18nContext';
import { useCurrency, Currency } from '@/context/CurrencyContext';

export default function SettingsPage() {
    const { locale, setLocale, t } = useI18n();
    const { currency, setCurrency, currencies } = useCurrency();

    return (
        <div className="space-y-8 max-w-2xl">
            {/* Header */}
            <header>
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-indigo-500" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Preferences</span>
                </div>
                <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('settings.title')}</h1>
                <p className="text-zinc-500 mt-1 text-sm">{t('settings.subtitle')}</p>
            </header>

            {/* Language Card */}
            <div className="card">
                <div className="flex items-center gap-3 mb-4">
                    <div className="icon-badge bg-indigo-50">
                        <Globe size={18} className="text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-zinc-900">{t('settings.language')}</h2>
                        <p className="text-xs text-zinc-500">{t('settings.language_desc')}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setLocale('en')}
                        className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-smooth border
                            ${locale === 'en'
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm'
                                : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300 hover:text-zinc-500'
                            }`}
                    >
                        🇬🇧 English
                    </button>
                    <button
                        onClick={() => setLocale('zh')}
                        className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-smooth border
                            ${locale === 'zh'
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm'
                                : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300 hover:text-zinc-500'
                            }`}
                    >
                        🇨🇳 中文
                    </button>
                </div>
            </div>

            {/* Currency Card */}
            <div className="card">
                <div className="flex items-center gap-3 mb-4">
                    <div className="icon-badge bg-violet-50">
                        <Coins size={18} className="text-violet-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-zinc-900">{t('settings.currency')}</h2>
                        <p className="text-xs text-zinc-500">{t('settings.currency_desc')}</p>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {currencies.map((c) => (
                        <button
                            key={c}
                            onClick={() => setCurrency(c as Currency)}
                            className={`px-3 py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-smooth border
                                ${currency === c
                                    ? 'bg-violet-50 text-violet-600 border-violet-200 shadow-sm'
                                    : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300 hover:text-zinc-500'
                                }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tag Management Card */}
            <TagManagementCard />
        </div>
    );
}

function TagManagementCard() {
    const { t } = useI18n();
    const [tags, setTags] = useState<{ id: number; name: string; color: string }[]>([]);
    const [newTag, setNewTag] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    useEffect(() => {
        fetchTags();
    }, []);

    const fetchTags = async () => {
        try {
            const res = await api.get('/tags/');
            setTags(res.data);
        } catch (error) {
            console.error('Failed to fetch tags', error);
        }
    };

    const handleAddTag = async () => {
        if (!newTag.trim()) return;
        setLoading(true);
        try {
            await api.post('/tags/', { name: newTag.trim(), color: '#6366f1' }); // Default indigo
            setNewTag('');
            fetchTags();
        } catch (error) {
            console.error('Failed to add tag', error);
            alert('Failed to add tag. Name might be duplicate.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTag = async (id: number) => {
        // Confirmation handled in UI now
        try {
            await api.delete(`/tags/${id}`);
            fetchTags();
        } catch (error) {
            console.error('Failed to delete tag', error);
            alert('Failed to delete tag. It might still be in use.');
        }
    };

    return (
        <div className="card">
            <div className="flex items-center gap-3 mb-4">
                <div className="icon-badge bg-rose-50">
                    <TagIcon size={18} className="text-rose-500" />
                </div>
                <div>
                    <h2 className="font-bold text-zinc-900">Tag Management</h2>
                    <p className="text-xs text-zinc-500">Manage custom tags for your assets</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* List of Tags */}
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <div key={tag.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium border border-slate-200 group">
                            <span>{tag.name}</span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (confirmDeleteId === tag.id) {
                                        handleDeleteTag(tag.id);
                                        setConfirmDeleteId(null);
                                    } else {
                                        setConfirmDeleteId(tag.id);
                                        // Auto-reset after 3 seconds
                                        setTimeout(() => setConfirmDeleteId(null), 3000);
                                    }
                                }}
                                className={`h-6 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm
                                    ${confirmDeleteId === tag.id
                                        ? "w-auto px-2 bg-red-500 text-white hover:bg-red-600"
                                        : "w-6 bg-slate-200 text-slate-500 hover:bg-rose-100 hover:text-rose-500 hover:scale-110"
                                    }`}
                            >
                                {confirmDeleteId === tag.id ? (
                                    <span className="text-xs font-bold whitespace-nowrap">Confirm?</span>
                                ) : (
                                    <X size={14} strokeWidth={3} />
                                )}
                            </button>
                        </div>
                    ))}
                    {tags.length === 0 && (
                        <p className="text-sm text-zinc-400 italic">No tags defined yet.</p>
                    )}
                </div>

                {/* Add Tag Form */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="New tag name..."
                        className="input-field flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <button
                        onClick={handleAddTag}
                        disabled={loading || !newTag.trim()}
                        className="btn-primary flex items-center gap-2 px-4"
                    >
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                        Add
                    </button>
                </div>
            </div>
        </div>
    );
}
