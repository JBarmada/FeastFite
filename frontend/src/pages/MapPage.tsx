import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Territory } from '@feastfite/shared';
import axios from 'axios';
import { AUTH_DISABLED } from '../config/devAuth';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { MapView } from '../components/map/MapView';
import { ClaimingMoment } from '../components/map/ClaimingMoment';
import type { ClaimData } from '../components/map/ClaimingMoment';
import { territoryApi } from '../api/territoryApi';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const msg = (error.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
  }
  return fallback;
}

export function MapPage() {
  const { isAuthenticated, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const claimData = (location.state as { claimData?: ClaimData } | null)?.claimData ?? null;

  async function handleClaim(
    territory: Territory,
    intent: 'claim' | 'vote' | 'battering-ram' | 'shield',
  ) {
    if (!AUTH_DISABLED && !isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }

    if (intent === 'battering-ram') {
      if (!AUTH_DISABLED && !token) {
        navigate('/login', { state: { from: { pathname: '/' } } });
        return;
      }
      try {
        const authToken = AUTH_DISABLED ? 'dev-bypass-token' : token;
        if (!authToken) return;
        await territoryApi.batteringRam(territory.id, authToken);
        window.dispatchEvent(new Event('feastfite:balance'));
        // Lock is broken — send the user to upload their challenge dish
        navigate('/voting', { state: { territory } });
      } catch (error) {
        console.error('Failed to use battering ram', error);
        setActionError(extractErrorMessage(error, 'Could not use Battering Ram. Try again.'));
      }
      return;
    }

    if (intent === 'shield') {
      if (!AUTH_DISABLED && !token) {
        navigate('/login', { state: { from: { pathname: '/' } } });
        return;
      }
      try {
        const authToken = AUTH_DISABLED ? 'dev-bypass-token' : token;
        if (!authToken) return;
        await territoryApi.applyShield(territory.id, authToken);
        setMapRefreshKey((v) => v + 1);
        window.dispatchEvent(new Event('feastfite:balance'));
      } catch (error) {
        console.error('Failed to apply shield', error);
        setActionError(extractErrorMessage(error, 'Could not apply Shield. Try again.'));
      }
      return;
    }

    navigate('/voting', { state: { territory } });
  }

  function handleDismissClaim() {
    navigate('/', { replace: true, state: null });
    setMapRefreshKey((v) => v + 1);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Navbar />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapView onClaim={handleClaim} refreshKey={mapRefreshKey} />
        {claimData && (
          <ClaimingMoment data={claimData} onDismiss={handleDismissClaim} />
        )}
        {actionError && (
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#ff4d6d',
              color: '#fff',
              borderRadius: 12,
              padding: '10px 20px',
              fontFamily: 'var(--font-display)',
              fontSize: '0.9rem',
              fontWeight: 700,
              zIndex: 1100,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActionError(null)}
          >
            ❌ {actionError}
          </div>
        )}
      </div>
    </div>
  );
}
