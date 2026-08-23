'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getIstDateString } from '@/lib/dateUtils';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom dot icon for path points
const dotIcon = L.divIcon({
    className: 'bg-transparent',
    html: `<div class="w-2.5 h-2.5 bg-[#003875] rounded-full border-2 border-white shadow-sm"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5]
});

// Current location pulse icon
const createPulseIcon = (color: string) => L.divIcon({
    className: 'bg-transparent',
    html: `
        <div class="relative w-8 h-8 flex items-center justify-center">
            <div class="absolute inset-0 bg-${color}-500 opacity-20 rounded-full animate-ping"></div>
            <div class="absolute inset-2 bg-${color}-500 opacity-40 rounded-full animate-pulse"></div>
            <div class="w-3 h-3 bg-${color}-600 rounded-full border-2 border-white shadow-md z-10"></div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});


export default function AdminMap() {
    const [locations, setLocations] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dateStr, setDateStr] = useState(getIstDateString());
    const [attendanceData, setAttendanceData] = useState<any[]>([]);

    useEffect(() => {
        const fetchMapData = async () => {
            setIsLoading(true);
            try {
                // Fetch live locations for the day
                const liveRes = await fetch(`/api/field-driver/live?date=${dateStr}`);
                if (liveRes.ok) {
                    const data = await liveRes.json();
                    setLocations(data.records);
                }

                // Fetch attendance to know who is active, total kms etc.
                // Wait, we need an endpoint to get all field drivers for today.
                // For simplicity, we can extract unique users from live locations for now.
                
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMapData();
        const interval = setInterval(fetchMapData, 60000); // refresh every minute
        return () => clearInterval(interval);
    }, [dateStr]);

    // Group locations by user (Now 1 row per user per day with pathData JSON)
    const userPaths: Record<string, { userName: string, points: [number, number][] }> = {};
    
    locations.forEach(loc => {
        let parsed = [];
        try {
            parsed = JSON.parse(loc.pathData || '[]');
        } catch(e) {}
        
        userPaths[loc.userId] = {
            userName: loc.userName,
            points: parsed.map((p: any) => [parseFloat(p.lat), parseFloat(p.lng)])
        };
    });

    const activeUsers = Object.keys(userPaths);

    // Default center (New Delhi if no data)
    let center: [number, number] = [28.6139, 77.2090];
    if (activeUsers.length > 0) {
        // Center on the first user's last known location
        const firstUserPoints = userPaths[activeUsers[0]].points;
        center = firstUserPoints[firstUserPoints.length - 1];
    }

    const colors = ['#FFD500', '#062B6F', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

    return (
        <div className="w-full h-full relative flex flex-col md:flex-row">
            {/* Sidebar List */}
            <div className="w-full md:w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-r border-gray-200 dark:border-white/10 z-[400] flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-200 dark:border-white/10">
                    <h3 className="text-sm font-black text-[#062B6F] dark:text-[#FFD500] uppercase tracking-widest mb-3">Live Fleet Tracking</h3>
                    <input 
                        type="date" 
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[#FFD500]"
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {isLoading && activeUsers.length === 0 && (
                        <div className="p-4 text-center text-xs font-bold text-gray-400">Loading Map Data...</div>
                    )}
                    {!isLoading && activeUsers.length === 0 && (
                        <div className="p-4 text-center text-xs font-bold text-gray-400">No field movement recorded today.</div>
                    )}
                    
                    {activeUsers.map((uid, idx) => {
                        const path = userPaths[uid];
                        const isSelected = selectedUser === uid;
                        const colorClass = isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-500/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50 border-transparent';
                        
                        return (
                            <div 
                                key={uid}
                                onClick={() => setSelectedUser(isSelected ? null : uid)}
                                className={`p-3 rounded-xl border cursor-pointer transition-colors ${colorClass}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-black text-gray-900 dark:text-white uppercase truncate">{path.userName}</div>
                                        <div className="text-[10px] text-gray-500 font-medium">{path.points.length} Pings</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 h-full z-0 bg-gray-100 dark:bg-slate-800 relative">
                {isLoading && (
                    <div className="absolute top-4 right-4 z-[400] bg-white dark:bg-slate-900 px-4 py-2 rounded-full shadow-lg text-xs font-black tracking-widest text-[#062B6F] dark:text-[#FFD500] flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-[#062B6F] border-t-transparent dark:border-[#FFD500] dark:border-t-transparent rounded-full animate-spin"></div>
                        Syncing...
                    </div>
                )}
                
                <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    
                    {activeUsers.map((uid, idx) => {
                        // If a user is selected, only show them. Else show all.
                        if (selectedUser && selectedUser !== uid) return null;

                        const path = userPaths[uid];
                        const polylineColor = colors[idx % colors.length];
                        const lastPoint = path.points[path.points.length - 1];

                        return (
                            <React.Fragment key={uid}>
                                {/* Draw Path */}
                                {path.points.length > 1 && (
                                    <Polyline 
                                        positions={path.points} 
                                        pathOptions={{ color: polylineColor, weight: 4, opacity: 0.8 }} 
                                    />
                                )}
                                
                                {/* Current/Last Known Location Marker */}
                                <Marker position={lastPoint} icon={
                                    L.divIcon({
                                        className: 'bg-transparent',
                                        html: `
                                            <div class="relative flex flex-col items-center group -mt-4">
                                                <div class="w-10 h-10 rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] border-[3px] flex items-center justify-center text-xl transition-transform group-hover:scale-110 z-10" style="border-color: ${polylineColor}">
                                                    🛵
                                                </div>
                                                <!-- Triangle pointer -->
                                                <div class="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent -mt-1 z-0 drop-shadow-sm" style="border-top-color: ${polylineColor}"></div>
                                                
                                                <div class="mt-1 whitespace-nowrap bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-md shadow-md border border-gray-100 text-[10px] font-black uppercase text-gray-800 z-20">
                                                    ${path.userName}
                                                </div>
                                            </div>
                                        `,
                                        iconSize: [60, 80],
                                        iconAnchor: [30, 40]
                                    })
                                }>
                                    <Popup className="font-sans">
                                        <div className="font-black text-sm uppercase mb-1" style={{ color: polylineColor }}>{path.userName}</div>
                                        <div className="text-xs text-gray-500 font-medium">Last Ping Location</div>
                                    </Popup>
                                </Marker>

                                {/* Dots along the path if selected */}
                                {selectedUser === uid && path.points.map((pt: any, i: number) => (
                                    <Marker key={i} position={pt} icon={dotIcon} />
                                ))}
                            </React.Fragment>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
}
