export type MiningRole = 
  | 'ADMIN'
  | 'MAINTENANCE_MANAGER'
  | 'PLANNER'
  | 'SUPERVISOR'
  | 'TECHNICIAN'
  | 'RELIABILITY_ANALYST'
  | 'VIEWER';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  role: MiningRole;
  roleLabel: string;
  department: string;
  permissions: string[];
}

export type HealthSemanticState = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface ComponentHealthInfo {
  nodeId: string;
  name: string;
  systemCategory: 'DIESEL_ENGINE' | 'HYDRAULIC_SYSTEM' | 'UNDERCARRIAGE' | 'BUCKET_GET' | 'ELECTRICAL_SWING' | 'CABIN';
  healthScore: number; // 0 - 100
  semanticState: HealthSemanticState;
  estimatedRulHours: number;
  anomalyScore: number;
  temperatureC: number;
  vibrationRmsMms: number;
  pressureBar?: number;
  lastInspection: string;
  failureModeIso14224?: string;
  activeAlarms: string[];
}

export interface EquipmentTwinData {
  id: string;
  tagCode: string;
  name: string;
  equipmentType: 'HYDRAULIC_SHOVEL' | 'ELECTRIC_ROPE_SHOVEL' | 'WHEEL_LOADER' | 'EXCAVATOR';
  modelName: string;
  serialNumber: string;
  miningZone: string;
  hourMeter: number;
  overallHealthScore: number;
  status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL_ALERT' | 'UNSCHEDULED_DOWNTIME' | 'SCHEDULED_MAINTENANCE';
  nominalPayloadTons: number;
  bucketCapacityM3: number;
  components: Record<string, ComponentHealthInfo>;
  telemetrySignals: {
    engineRpm: number;
    engineTempC: number;
    fuelRateLph: number;
    hydraulicPressureBar: number;
    hydraulicOilTempC: number;
    vibrationRmsMms: number;
    vibrationKurtosis: number;
    bucketPayloadTons: number;
  };
}

export interface WhatIfScenarioParams {
  rockAbrasiveness: number; // 1.0 to 2.5
  bucketOverloadPct: number; // 0 to 30%
  postponeHours: number; // 0 to 1000h
  operatingHoursPerDay: number; // 12 to 24h
}

export interface WhatIfSimulationResult {
  wearMultiplier: number;
  projectedRulHours: number;
  simulatedHealthScore: number;
  failureRiskPct: number;
  estimatedFinancialRiskUsd: number;
  recommendation: string;
}

export interface ExecutiveKpiSummary {
  mechanicalAvailabilityPct: number;
  utilizationPct: number;
  mtbfHours: number;
  mttrHours: number;
  oeePct: number;
  activeWorkOrdersBacklog: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  planCompliancePct: number;
  costPerOperatingHourUsd: number;
  fleetHealthScore: number;
}
