import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Territory } from '@feastfite/shared';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { economyApi, type ShopItemDto } from '../api/economyApi';
import { territoryApi } from '../api/territoryApi';

const ITEM_META: Record<string, { emoji: string; color: string; bg: string; description: string }> = {
  territory_shield: {
    emoji: '🛡️',
    color: '#00C8E0',
    bg: 'linear-gradient(135deg, #CCF3F9, #80E0F0)',
    description: 'Protects your territory from vote takeovers for 24 hours.',
  },
  battering_ram: {
    emoji: '🐏',
    color: '#FF7A00',
    bg: 'linear-gradient(135deg, #FFE0C0, #FFBC80)',
    description: 'Breaks a territory lock so you can challenge for the crown.',
  },
  double_points: {
    emoji: '⚡',
    color: '#3DC45A',
    bg: 'linear-gradient(135deg, #D4F5DC, #90DCA8)',
    description: 'Doubles all points you earn for 1 hour.',
  },
};

function notifyBalanceChanged() {
  window.dispatchEvent(new Event('feastfite:balance'));
}

function useCountdown(expiresAt: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) { setLabel(null); return; }
    function tick() {
      const ms = new Date(expiresAt!).getTime() - Date.now();
      if (ms <= 0) { setLabel(null); return; }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLabel(`${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return label;
}

type UsePanel =
  | { type: 'double_points' }
  | { type: 'territory_shield' }
  | { type: 'battering_ram' };

export function ShopPage() {
  const { isAuthenticated, token } = useAuth();
  const [items, setItems] = useState<ShopItemDto[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [boostExpiry, setBoostExpiry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [pendingBuyId, setPendingBuyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usePanel, setUsePanel] = useState<UsePanel | null>(null);
  const [ownedTerritories, setOwnedTerritories] = useState<Territory[]>([]);
  const [lockedTerritories, setLockedTerritories] = useState<Territory[]>([]);
  const [territoriesLoading, setTerritoriesLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const boostCountdown = useCountdown(boostExpiry);

  const loadShop = useCallback(async () => {
    const { items: list } = await economyApi.getShop();
    setItems(list);
  }, []);

  const loadAuthSlice = useCallback(async () => {
    if (!token) return;
    const [bal, inv, boosts] = await Promise.all([
      economyApi.getBalance(token),
      economyApi.getInventory(token),
      economyApi.getActiveBoosts(token),
    ]);
    setBalance(bal);
    const map: Record<string, number> = {};
    for (const row of inv.items) map[row.itemId] = row.quantity;
    setInventory(map);
    const dp = boosts.boosts.find((b) => b.itemType === 'double_points');
    setBoostExpiry(dp?.expiresAt ?? null);
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

  function showSuccess(msg: string) {
    setActionSuccess(msg);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setActionSuccess(null), 3000);
  }

  async function openUsePanel(panel: UsePanel) {
    setActionError(null);
    setActionSuccess(null);
    setUsePanel(panel);
    if (panel.type === 'territory_shield' && token) {
      setTerritoriesLoading(true);
      try {
        const owned = await territoryApi.getOwned(token);
        setOwnedTerritories(owned);
      } catch {
        setActionError('Could not load your territories.');
      } finally {
        setTerritoriesLoading(false);
      }
    }
    if (panel.type === 'battering_ram') {
      setTerritoriesLoading(true);
      try {
        const all = await territoryApi.getAll();
        setLockedTerritories(all.filter((t) => t.lockedUntil && new Date(t.lockedUntil) > new Date()));
      } catch {
        setActionError('Could not load territories.');
      } finally {
        setTerritoriesLoading(false);
      }
    }
  }

  async function activateDoublePoints() {
    if (!token) return;
    setActingId('double_points');
    setActionError(null);
    try {
      const { expiresAt } = await economyApi.activateBoost(token, 'double_points');
      setBoostExpiry(expiresAt);
      await loadAuthSlice();
      setUsePanel(null);
      showSuccess('⚡ Double Points active for 1 hour!');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setActionError(ax.response?.data?.error ?? 'Could not activate boost');
    } finally {
      setActingId(null);
    }
  }

  async function applyShield(territoryId: string) {
    if (!token) return;
    setActingId(territoryId);
    setActionError(null);
    try {
      await territoryApi.shield(territoryId, token);
      await loadAuthSlice();
      setUsePanel(null);
      showSuccess('🛡️ Shield applied! Your territory is protected for 24 hours.');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setActionError(ax.response?.data?.error ?? 'Could not apply shield');
    } finally {
      setActingId(null);
    }
  }

  async function useRam(territoryId: string) {
    if (!token) return;
    setActingId(territoryId);
    setActionError(null);
    try {
      await territoryApi.batteringRam(territoryId, token);
      setLockedTerritories((prev) => prev.filter((t) => t.id !== territoryId));
      await loadAuthSlice();
      setUsePanel(null);
      showSuccess('🐏 Lock smashed! The territory is open for challenge.');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setActionError(ax.response?.data?.error ?? 'Could not use battering ram');
    } finally {
      setActingId(null);
    }
  }

  function renderUseButton(item: ShopItemDto) {
    const owned = inventory[item.id] ?? 0;
    if (owned === 0) {
      return (
        <button type="button" disabled style={emptyBtn}>Empty</button>
      );
    }

    if (item.id === 'double_points') {
      if (boostCountdown) {
        return (
          <div style={{ padding: '6px 12px', borderRadius: '999px', background: 'rgba(61,196,90,0.2)', color: '#1A8A30', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center' }}>
            ⚡ {boostCountdown}
          </div>
        );
      }
      return (
        <button
          type="button"
          onClick={() => openUsePanel({ type: 'double_points' })}
          style={useBtn('#3DC45A')}
        >
          ACTIVATE
        </button>
      );
    }

    if (item.id === 'territory_shield') {
      return (
        <button
          type="button"
          onClick={() => openUsePanel({ type: 'territory_shield' })}
          style={useBtn('#00C8E0')}
        >
          APPLY
        </button>
      );
    }

    if (item.id === 'battering_ram') {
      return (
        <button
          type="button"
          onClick={() => openUsePanel({ type: 'battering_ram' })}
          style={useBtn('#FF7A00')}
        >
          USE
        </button>
      );
    }

    return null;
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '40px' }}>
        <div className="page-card">

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '3.5rem' }}>🤖🛒</div>
            <h1 style={{ margin: '8px 0 4px', color: '#A020C8', fontFamily: 'var(--font-display)', fontSize: '2rem' }}>
              SHOP
            </h1>
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.6)', border: '2px solid rgba(160,32,200,0.2)', borderRadius: '999px', padding: '6px 20px', fontWeight: 800, fontSize: '1rem', color: '#2D1040' }}>
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

          {error && <AlertBox color="#a02050" bg="rgba(255,80,120,0.15)" border="rgba(255,80,120,0.4)">{error}</AlertBox>}
          {actionSuccess && <AlertBox color="#1A8A30" bg="rgba(61,196,90,0.15)" border="rgba(61,196,90,0.4)">{actionSuccess}</AlertBox>}

          {/* Use panel modal */}
          {usePanel && (
            <div style={{ background: 'rgba(255,255,255,0.75)', border: '1.5px solid rgba(160,32,200,0.2)', borderRadius: '20px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#2D1040' }}>
                  {usePanel.type === 'double_points' && '⚡ Activate Double Points'}
                  {usePanel.type === 'territory_shield' && '🛡️ Choose a territory to shield'}
                  {usePanel.type === 'battering_ram' && '🐏 Choose a locked territory to ram'}
                </span>
                <button type="button" onClick={() => { setUsePanel(null); setActionError(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '1.1rem', fontWeight: 700 }}>✕</button>
              </div>

              {actionError && <AlertBox color="#a02050" bg="rgba(255,80,120,0.1)" border="rgba(255,80,120,0.3)">{actionError}</AlertBox>}

              {usePanel.type === 'double_points' && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#7A5490', fontSize: '0.85rem', margin: '0 0 16px' }}>
                    Doubles all points you earn for the next <strong>1 hour</strong>.
                    Using another one while active resets the timer.
                  </p>
                  <button
                    type="button"
                    disabled={actingId === 'double_points'}
                    onClick={() => void activateDoublePoints()}
                    style={{ ...useBtn('#3DC45A'), width: 'auto', padding: '10px 28px', fontSize: '0.9rem' } as CSSProperties}
                  >
                    {actingId === 'double_points' ? 'Activating…' : '⚡ Activate Now'}
                  </button>
                </div>
              )}

              {usePanel.type === 'territory_shield' && (
                territoriesLoading ? (
                  <p style={{ color: '#7A5490', textAlign: 'center', margin: 0 }}>Loading your territories…</p>
                ) : ownedTerritories.length === 0 ? (
                  <p style={{ color: '#7A5490', textAlign: 'center', margin: 0 }}>You don't own any territories yet. Claim one on the map first!</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ownedTerritories.map((t) => {
                      const alreadyShielded = t.shieldedUntil && new Date(t.shieldedUntil) > new Date();
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.6)', borderRadius: '12px', padding: '10px 14px' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#2D1040' }}>{t.name}</div>
                            {alreadyShielded && (
                              <div style={{ fontSize: '0.72rem', color: '#00C8E0', fontWeight: 700 }}>
                                🛡️ Shielded until {new Date(t.shieldedUntil!).toLocaleTimeString()}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={!!actingId || alreadyShielded}
                            onClick={() => void applyShield(t.id)}
                            style={useBtn('#00C8E0') as CSSProperties}
                          >
                            {actingId === t.id ? '…' : alreadyShielded ? 'Active' : 'SHIELD'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {usePanel.type === 'battering_ram' && (
                territoriesLoading ? (
                  <p style={{ color: '#7A5490', textAlign: 'center', margin: 0 }}>Loading locked territories…</p>
                ) : lockedTerritories.length === 0 ? (
                  <p style={{ color: '#7A5490', textAlign: 'center', margin: 0 }}>No locked territories found right now. Locks appear after someone wins a vote.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lockedTerritories.map((t) => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.6)', borderRadius: '12px', padding: '10px 14px' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#2D1040' }}>{t.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#FF7A00', fontWeight: 700 }}>
                            🔒 Locked until {new Date(t.lockedUntil!).toLocaleString()}
                          </div>
                          {t.ownerName && (
                            <div style={{ fontSize: '0.72rem', color: '#7A5490' }}>Owner: {t.ownerName}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!!actingId}
                          onClick={() => void useRam(t.id)}
                          style={useBtn('#FF7A00') as CSSProperties}
                        >
                          {actingId === t.id ? '…' : 'RAM'}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {loading ? (
            <p style={{ color: '#7A5490', textAlign: 'center', padding: '40px' }}>Loading shop…</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

                {/* MY ITEMS */}
                <div style={{ background: 'rgba(255,255,255,0.45)', borderRadius: '20px', padding: '20px', border: '1.5px solid rgba(255,255,255,0.7)' }}>
                  <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 900, color: '#2D1040', textAlign: 'center', letterSpacing: '0.06em' }}>
                    MY ITEMS
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {items.map((item) => {
                      const meta = ITEM_META[item.id] ?? { emoji: '🍬', color: '#A020C8', bg: 'linear-gradient(135deg,#EDD6F7,#D4A8E8)', description: '' };
                      const owned = inventory[item.id] ?? 0;
                      return (
                        <div key={item.id} style={{ background: meta.bg, borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: `1.5px solid ${meta.color}40` }}>
                          <div style={{ fontSize: '2rem', flexShrink: 0 }}>{meta.emoji}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#2D1040' }}>{item.name}</div>
                            <div style={{ fontWeight: 800, fontSize: '1rem', color: meta.color }}>×{owned}</div>
                          </div>
                          {isAuthenticated && renderUseButton(item)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SHOP INVENTORY */}
                <div style={{ background: 'rgba(255,255,255,0.45)', borderRadius: '20px', padding: '20px', border: '1.5px solid rgba(255,255,255,0.7)' }}>
                  <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 900, color: '#2D1040', textAlign: 'center', letterSpacing: '0.06em' }}>
                    SHOP INVENTORY
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
                    {items.map((item) => {
                      const meta = ITEM_META[item.id] ?? { emoji: '🍬', color: '#A020C8', bg: 'linear-gradient(135deg,#EDD6F7,#D4A8E8)', description: '' };
                      const canAfford: boolean = Boolean(isAuthenticated && token && balance !== null && balance >= item.pricePoints);
                      const isConfirming = pendingBuyId === item.id;
                      const isBuying = buyingId === item.id;
                      return (
                        <div key={item.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          {!isAuthenticated ? (
                            <Link to="/login" style={purchaseBtn(false)}>PURCHASE</Link>
                          ) : isConfirming ? (
                            <button
                              type="button"
                              disabled={isBuying}
                              onClick={() => void confirmPurchase(item.id)}
                              style={purchaseBtn(canAfford) as CSSProperties}
                            >
                              {isBuying ? '...' : 'CONFIRM'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!canAfford || isBuying}
                              onClick={() => { if (canAfford) setPendingBuyId(item.id); }}
                              style={purchaseBtn(canAfford) as CSSProperties}
                            >
                              PURCHASE
                            </button>
                          )}

                          <div style={{ background: meta.bg, borderRadius: '14px', padding: '14px 10px', textAlign: 'center', width: '100%', border: `1.5px solid ${meta.color}40` }}>
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
                              style={{ padding: '4px 12px', borderRadius: '999px', border: '1.5px solid #ccc', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isAuthenticated && balance !== null && (
                    <div style={{ marginTop: '16px', textAlign: 'center', fontWeight: 800, color: '#7A4100', background: 'linear-gradient(135deg, #FFE08A, #FFA800)', borderRadius: '999px', padding: '8px 20px', fontSize: '0.9rem' }}>
                      🪙 Balance: {balance.toLocaleString()} pts
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom inventory bar */}
              <div style={{ background: 'rgba(255,255,255,0.55)', borderRadius: '999px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
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
                      {item.id === 'double_points' && boostCountdown && (
                        <span style={{ fontSize: '0.72rem', color: '#3DC45A', fontWeight: 700 }}>({boostCountdown})</span>
                      )}
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

function AlertBox({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border: string }) {
  return (
    <div role="alert" style={{ background: bg, border: `1.5px solid ${border}`, color, padding: '10px 16px', borderRadius: '12px', fontSize: '0.9rem', marginBottom: '16px', textAlign: 'center' }}>
      {children}
    </div>
  );
}

function useBtn(color: string): CSSProperties {
  return {
    padding: '6px 14px',
    borderRadius: '999px',
    border: 'none',
    fontWeight: 800,
    fontSize: '0.78rem',
    cursor: 'pointer',
    background: color,
    color: '#fff',
    whiteSpace: 'nowrap',
  };
}

const emptyBtn: CSSProperties = {
  padding: '6px 14px',
  borderRadius: '999px',
  border: 'none',
  fontWeight: 700,
  fontSize: '0.78rem',
  cursor: 'default',
  background: 'rgba(0,0,0,0.1)',
  color: '#888',
};

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
