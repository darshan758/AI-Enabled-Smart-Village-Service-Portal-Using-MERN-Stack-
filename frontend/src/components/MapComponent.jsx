import React, { useEffect, useRef } from 'react';

// Leaflet is loaded via CDN in index.html
// This component works with window.L

const STATUS_ICON_COLOR = {
  Pending: '#f59e0b',
  'In Progress': '#3b82f6',
  Resolved: '#22c55e',
  Rejected: '#ef4444',
};

export default function MapComponent({
  complaints = [],
  center = [20.5937, 78.9629], // India center
  zoom = 5,
  height = '400px',
  selectable = false,
  onLocationSelect = null,
  selectedLat = null,
  selectedLng = null,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    // Wait for Leaflet to be available
    if (typeof window === 'undefined' || !window.L) {
      const interval = setInterval(() => {
        if (window.L) {
          clearInterval(interval);
          initMap();
        }
      }, 100);
      return () => clearInterval(interval);
    }
    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const initMap = () => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;

    const map = L.map(mapRef.current).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Click to select location
    if (selectable) {
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        placeSelectMarker(lat, lng);
        if (onLocationSelect) onLocationSelect(lat, lng);
      });
    }

    // Add complaint markers
    addMarkers(complaints);

    // Add existing selected marker
    if (selectedLat && selectedLng) {
      placeSelectMarker(selectedLat, selectedLng);
    }
  };

  const placeSelectMarker = (lat, lng) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!map) return;

    if (markerRef.current) markerRef.current.remove();

    const icon = L.divIcon({
      html: `<div style="background:#16a34a;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      className: '',
    });

    markerRef.current = L.marker([lat, lng], { icon })
      .addTo(map)
      .bindPopup(`📍 Selected: ${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      .openPopup();
  };

  const addMarkers = (complaints) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    complaints.forEach((c) => {
      if (!c.latitude || !c.longitude) return;
      const color = STATUS_ICON_COLOR[c.status] || '#6b7280';

      const icon = L.divIcon({
        html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: '',
      });

      const marker = L.marker([c.latitude, c.longitude], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px;font-family:sans-serif">
            <strong style="font-size:13px">${c.title}</strong><br/>
            <span style="font-size:11px;color:#6b7280">${c.category}</span><br/>
            <span style="font-size:11px;background:${color};color:white;padding:1px 8px;border-radius:12px;display:inline-block;margin-top:4px">${c.status}</span>
            ${c.user?.name ? `<br/><span style="font-size:11px;color:#6b7280;margin-top:2px;display:block">By: ${c.user.name}</span>` : ''}
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Fit bounds if markers exist
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 14 });
    }
  };

  // Update markers when complaints change
  useEffect(() => {
    if (mapInstanceRef.current) addMarkers(complaints);
  }, [complaints]);

  // Update selected marker
  useEffect(() => {
    if (mapInstanceRef.current && selectedLat && selectedLng) {
      placeSelectMarker(selectedLat, selectedLng);
    }
  }, [selectedLat, selectedLng]);

  return (
    <div className="relative">
      <div ref={mapRef} style={{ height, width: '100%' }} className="rounded-xl overflow-hidden z-0" />
      {selectable && (
        <div className="absolute bottom-3 left-3 bg-white dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg shadow-md z-10">
          📍 Click on map to set location
        </div>
      )}
    </div>
  );
}
