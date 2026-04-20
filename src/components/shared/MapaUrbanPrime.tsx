import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom Icon for Restaurant (Prime Grill)
const RestaurantIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-brand rounded-xl border-4 border-white shadow-xl flex items-center justify-center transform -rotate-45">
           <div class="transform rotate-45 text-white text-[10px] font-bold">PR</div>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Custom Icon for Driver
const DriverIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-ink rounded-full border-4 border-brand shadow-xl flex items-center justify-center">
           <div class="text-[12px]">🏍️</div>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Custom Icon for Customer/Destination
const CustomerIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-emerald-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center">
           <div class="text-[12px]">🏠</div>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// Helper component to auto-recenter/resize when coordinates change
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface Coords {
  lat: number;
  lng: number;
}

interface MapaUrbanPrimeProps {
  driverCoords?: Coords | null;
  customerCoords?: Coords | null;
  restaurantCoords?: Coords | null;
  center?: [number, number];
  zoom?: number;
  height?: string;
  className?: string;
}

export default function MapaUrbanPrime({ 
  driverCoords, 
  customerCoords, 
  restaurantCoords = { lat: -22.826, lng: -43.053 }, // Default to Urban Prime HQ (Exemple)
  center,
  zoom = 15,
  height = '300px',
  className = ""
}: MapaUrbanPrimeProps) {
  
  const mapCenter: [number, number] = center || 
    (driverCoords ? [driverCoords.lat, driverCoords.lng] : 
    (customerCoords ? [customerCoords.lat, customerCoords.lng] : 
    [restaurantCoords.lat, restaurantCoords.lng]));

  return (
    <div className={`rounded-3xl overflow-hidden shadow-inner border border-black/5 relative z-0 ${className}`} style={{ height, width: '100%' }}>
      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        scrollWheelZoom={false} 
        style={{ height: '100%', width: '100%', background: '#1c1917' }}
      >
        {/* Dark Mode TileLayer for Prime Aesthetics */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapController center={mapCenter} />

        {/* Restaurant Pin */}
        {restaurantCoords && (
          <Marker position={[restaurantCoords.lat, restaurantCoords.lng]} icon={RestaurantIcon}>
            <Popup>
              <div className="font-display font-bold">Urban Prime Grill</div>
              <div className="text-[10px] uppercase text-ink-muted">Ponto de Partida</div>
            </Popup>
          </Marker>
        )}

        {/* Driver Pin */}
        {driverCoords && (
          <Marker position={[driverCoords.lat, driverCoords.lng]} icon={DriverIcon}>
            <Popup>
              <div className="font-display font-bold">Entregador Prime</div>
              <div className="text-[10px] uppercase text-ink-muted">Em movimento</div>
            </Popup>
          </Marker>
        )}

        {/* Destination Pin */}
        {customerCoords && (
          <Marker position={[customerCoords.lat, customerCoords.lng]} icon={CustomerIcon}>
            <Popup>
              <div className="font-display font-bold">Destino do Pedido</div>
              <div className="text-[10px] uppercase text-ink-muted">Aguardando entrega</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
