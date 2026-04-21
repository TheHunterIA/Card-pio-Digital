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

export interface DeliveryRadius {
  id: string;
  maxDistance: number;
  fee: number;
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
}

export function getDeliveryFeeCalculation(distanceKm: number, config: DeliveryConfig): number {
  if (!config || !config.radii || config.radii.length === 0) return 0;
  
  const sortedRadii = [...config.radii].sort((a, b) => a.maxDistance - b.maxDistance);
  const radius = sortedRadii.find(r => distanceKm <= r.maxDistance);
  
  if (!radius) return sortedRadii[sortedRadii.length - 1].fee;
  
  let fee = radius.fee;
  
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
