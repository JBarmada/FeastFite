import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { economyApi, type ShopItemDto } from '../api/economyApi';

const ITEM_META: Record<string, { emoji: string; color: string; description: string }> = {
  territory_shield: {
    emoji: '🛡️',
    color: 'var(--color-item-shield)',
    description: 'Blocks a sneaky takeover while your dish is on the line.',
  },
  battering_ram: {
    emoji: '🐏',
    color: 'var(--color-item-ram)',
    description: 'Breaks a territory lock so you can fight for the crown.',
  },
  double_points: {
    emoji: '⚡',
    color: 'var(--color-item-boost)',
    description: 'Sweet multiplier — stack those candy points faster.',
  },
};

const SHOP_CARD_STYLE: CSSProperties = {
  background: 'var(--color-surface)',
  border: '2px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)',
  padding: '20px 24px',
  textAlign: 'center',
  minWidth: '160px',
  maxWidth: '220px',
};

const btnPrimary: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '999px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: '0.85rem',
  background: 'linear-gradient(90deg, #A020C8 0%, #FF4FA3 100%)',
  color: '#fff',
};

const btnMuted: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '999px',
  border: '2px solid var(--color-border)',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.85rem',
  background: 'var(--color-surface)',
  color: 'var(--color-text-secondary)',
};

const btnDisabled: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '999px',
  border: 'none',
  cursor: 'not-allowed',
  fontWeight: 800,
  fontSize: '0.85rem',
  background: 'rgba(0,0,0,0.08)',
  color: '#888',
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
    for (const row of inv.items) {
      map[row.itemId] = row.quantity;
    }
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
      } catch (e) {
        if (!cancelled) setError('Could not load the shop. Is the economy service running?');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      const msg =
        ax.response?.status === 402
          ? 'Not enough points — play more to earn candy!'
          : ax.response?.data?.error ?? 'Purchase failed';
      setError(msg);
    } finally {
      setBuyingId(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Navbar />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: 'calc(100vh - 56px)',
          gap: '16px',
          padding: '40px 20px 48px',
        }}
      >
        <span style={{ fontSize: '4rem' }}>🛒</span>
        <h1
          style={{
            margin: 0,
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
          }}
        >
          SHOP
        </h1>
        {isAuthenticated && balance !== null && (
          <div
            style={{
              color: 'var(--color-points)',
              fontWeight: 800,
              fontSize: '1.1rem',
            }}
          >
            BALANCE: {balance.toLocaleString()} pts
          </div>
        )}
        {!isAuthenticated && (
          <p style={{ color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>
            <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
              Log in
            </Link>{' '}
            to see your balance and buy treats.
          </p>
        )}
        {error && (
          <div
            role="alert"
            style={{
              background: 'rgba(255,80,120,0.12)',
              border: '1px solid rgba(255,80,120,0.4)',
              color: '#a02050',
              padding: '10px 16px',
              borderRadius: '12px',
              maxWidth: '400px',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}
        {loading ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Loading shop…</p>
        ) : (
          <>
            <h2
              style={{
                margin: '16px 0 4px',
                fontFamily: 'var(--font-display)',
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--color-text-primary)',
              }}
            >
              MY ITEMS
            </h2>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginTop: '8px',
              }}
            >
              {items.map((item) => {
                const meta = ITEM_META[item.id] ?? {
                  emoji: '🍬',
                  color: 'var(--color-primary)',
                  description: 'A tasty power-up for your food monster.',
                };
                const owned = inventory[item.id] ?? 0;
                const canAfford =
                  isAuthenticated && token && balance !== null && balance >= item.pricePoints;
                const isConfirming = pendingBuyId === item.id;
                const isBuying = buyingId === item.id;

                return (
                  <div key={item.id} style={SHOP_CARD_STYLE}>
                    <div style={{ fontSize: '2.2rem' }}>{meta.emoji}</div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        fontSize: '0.95rem',
                        marginTop: '6px',
                      }}
                    >
                      {item.name}
                    </div>
                    <div
                      style={{
                        color: owned === 0 ? '#ff3355' : '#A020C8',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        marginTop: '4px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      x{owned}
                    </div>

                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {!isAuthenticated || !token ? (
                        <Link
                          to="/login"
                          style={{
                            ...btnPrimary,
                            textDecoration: 'none',
                            display: 'block',
                            textAlign: 'center',
                            lineHeight: 1.2,
                          }}
                        >
                          Log in to buy
                        </Link>
                      ) : !isConfirming ? (
                        <button
                          type="button"
                          disabled={!canAfford || isBuying}
                          onClick={() => {
                            if (canAfford) setPendingBuyId(item.id);
                          }}
                          style={!canAfford ? btnDisabled : btnPrimary}
                        >
                          {!canAfford ? 'Need more pts' : 'Buy'}
                        </button>
                      ) : (
                        <>
                          <p
                            style={{
                              margin: '0 0 4px',
                              fontSize: '0.8rem',
                              lineHeight: 1.45,
                              color: 'var(--color-text-secondary)',
                              textAlign: 'center',
                            }}
                          >
                            {meta.description}
                          </p>
                          <button
                            type="button"
                            disabled={isBuying}
                            onClick={() => void confirmPurchase(item.id)}
                            style={{
                              ...btnPrimary,
                              opacity: isBuying ? 0.7 : 1,
                              cursor: isBuying ? 'wait' : 'pointer',
                            }}
                          >
                            {isBuying
                              ? 'Buying…'
                              : `Buy for ${item.pricePoints.toLocaleString()} points`}
                          </button>
                          <button
                            type="button"
                            disabled={isBuying}
                            onClick={() => setPendingBuyId(null)}
                            style={{
                              ...btnMuted,
                              opacity: isBuying ? 0.6 : 1,
                              cursor: isBuying ? 'not-allowed' : 'pointer',
                            }}
                          >
                            No thanks
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
