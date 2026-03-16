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
  type?: VehicleType;
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

export interface TransitStop {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export interface TransitRouteResult {
  line: string;
  type: VehicleType;
  boardStop: TransitStop;
  alightStop: TransitStop;
  stops: TransitStop[];
  geometry: [number, number][];
  walkToStop: number;   // meters
  walkFromStop: number; // meters
  duration: number;     // total minutes
  numStops: number;
  // 1-transfer fields (optional):
  isTransfer?: boolean;
  line2?: string;
  type2?: VehicleType;
  boardStop2?: TransitStop;
  alightStop2?: TransitStop;
  stops2?: TransitStop[];
  transferStop?: TransitStop;
  transferWalk?: number; // meters at transfer point
  numStops2?: number;
}

/** One step in a turn-by-turn navigation session */
export interface NavStep {
  type: 'walk' | 'transit' | 'transfer' | 'arrive';
  instruction: string;
  detail?: string;
  distanceM?: number;   // walk distance
  targetLat?: number;   // GPS waypoint to advance past
  targetLng?: number;
  line?: string;
  vehicleType?: VehicleType;
  numStops?: number;
}
