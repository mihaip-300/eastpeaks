// Defaults for the cost calculator (HANDOFF 7.1). Editable in the calculator UI.

/** Lei per euro: ECB reference rate. */
export const RON_PER_EUR = 5.3473;
export const RON_PER_EUR_DATE = '2026-11-19';
export const RON_PER_EUR_SOURCE = 'BCE (curs de referință)';

/**
 * Units of local currency per euro, for skipass prices. Bulgaria and Montenegro use EUR.
 * RSD, BAM and MKD are added (with source and date) when those resorts are.
 */
export const PER_EUR: Record<string, number> = {
  EUR: 1,
  RON: RON_PER_EUR,
};

/** Petrol price in Romania, lei per litre (approximate; editable in the calculator). */
export const FUEL_PRICE_RON = 8.0;
/** Average consumption, litres per 100 km. */
export const FUEL_CONSUMPTION_L_100KM = 7.0;
