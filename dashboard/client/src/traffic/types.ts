// traffic/types.ts - SIMULATED urban traffic type definitions

export type VehicleState = 'driving' | 'braking' | 'stopped' | 'turning' | 'uncertain';
export type VehicleType = 'sedan' | 'suv' | 'truck' | 'hatchback';

export interface LaneNode {
  id: string;
  x: number;
  y: number;
  next: string[];
  isIntersection?: boolean;
  trafficLightGroup?: string;
  laneId?: string;
}

export interface LaneGraph {
  nodes: Map<string, LaneNode>;
}

export interface TrafficLight {
  groupId: string;
  greenDuration: number;
  redDuration: number;
  elapsed: number;
  isGreen: boolean;
}

export interface VehicleRoute {
  nodeIds: string[];
  edgeIndex: number;
  edgeProgress: number;
}

export interface SimVehicle {
  id: string;
  type: VehicleType;
  x: number;
  y: number;
  heading: number;
  speed: number;
  targetSpeed: number;
  state: VehicleState;
  route: VehicleRoute;
  size: [number, number];
  color: number;
  isBraking: boolean;
  indicator: 0 | 1 | -1;
  indicatorTimer: number;
  isSelected: boolean;
  inLidarRange: boolean;
  trail: Array<{ x: number; y: number }>;
  timeSinceLastLaneChange: number;
  gapAhead: number;
}

export interface TrafficSimState {
  vehicles: SimVehicle[];
  lights: Map<string, TrafficLight>;
  elapsed: number;
  egoX: number;
  egoY: number;
  egoSensingRadius: number;
}

export interface EventFeedItem {
  id: string;
  timestamp: number;
  type: 'entered_range' | 'exited_range' | 'stopped_intersection' | 'lane_change' | 'collision_risk' | 'braking_event';
  vehicleId: string;
  message: string;
}
