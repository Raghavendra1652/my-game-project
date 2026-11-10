import React, { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { ShopItem } from '../types/admin';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ShoppingBag, Coins, Gem, Edit2, Check, RefreshCw, Eye, EyeOff, Save, Sparkles } from 'lucide-react';

export const ShopManagementView: React.FC = () => {
  const { permissions } = useAdminAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ coinPrice: number; diamondPrice: number; name: string }>({
    coinPrice: 0,
    diamondPrice: 0,
    name: '',
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchShop = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getShopItems();
      setItems(res.items);
    } catch (e: any) {
      console.warn('Shop load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShop();
  }, []);

  const handleStartEdit = (item: ShopItem) => {
    setEditingId(item.id);
    setEditForm({
      coinPrice: item.coinPrice,
      diamondPrice: item.diamondPrice || 0,
      name: item.name,
    });
  };

  const handleSaveEdit = async (id: string) => {
    setSavingId(id);
    try {
      await adminApi.updateShopItem(id, editForm);
      setEditingId(null);
      setFeedback('Shop item updated successfully.');
      setTimeout(() => setFeedback(null), 3000);
      fetchShop();
    } catch (e: any) {
      alert(`Update failed: ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (item: ShopItem) => {
    setSavingId(item.id);
    try {
      await adminApi.updateShopItem(item.id, { active: !item.active });
      fetchShop();
    } catch (e: any) {
      alert(`Toggle failed: ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#132038] border border-[#263857] p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#eef4fc] tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#fbbf24]" />
            <span>Shop Catalog & Cosmetic Pricing</span>
          </h2>
          <p className="text-xs text-[#889bb6] mt-0.5 font-mono">
            Manage cosmetic availability, Coin and Diamond prices while protecting existing player purchase history
          </p>
        </div>

        <button
          type="button"
          onClick={fetchShop}
          className="p-2 bg-[#0b1424] hover:bg-[#192a4a] border border-[#263857] text-[#889bb6] hover:text-[#eef4fc] rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#4f8fff]' : ''}`} />
        </button>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
          ✓ {feedback}
        </div>
      )}

      {/* Catalog Table */}
      <div className="bg-[#132038] border border-[#263857] rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-[#0b1424]/90 border-b border-[#263857] text-[11px] text-[#889bb6] uppercase tracking-wider">
                <th className="py-3.5 px-4 font-bold">Item Symbol</th>
                <th className="py-3.5 px-4 font-bold">Name & Category</th>
                <th className="py-3.5 px-4 font-bold">Type</th>
                <th className="py-3.5 px-4 font-bold">Coin Price (🪙)</th>
                <th className="py-3.5 px-4 font-bold">Diamond Price (💎)</th>
                <th className="py-3.5 px-4 font-bold">Availability</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263857]/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#889bb6]">Loading catalog…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#889bb6]">No items in catalog.</td>
                </tr>
              ) : (
                items.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-[#192a4a]/50 transition-colors">
                      {/* Symbol */}
                      <td className="py-3 px-4 text-2xl whitespace-nowrap">{item.symbol}</td>

                      {/* Name */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="bg-[#0b1424] border border-[#4f8fff] rounded px-2 py-1 text-xs text-white"
                          />
                        ) : (
                          <div>
                            <div className="font-bold text-[#eef4fc] font-sans">{item.name}</div>
                            <div className="text-[10px] text-[#889bb6]">{item.category}</div>
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4 whitespace-nowrap uppercase text-[10px] text-[#889bb6]">
                        {item.type}
                      </td>

                      {/* Coin Price */}
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-[#fbbf24]">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editForm.coinPrice}
                            onChange={(e) => setEditForm({ ...editForm, coinPrice: parseInt(e.target.value || '0', 10) })}
                            className="bg-[#0b1424] border border-[#fbbf24] rounded px-2 py-1 text-xs text-white w-20"
                          />
                        ) : (
                          <span>🪙 {item.coinPrice.toLocaleString()}</span>
                        )}
                      </td>

                      {/* Diamond Price */}
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-[#38bdf8]">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editForm.diamondPrice}
                            onChange={(e) => setEditForm({ ...editForm, diamondPrice: parseInt(e.target.value || '0', 10) })}
                            className="bg-[#0b1424] border border-[#38bdf8] rounded px-2 py-1 text-xs text-white w-20"
                          />
                        ) : (
                          <span>💎 {(item.diamondPrice || 0).toLocaleString()}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.active
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-red-500/20 text-red-300 border-red-500/40'
                          }`}
                        >
                          {item.active ? 'Available' : 'Archived'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        {permissions?.canManageShop && (
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={savingId === item.id}
                                className="px-2.5 py-1 rounded bg-[#10b981] hover:bg-[#059669] text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Save</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(item)}
                                className="p-1.5 rounded border border-[#263857] hover:bg-[#16243d] text-[#889bb6] hover:text-[#eef4fc] cursor-pointer"
                                title="Edit prices and title"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleToggleActive(item)}
                              disabled={savingId === item.id}
                              className={`p-1.5 rounded border cursor-pointer ${
                                item.active
                                  ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                  : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={item.active ? 'Deactivate from shop' : 'Activate in shop'}
                            >
                              {item.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
