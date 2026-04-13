import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { Layer, PathOptions } from 'leaflet';
import type { Feature } from 'geojson';
import type { Territory } from '@feastfite/shared';
import 'leaflet/dist/leaflet.css';

import { MAP_CONFIG, TILE_PROVIDER, ownerColor } from '../../config/mapConfig';
import { territoryApi, type BBox } from '../../api/territoryApi';
import { TerritoryPanel } from './TerritoryPanel';

// ── Helpers ───────────────────────────────────────────────────────────────────

function polygonStyle(territory: Territory, isSelected: boolean): PathOptions {
  const fill = ownerColor(territory.ownerId);
  const isLocked =
    territory.lockedUntil != null && new Date(territory.lockedUntil) > new Date();

  return {
    fillColor: fill,
    fillOpacity: isSelected ? 0.72 : 0.42,
    color: isLocked ? '#FF3366' : fill,
    weight: isSelected ? 3 : isLocked ? 2 : 1.5,
    dashArray: isLocked ? '6 4' : undefined,
  };
}

// ── BBoxLoader ────────────────────────────────────────────────────────────────
// Child component — lives inside <MapContainer> so it can call useMap().
// Reloads territories whenever the user pans/zooms.

interface LoaderProps {
  onLoad: (territories: Territory[]) => void;
}

function BBoxLoader({ onLoad }: LoaderProps) {
  const map = useMap();

  const load = useCallback(async () => {
    const b = map.getBounds();
    const bbox: BBox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    try {
      const data = await territoryApi.getByBbox(bbox);
      onLoad(data);
    } catch {
      // territory-service not running during frontend-only dev — silent no-op
    }
  }, [map, onLoad]);

  useEffect(() => {
    load();
    map.on('moveend', load);
    return () => { map.off('moveend', load); };
  }, [map, load]);

  return null;
}

// ── MapView ───────────────────────────────────────────────────────────────────

interface MapViewProps {
  /**
   * Dev C provides this handler to trigger the photo-upload claim flow.
   * Dev B only renders the button and fires this callback.
   */
  onClaim: (territory: Territory) => void;
}

export function MapView({ onClaim }: MapViewProps) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selected, setSelected] = useState<Territory | null>(null);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={MAP_CONFIG.defaultCenter}
        zoom={MAP_CONFIG.defaultZoom}
        minZoom={MAP_CONFIG.minZoom}
        maxZoom={MAP_CONFIG.maxZoom}
        maxBounds={MAP_CONFIG.maxBounds}
        maxBoundsViscosity={0.9}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Tile layer — swap URL in mapConfig.ts to change to Google Maps / Mapbox */}
        <TileLayer
          url={TILE_PROVIDER.url}
          attribution={TILE_PROVIDER.attribution}
          subdomains={TILE_PROVIDER.subdomains}
        />

        <BBoxLoader onLoad={setTerritories} />

        {territories.map((territory) => (
          <GeoJSON
            // Key includes updatedAt so the layer re-renders on ownership change
            key={`${territory.id}-${String(territory.updatedAt)}`}
            data={territory.geoJson as Feature}
            style={() => polygonStyle(territory, selected?.id === territory.id)}
            onEachFeature={(_feature: Feature, layer: Layer) => {
              layer.on('click', () => {
                setSelected(territory);
                // Bring selected polygon to front so its border renders on top
                if ('bringToFront' in layer) {
                  (layer as { bringToFront: () => void }).bringToFront();
                }
              });

              layer.bindTooltip(territory.name, {
                permanent: false,
                direction: 'center',
                className: 'ff-territory-tooltip',
              });
            }}
          />
        ))}
      </MapContainer>

      {/* Sidebar panel — slides over the map when a territory is selected */}
      <TerritoryPanel
        territory={selected}
        onClose={() => setSelected(null)}
        onClaim={onClaim}
        // ownerName / ownerAvatarUrl resolved by parent via profile-service when needed
      />
    </div>
  );
}
