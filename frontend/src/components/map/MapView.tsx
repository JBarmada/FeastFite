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

  return {
    fillColor: fill,
    fillOpacity: isSelected ? 0.88 : 0.58,
    color: isSelected ? '#1A0040' : '#5B0EA6',
    weight: isSelected ? 4 : 2,
    dashArray: isSelected ? undefined : '6 4',
  };
}

// ── BBoxLoader ────────────────────────────────────────────────────────────────
// Child component — lives inside <MapContainer> so it can call useMap().
// Reloads territories whenever the user pans/zooms.

interface LoaderProps {
  onLoad: (territories: Territory[]) => void;
  refreshKey?: number;
}

function BBoxLoader({ onLoad, refreshKey }: LoaderProps) {
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

  // Force reload when parent increments refreshKey (e.g. after a claim)
  useEffect(() => {
    if (refreshKey !== undefined) void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return null;
}

// ── MapView ───────────────────────────────────────────────────────────────────

interface MapViewProps {
  onClaim: (territory: Territory) => void;
  /** Increment to force a territory reload (e.g. after a claim or vote win) */
  refreshKey?: number;
}

export function MapView({ onClaim, refreshKey }: MapViewProps) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selected, setSelected] = useState<Territory | null>(null);

  return (
    <div className="ff-map-view">
      <MapContainer
        center={MAP_CONFIG.defaultCenter}
        zoom={MAP_CONFIG.defaultZoom}
        minZoom={MAP_CONFIG.minZoom}
        maxZoom={MAP_CONFIG.maxZoom}
        maxBounds={MAP_CONFIG.maxBounds}
        maxBoundsViscosity={0.9}
        className="ff-map-canvas"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Tile layer — swap URL in mapConfig.ts to change to Google Maps / Mapbox */}
        <TileLayer
          url={TILE_PROVIDER.url}
          attribution={TILE_PROVIDER.attribution}
          subdomains={TILE_PROVIDER.subdomains}
          maxNativeZoom={19}
          maxZoom={21}
        />

        <BBoxLoader onLoad={setTerritories} refreshKey={refreshKey} />

        {territories.map((territory) => (
          <GeoJSON
            // Key includes updatedAt + selection state so Leaflet re-renders style correctly
            key={`${territory.id}-${String(territory.updatedAt)}-${selected?.id === territory.id}`}
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
        ownerName={selected?.ownerName ?? undefined}
      />
    </div>
  );
}
