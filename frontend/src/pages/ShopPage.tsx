import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { economyApi, type ShopItemDto } from '../api/economyApi';

const ITEM_META: Record<string, { emoji: string; color: string; bg: string; description: string }> = {
  territory_shield: {
    emoji: '🛡️',
    color: '#00C8E0',
    bg: 'linear-gradient(135deg, #CCF3F9, #80E0F0)',
    description: 'Blocks a sneaky takeover while your dish is on the line.',
  },
  battering_ram: {
    emoji: '🐏',
    color: '#FF7A00',
    bg: 'linear-gradient(135deg, #FFE0C0, #FFBC80)',
    description: 'Breaks a territory lock so you can fight for the crown.',
  },
  double_points: {
    emoji: '⚡',
    color: '#3DC45A',
    bg: 'linear-gradient(135deg, #D4F5DC, #90DCA8)',
    description: 'Sweet multiplier — stack those candy points faster.',
  },
};

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
  const [pendingBuyId, setPendingBuyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function confirmPurchase(itemId: string) {
    if (!token) return;
    setBuyingId(itemId);
    setError(null);
    try {
      const { balance: next } = await economyApi.purchase(token, itemId);
      setBalance(next);
      setPendingBuyId(null);
      await loadAuthSlice();
      notifyBalanceChanged();
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { error?: string } } };
      setError(
        ax.response?.status === 402
          ? 'Not enough points — play more to earn candy!'
          : ax.response?.data?.error ?? 'Purchase failed',
      );
    } finally {
      setBuyingId(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '40px' }}>
        <div className="page-card">

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '3.5rem' }}>🤖🛒</div>
            <h1 style={{
              margin: '8px 0 4px', color: '#A020C8',
              fontFamily: 'var(--font-display)', fontSize: '2rem',
            }}>
              SHOP
            </h1>
            <div style={{
              display: 'inline-block',
              background: 'rgba(255,255,255,0.6)',
              border: '2px solid rgba(160,32,200,0.2)',
              borderRadius: '999px', padding: '6px 20px',
              fontWeight: 800, fontSize: '1rem', color: '#2D1040',
            }}>
              The Sweet Spot: SHOP
            </div>
            <p style={{ color: '#7A5490', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '8px 0 0' }}>
              Welcome to the FeastFite Emporium!
            </p>
          </div>

          {!isAuthenticated && (
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ color: '#7A5490', margin: 0 }}>
                <Link to="/login" style={{ color: '#A020C8', fontWeight: 700 }}>Log in</Link>{' '}
                to see your balance and buy treats.
              </p>
            </div>
          )}

          {error && (
            <div role="alert" style={{
              background: 'rgba(255,80,120,0.15)', border: '1.5px solid rgba(255,80,120,0.4)',
              color: '#a02050', padding: '10px 16px', borderRadius: '12px',
              fontSize: '0.9rem', marginBottom: '16px', textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <p style={{ color: '#7A5490', textAlign: 'center', padding: '40px' }}>Loading shop…</p>
          ) : (
            <>
              {/* Two-column layout */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                marginBottom: '20px',
              }}>
                {/* MY ITEMS */}
                <div style={{
                  background: 'rgba(255,255,255,0.45)',
                  borderRadius: '20px',
                  padding: '20px',
                  border: '1.5px solid rgba(255,255,255,0.7)',
                }}>
                  <h2 style={{
                    margin: '0 0 16px', fontFamily: 'var(--font-display)',
                    fontSize: '1.1rem', fontWeight: 900, color: '#2D1040',
                    textAlign: 'center', letterSpacing: '0.06em',
                  }}>
                    MY ITEMS
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {items.map((item) => {
                      const meta = ITEM_META[item.id] ?? { emoji: '🍬', color: '#A020C8', bg: 'linear-gradient(135deg,#EDD6F7,#D4A8E8)', description: '' };
                      const owned = inventory[item.id] ?? 0;
                      return (
                        <div key={item.id} style={{
                          background: meta.bg,
                          borderRadius: '16px',
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          border: `1.5px solid ${meta.color}40`,
                        }}>
                          <div style={{ fontSize: '2rem', flexShrink: 0 }}>{meta.emoji}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#2D1040' }}>{item.name}</div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: meta.color }}>×{owned}</div>
                          </div>
                          <button
                            type="button"
                            style={{
                              padding: '6px 14px', borderRadius: '999px', border: 'none',
                              fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                              background: owned > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.1)',
                              color: owned > 0 ? '#2D1040' : '#888',
                            }}
                          >
                            {owned > 0 ? 'Explore' : 'Empty'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SHOP INVENTORY */}
                <div style={{
                  background: 'rgba(255,255,255,0.45)',
                  borderRadius: '20px',
                  padding: '20px',
                  border: '1.5px solid rgba(255,255,255,0.7)',
                }}>
                  <h2 style={{
                    margin: '0 0 16px', fontFamily: 'var(--font-display)',
                    fontSize: '1.1rem', fontWeight: 900, color: '#2D1040',
                    textAlign: 'center', letterSpacing: '0.06em',
                  }}>
                    SHOP INVENTORY
                  </h2>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                    gap: '10px',
                  }}>
                    {items.map((item) => {
                      const meta = ITEM_META[item.id] ?? { emoji: '🍬', color: '#A020C8', bg: 'linear-gradient(135deg,#EDD6F7,#D4A8E8)', description: '' };
                      const canAfford: boolean = Boolean(isAuthenticated && token && balance !== null && balance >= item.pricePoints);
                      const isConfirming = pendingBuyId === item.id;
                      const isBuying = buyingId === item.id;
                      return (
                        <div key={item.id} style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        }}>
                          {/* PURCHASE button on top */}
                          {!isAuthenticated ? (
                            <Link to="/login" style={purchaseBtn(false)}>PURCHASE</Link>
                          ) : isConfirming ? (
                            <button
                              type="button"
                              disabled={isBuying}
                              onClick={() => void confirmPurchase(item.id)}
                              style={purchaseBtn(canAfford ?? false) as CSSProperties}
                            >
                              {isBuying ? '...' : 'CONFIRM'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!canAfford || isBuying}
                              onClick={() => { if (canAfford) setPendingBuyId(item.id); }}
                              style={purchaseBtn(canAfford ?? false) as CSSProperties}
                            >
                              PURCHASE
                            </button>
                          )}

                          {/* Item card */}
                          <div style={{
                            background: meta.bg,
                            borderRadius: '14px',
                            padding: '14px 10px',
                            textAlign: 'center',
                            width: '100%',
                            border: `1.5px solid ${meta.color}40`,
                          }}>
                            <div style={{ fontSize: '2rem' }}>{meta.emoji}</div>
                            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#2D1040', marginTop: '4px' }}>{item.name}</div>
                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: meta.color, marginTop: '2px' }}>
                              {item.pricePoints.toLocaleString()} pts
                            </div>
                          </div>

                          {isConfirming && !isBuying && (
                            <button
                              type="button"
                              onClick={() => setPendingBuyId(null)}
                              style={{
                                padding: '4px 12px', borderRadius: '999px', border: '1.5px solid #ccc',
                                background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isAuthenticated && balance !== null && (
                    <div style={{
                      marginTop: '16px', textAlign: 'center',
                      fontWeight: 800, color: '#7A4100',
                      background: 'linear-gradient(135deg, #FFE08A, #FFA800)',
                      borderRadius: '999px', padding: '8px 20px',
                      fontSize: '0.9rem',
                    }}>
                      🪙 Balance: {balance.toLocaleString()} pts
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom inventory bar */}
              <div style={{
                background: 'rgba(255,255,255,0.55)',
                borderRadius: '999px',
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap',
              }}>
                <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#7A5490', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  My Items
                </span>
                {items.map((item) => {
                  const meta = ITEM_META[item.id] ?? { emoji: '🍬', color: '#A020C8', bg: '', description: '' };
                  const owned = inventory[item.id] ?? 0;
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '1.1rem' }}>{meta.emoji}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: owned > 0 ? '#2D1040' : '#aaa' }}>{owned}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function purchaseBtn(canAfford: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '6px 8px',
    borderRadius: '999px',
    border: canAfford ? 'none' : '1.5px solid rgba(180,130,200,0.4)',
    cursor: canAfford ? 'pointer' : 'not-allowed',
    fontWeight: 800,
    fontSize: '0.72rem',
    letterSpacing: '0.04em',
    textAlign: 'center',
    textDecoration: 'none',
    display: 'block',
    background: canAfford
      ? 'linear-gradient(135deg, #FF6FA3, #FF9E8C)'
      : 'rgba(200,180,220,0.3)',
    color: canAfford ? '#fff' : '#9A78A0',
    boxShadow: canAfford ? '0 3px 10px rgba(255,111,145,0.3)' : 'none',
  };
}
