'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getIstDateString } from '@/lib/dateUtils';
import type { LiveCoords } from '../../types/field-driver';
import { FieldCard } from '../FieldCard';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function LiveMap({
  userId,
  liveLocation,
  tall = false,
}: {
  userId: string;
  liveLocation: LiveCoords | null;
  tall?: boolean;
}) {
  const [mapTab, setMapTab] = useState<'live' | 'path'>('live');
  const [points, setPoints] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPath = async () => {
      setLoading(true);
      try {
        const date = getIstDateString();
        const res = await fetch(`/api/field-driver/live?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          const record = (data.records || []).find(
            (r: { userId: string }) => String(r.userId) === String(userId)
          );
          if (record?.pathData) {
            const parsed = JSON.parse(record.pathData || '[]');
            setPoints(parsed.map((p: { lat: string; lng: string }) => [parseFloat(p.lat), parseFloat(p.lng)]));
          } else {
            setPoints([]);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPath();
    const interval = setInterval(fetchPath, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  let center: [number, number] = liveLocation
    ? [liveLocation.lat, liveLocation.lng]
    : points.length > 0
      ? points[points.length - 1]
      : [28.6139, 77.209];

  const displayPoints =
    liveLocation && points.length === 0
      ? [[liveLocation.lat, liveLocation.lng] as [number, number]]
      : points;

  return (
    <FieldCard
      title="Live Route Map"
      compact
      headerRight={
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
          {(['live', 'path'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMapTab(t)}
              className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md ${
                mapTab === t ? 'bg-[#062B6F] text-white' : 'text-gray-500'
              }`}
            >
              {t === 'live' ? 'Live Route' : "Today's Path"}
            </button>
          ))}
        </div>
      }
    >
      <div className={`${tall ? 'h-[260px] xl:h-[280px]' : 'h-[220px] md:h-[240px]'} rounded-lg overflow-hidden border border-gray-100 dark:border-white/10 relative`}>
        {loading && !liveLocation && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50 dark:bg-slate-800 text-xs font-bold text-gray-400">
            Loading map...
          </div>
        )}
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          {displayPoints.length > 1 && (
            <Polyline positions={displayPoints} pathOptions={{ color: '#2563EB', weight: 4, opacity: 0.85 }} />
          )}
          {displayPoints.length > 0 && (
            <Marker
              position={displayPoints[0]}
              icon={L.divIcon({
                className: 'bg-transparent',
                html: '<div class="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            />
          )}
          {displayPoints.length > 0 && (
            <Marker
              position={displayPoints[displayPoints.length - 1]}
              icon={L.divIcon({
                className: 'bg-transparent',
                html: '<div class="text-2xl">🛵</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              })}
            />
          )}
        </MapContainer>
      </div>
    </FieldCard>
  );
}
