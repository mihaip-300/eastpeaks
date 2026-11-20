// Holiday cost estimate (HANDOFF 7.1). Pure functions, no imports, so they can be
// tested with `node --test` and reused by the calculator island.
// A missing input makes its line `null` ("nedisponibil"), never zero.

export type City = 'bucuresti' | 'cluj' | 'brasov';
export type Tier = 'budget' | 'mid' | 'premium';

export interface SkipassPrices {
  adult_1d: number | null;
  adult_6d: number | null;
  child_1d: number | null;
  child_6d: number | null;
}

export interface CalculatorData {
  /** Skipass prices already converted to EUR. */
  skipassEur: SkipassPrices | null;
  accommodationEur: Partial<Record<Tier, number>>;
  roomCapacity: number;
  rentalEur: { adult?: number; child?: number };
  drive: Partial<Record<City, { km: number; road_costs_eur: number }>>;
}

export interface CalculatorInput {
  adults: number;
  children: number;
  skiDays: number;
  nights: number;
  tier: Tier;
  /** Rooms; when omitted, derived from people / room capacity. */
  rooms?: number;
  rental: boolean;
  transport: 'car' | 'manual';
  city: City;
  /** Manual transport cost for the whole group, EUR. */
  manualTransportEur: number;
  fuelPriceEurPerL: number;
  consumptionL100: number;
}

export interface Breakdown {
  skipass: number | null;
  accommodation: number | null;
  rental: number | null;
  transport: number | null;
  /** Sum of the available lines. */
  total: number;
  /** True when at least one requested line is unavailable. */
  incomplete: boolean;
  rooms: number;
}

/**
 * Skipass for N days from the 1-day and 6-day prices (HANDOFF 7.1):
 * 1 -> 1d; 2-5 -> min(N x 1d, 6d); 6 -> 6d; >6 -> 6d + (N - 6) x 1d.
 */
export function skipassForDays(days: number, oneDay: number | null, sixDays: number | null): number | null {
  if (days <= 0) return 0;
  if (oneDay == null) return days === 6 && sixDays != null ? sixDays : null;
  if (days === 1) return oneDay;
  if (sixDays == null) return days * oneDay;
  if (days < 6) return Math.min(days * oneDay, sixDays);
  return sixDays + (days - 6) * oneDay;
}

export function roomsNeeded(people: number, capacity: number): number {
  return Math.max(1, Math.ceil(people / Math.max(1, capacity)));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function estimate(data: CalculatorData, input: CalculatorInput): Breakdown {
  const { adults, children, skiDays, nights } = input;
  const people = adults + children;

  let skipass: number | null = null;
  if (data.skipassEur) {
    const a = adults > 0 ? skipassForDays(skiDays, data.skipassEur.adult_1d, data.skipassEur.adult_6d) : 0;
    const c = children > 0 ? skipassForDays(skiDays, data.skipassEur.child_1d, data.skipassEur.child_6d) : 0;
    skipass = a == null || c == null ? null : round2(a * adults + c * children);
  }

  const rooms = input.rooms ?? roomsNeeded(people, data.roomCapacity);
  const perNight = data.accommodationEur[input.tier];
  const accommodation = perNight == null ? null : round2(perNight * nights * rooms);

  let rental: number | null = 0;
  if (input.rental) {
    const { adult, child } = data.rentalEur;
    rental = (adults > 0 && adult == null) || (children > 0 && child == null) ? null : round2(((adult ?? 0) * adults + (child ?? 0) * children) * skiDays);
  }

  let transport: number | null;
  if (input.transport === 'manual') {
    transport = round2(input.manualTransportEur);
  } else {
    const route = data.drive[input.city];
    transport = route
      ? round2(((route.km * 2 * input.consumptionL100) / 100) * input.fuelPriceEurPerL + route.road_costs_eur)
      : null;
  }

  const lines = [skipass, accommodation, rental, transport];
  return {
    skipass,
    accommodation,
    rental,
    transport,
    total: round2(lines.reduce<number>((sum, v) => sum + (v ?? 0), 0)),
    incomplete: lines.some((v) => v == null),
    rooms,
  };
}
