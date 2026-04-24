import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Territory } from '@feastfite/shared';
import { AUTH_DISABLED } from '../config/devAuth';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { MapView } from '../components/map/MapView';
import { territoryApi } from '../api/territoryApi';

export function MapPage() {
  const { isAuthenticated, token } = useAuth();
  const navigate = useNavigate();
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  async function handleClaim(
    territory: Territory,
    intent: 'claim' | 'vote' | 'battering-ram',
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
        setMapRefreshKey((v) => v + 1);
        window.dispatchEvent(new Event('feastfite:balance'));
      } catch (error) {
        console.error('Failed to use battering ram', error);
      }
      return;
    }

    navigate('/voting', { state: { territory } });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Navbar />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapView onClaim={handleClaim} refreshKey={mapRefreshKey} />
      </div>
    </div>
  );
}
