export type VehicleType = 'bus' | 'tram' | 'trolley' | 'metro';

export interface Vehicle {
  id: string;
  lat: number;
  lng: number;
  bearing?: number;
  speed?: number;
  line: string;
  type: VehicleType;
  tripId?: string;
  routeId?: string;
  directionHeadsign?: string;
  timestamp?: number;
}

export interface Stop {
  id: string;
  code: string;
  name: string;
  nameBg?: string;
  lat: number;
  lng: number;
  lines?: string[];
}

export interface ArrivalTime {
  line: string;
  type: VehicleType;
  direction: string;
  minutes: number;
  isRealtime: boolean;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  mode: 'walk' | 'transit';
  line?: string;
  type?: VehicleType;
  from?: string;
  to?: string;
}

export interface TransitRoute {
  duration: number;
  transfers: number;
  steps: RouteStep[];
  departureTime?: string;
  arrivalTime?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'stop' | 'place';
}
