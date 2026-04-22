import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Territory } from '@feastfite/shared';
import { AUTH_DISABLED } from '../config/devAuth';
import { useAuth } from '../contexts/AuthContext';
import { Navbar } from '../components/layout/Navbar';
import { MapView } from '../components/map/MapView';

export function MapPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mapRefreshKey] = useState(0);

  function handleClaim(territory: Territory) {
    if (!AUTH_DISABLED && !isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }
    navigate('/voting', { state: { territory } });
  }

  return (
    <div className="ff-map-page">
      <Navbar />
      <div className="ff-map-shell">
        <MapView onClaim={handleClaim} refreshKey={mapRefreshKey} />
      </div>
    </div>
  );
}
