import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { economyApi, type ShopItemDto } from '../api/economyApi';

type FilterTab = 'all' | 'buffs' | 'weapons' | 'cosmetics' | 'coins';

interface ItemMeta {
  emoji: string;
  iconBg: string;
  borderColor: string;
  btnColor: string;
  badge: string;
  badgeColor: string;
  description: string;
  category: FilterTab;
}

const ITEM_META: Record<string, ItemMeta> = {
  double_points: {
    emoji: '⭐',
    iconBg: '#E8F9ED',
    borderColor: '#3DC45A',
    btnColor: '#3DC45A',
    badge: 'Starter',
    badgeColor: '#3DC45A',
    description: 'Next win scores ×2',
    category: 'buffs',
  },
  territory_shield: {
    emoji: '🛡️',
    iconBg: '#E0F8FB',
    borderColor: '#00C8E0',
    btnColor: '#00C8E0',
    badge: 'Popular',
    badgeColor: '#00C8E0',
    description: 'Block one challenge for 12h',
    category: 'weapons',
  },
  battering_ram: {
    emoji: '🔨',
    iconBg: '#FFE8ED',
    borderColor: '#FF4B6E',
    btnColor: '#FF4B6E',
    badge: 'Rare',
    badgeColor: '#FF4B6E',
    description: 'Break a locked block early',
    category: 'weapons',
  },
};

const FALLBACK_META: ItemMeta = {
  emoji: '🍬',
  iconBg: '#F0E8FF',
  borderColor: '#A020C8',
  btnColor: '#A020C8',
  badge: '',
  badgeColor: '#A020C8',
  description: '',
  category: 'all',
};

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'buffs', label: 'Buffs' },
  { key: 'weapons', label: 'Weapons' },
];

function notifyBalanceChanged() {
  window.dispatchEvent(new Event('feastfite:balance'));
}

