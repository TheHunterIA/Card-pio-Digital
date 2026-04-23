import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Calcula a distância entre duas coordenadas em metros
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

export async function geocodeAddressFallback(address: string, googleKey?: string): Promise<{lat: number, lng: number} | null> {
  // 1. Try Google Maps API via direct REST Fetch (More reliable than wrappers)
  if (googleKey) {
    try {
      const gRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleKey}`);
      const gData = await gRes.json();
      if (gData.status === 'OK' && gData.results && gData.results[0]) {
        return gData.results[0].geometry.location; // { lat, lng }
      }
      console.warn("Google Maps REST API failed with status:", gData.status);
    } catch (e) {
      console.error('Google Maps REST fetch failed', e);
    }
  }

  // 2. Fallback to OpenStreetMap (Nominatim) - Free, no API key needed
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9'
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    console.warn("Nominatim returned no results for:", address);
  } catch (e) {
    console.error('Nominatim REST fetch failed', e);
  }
  return null;
}

export async function reverseGeocode(lat: number, lng: number, googleKey?: string): Promise<string | null> {
  if (googleKey) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}`);
      const data = await res.json();
      if (data.status === 'OK' && data.results && data.results[0]) {
        return data.results[0].formatted_address;
      }
    } catch (e) {
      console.error('Reverse Geocode failed', e);
    }
  }
  return null;
}

export interface DeliveryRadius {
  id: string;
  maxDistance: number;
  feePerKm: number;
}

export interface PeakHourRule {
  id: string;
  dayOfWeek: number;
  startHour: string;
  endHour: string;
  feeMultiplier: number;
}

export interface DeliveryConfig {
  radii: DeliveryRadius[];
  peakHours: PeakHourRule[];
  baseLocation: { lat: number; lng: number };
  freeDeliveryThreshold?: number;
}

export function getDeliveryFeeCalculation(distanceKm: number, config: DeliveryConfig, cartTotal: number = 0): number {
  if (!config || !config.radii || config.radii.length === 0) return 0;
  
  // Check for free delivery threshold
  if (config.freeDeliveryThreshold && config.freeDeliveryThreshold > 0 && cartTotal >= config.freeDeliveryThreshold) {
    return 0;
  }
  
  const sortedRadii = [...config.radii].sort((a, b) => a.maxDistance - b.maxDistance);
  const radius = sortedRadii.find(r => distanceKm <= r.maxDistance);
  
  if (!radius) {
    const lastRadius = sortedRadii[sortedRadii.length - 1];
    return lastRadius.feePerKm * distanceKm;
  }
  
  let fee = radius.feePerKm * distanceKm;
  
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const min = now.getMinutes();
  const currentTimeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  
  const peakRule = config.peakHours?.find(p => 
    p.dayOfWeek === day && 
    currentTimeStr >= p.startHour && 
    currentTimeStr <= p.endHour
  );
  
  if (peakRule) {
    fee *= peakRule.feeMultiplier;
  }
  
  return fee;
}
