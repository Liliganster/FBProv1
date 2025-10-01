export interface CO2CalculationParams {
  distance: number; // in km
  fuelConsumption?: number; // in L/100km for combustion vehicles
  vehicleType?: 'combustion' | 'electric';
  energyConsumption?: number; // in kWh/100km for electric vehicles
}

/**
 * Standard CO2 emission factors (in kg CO2 per unit)
 * Sources: DEFRA, EPA, and European Environment Agency
 */
export const CO2_EMISSION_FACTORS = {
  // Gasoline: approximately 2.3 kg CO2 per liter
  GASOLINE_PER_LITER: 2.3,
  // Diesel: approximately 2.7 kg CO2 per liter
  DIESEL_PER_LITER: 2.7,
  // Electricity: European average grid mix (approximately 0.3 kg CO2 per kWh)
  ELECTRICITY_PER_KWH: 0.3,
} as const;

/**
 * Calculate CO2 emissions for a trip based on distance and vehicle parameters
 */
export function calculateCO2Emissions(params: CO2CalculationParams): number {
  const { distance, vehicleType = 'combustion', fuelConsumption, energyConsumption } = params;

  if (vehicleType === 'combustion' && fuelConsumption) {
    // Assume gasoline if not specified
    const fuelPerKm = fuelConsumption / 100; // Convert L/100km to L/km
    return distance * fuelPerKm * CO2_EMISSION_FACTORS.GASOLINE_PER_LITER;
  }

  if (vehicleType === 'electric' && energyConsumption) {
    // Electric vehicle calculation
    const energyPerKm = energyConsumption / 100; // Convert kWh/100km to kWh/km
    return distance * energyPerKm * CO2_EMISSION_FACTORS.ELECTRICITY_PER_KWH;
  }

  // Default calculation: assume average gasoline consumption of 7L/100km
  const defaultFuelPerKm = 0.07; // 7L/100km
  return distance * defaultFuelPerKm * CO2_EMISSION_FACTORS.GASOLINE_PER_LITER;
}

/**
 * Calculate average CO2 efficiency (kg CO2 per km)
 */
export function calculateCO2Efficiency(params: CO2CalculationParams): number {
  const totalEmissions = calculateCO2Emissions(params);
  return totalEmissions / params.distance;
}

/**
 * Calculate total fuel consumption for combustion vehicles
 */
export function calculateFuelConsumption(distance: number, fuelEfficiency: number): number {
  return (distance * fuelEfficiency) / 100; // Convert L/100km to total liters
}

/**
 * Calculate how many trees are needed to offset CO2 emissions
 * Based on approximate CO2 absorption of 22kg per tree per year
 */
export function calculateTreesNeeded(co2Kg: number): number {
  const CO2_PER_TREE_PER_YEAR = 22; // kg
  return Math.ceil(co2Kg / CO2_PER_TREE_PER_YEAR);
}

/**
 * Get CO2 efficiency rating based on kg CO2 per km
 */
export function getCO2EfficiencyRating(efficiency: number): {
  level: 'excellent' | 'good' | 'poor' | 'very-poor';
  color: string;
  label: string;
} {
  if (efficiency <= 0.12) {
    return { level: 'excellent', color: 'text-green-400', label: 'excellent' };
  } else if (efficiency <= 0.18) {
    return { level: 'good', color: 'text-blue-400', label: 'good' };
  } else if (efficiency <= 0.25) {
    return { level: 'poor', color: 'text-yellow-400', label: 'poor' };
  } else {
    return { level: 'very-poor', color: 'text-red-400', label: 'very-poor' };
  }
}