export function ShopPage() {
  const { isAuthenticated, token } = useAuth();
  const [items, setItems] = useState<ShopItemDto[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const loadShop = useCallback(async () => {
    const { items: list } = await economyApi.getShop();
    setItems(list);
  }, []);

  const loadAuthSlice = useCallback(async () => {
    if (!token) return;
    const [bal, inv] = await Promise.all([
      economyApi.getBalance(token),
      economyApi.getInventory(token),
    ]);
    setBalance(bal);
    const map: Record<string, number> = {};
    for (const row of inv.items) map[row.itemId] = row.quantity;
    setInventory(map);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await loadShop();
        if (token && !cancelled) await loadAuthSlice();
      } catch {
        if (!cancelled) setError('Could not load the shop. Is the economy service running?');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, loadShop, loadAuthSlice]);

  async function handlePurchase(itemId: string) {
    if (!token) return;
    setBuyingId(itemId);
    setError(null);
    try {
      const { balance: next } = await economyApi.purchase(token, itemId);
      setBalance(next);
      await loadAuthSlice();
      notifyBalanceChanged();
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { error?: string } } };
      setError(
        ax.response?.status === 402
          ? 'Not enough coins — play more to earn candy!'
          : (ax.response?.data?.error ?? 'Purchase failed'),
      );
    } finally {
      setBuyingId(null);
    }
  }

  const filteredItems = activeTab === 'all'
    ? items
    : items.filter(item => (ITEM_META[item.id]?.category ?? 'all') === activeTab);

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '28px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: '#2D1040' }}>
              Sweet Shop
            </h1>
            <p style={{ margin: 0, color: '#7A5490', fontSize: '0.9rem', fontWeight: 600 }}>
              Spend your coins on buffs, shields, and grub gear.
            </p>
          </div>
          {isAuthenticated && balance !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              borderRadius: '999px', padding: '8px 16px',
              fontWeight: 900, fontSize: '1rem', color: '#5A3000',
              boxShadow: '0 3px 10px rgba(255,165,0,0.3)',
            }}>
              <span>🪙</span>
              <span>{balance.toLocaleString()}</span>
            </div>
          )}
        </div>

        {error && (
          <div role="alert" style={{
            background: 'rgba(255,80,120,0.15)', border: '1.5px solid rgba(255,80,120,0.4)',
            color: '#a02050', padding: '10px 16px', borderRadius: '12px',
            fontSize: '0.9rem', marginBottom: '16px', textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '7px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '0.9rem',
                cursor: 'pointer', transition: 'all 160ms',
                border: activeTab === tab.key ? '2px solid #9B30D0' : '2px solid rgba(160,32,200,0.25)',
                background: activeTab === tab.key ? 'rgba(155,48,208,0.1)' : 'rgba(255,255,255,0.55)',
                color: activeTab === tab.key ? '#9B30D0' : '#7A5490',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Items grid */}
        {loading ? (
          <p style={{ color: '#7A5490', textAlign: 'center', padding: '60px' }}>Loading shop…</p>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9A78A0', fontWeight: 700 }}>
            No items in this category yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            {filteredItems.map(item => {
              const meta = ITEM_META[item.id] ?? FALLBACK_META;
              const canAfford = !!(isAuthenticated && token && balance !== null && balance >= item.pricePoints);
              const isBuying = buyingId === item.id;
              const owned = inventory[item.id] ?? 0;

              return (
                <div key={item.id} style={{
                  background: '#fff',
                  borderRadius: '18px',
                  padding: '18px',
                  border: `2.5px solid ${meta.borderColor}`,
                  position: 'relative',
                  boxShadow: '0 4px 18px rgba(0,0,0,0.07)',
                }}>
                  {meta.badge && (
                    <div style={{
                      position: 'absolute', top: '-1px', right: '-1px',
                      background: meta.badgeColor, color: '#fff',
                      fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.03em',
                      padding: '3px 11px', borderRadius: '0 16px 0 10px',
                    }}>
                      {meta.badge}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '14px',
                      background: meta.iconBg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '2rem', flexShrink: 0,
                    }}>
                      {meta.emoji}
                    </div>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '1rem', color: '#2D1040', marginBottom: '3px' }}>
                        {item.name}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#9A78A0', lineHeight: 1.35 }}>
                        {meta.description}
                      </div>
                      {owned > 0 && (
                        <div style={{ fontWeight: 700, fontSize: '0.72rem', color: meta.borderColor, marginTop: '3px' }}>
                          ×{owned} owned
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      background: 'linear-gradient(135deg, #FFE566, #FFC107)',
                      borderRadius: '999px', padding: '5px 13px',
                      fontWeight: 800, color: '#5A3000', fontSize: '0.9rem',
                    }}>
                      <span>🪙</span>
                      <span>{item.pricePoints}</span>
                    </div>

                    {!isAuthenticated ? (
                      <Link to="/login" style={{
                        padding: '7px 20px', borderRadius: '999px',
                        background: meta.btnColor, color: '#fff',
                        fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none',
                        display: 'inline-block',
                      }}>
                        Grab It
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford || isBuying}
                        onClick={() => void handlePurchase(item.id)}
                        style={{
                          padding: '7px 20px', borderRadius: '999px', border: 'none',
                          background: canAfford ? meta.btnColor : '#DDD',
                          color: canAfford ? '#fff' : '#999',
                          fontWeight: 800, fontSize: '0.85rem',
                          cursor: canAfford ? 'pointer' : 'not-allowed',
                          transition: 'opacity 160ms',
                        }}
                      >
                        {isBuying ? '…' : 'Grab It'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isAuthenticated && !loading && (
          <p style={{ textAlign: 'center', color: '#7A5490', marginTop: '16px', fontSize: '0.9rem' }}>
            <Link to="/login" style={{ color: '#A020C8', fontWeight: 700 }}>Log in</Link>{' '}
            to see your balance and buy treats.
          </p>
        )}
      </div>
    </div>
  );
}
