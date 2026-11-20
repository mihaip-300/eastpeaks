// Run with: npm test  (node --test, no extra dependencies)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimate, roomsNeeded, skipassForDays, type CalculatorData, type CalculatorInput } from './calculator.ts';

test('skipass rule from 1-day and 6-day prices', () => {
  assert.equal(skipassForDays(1, 48, 180), 48);
  assert.equal(skipassForDays(3, 48, 180), 144); // 3 x 48 < 180
  assert.equal(skipassForDays(5, 48, 180), 180); // 5 x 48 = 240, capped at the 6-day price
  assert.equal(skipassForDays(6, 48, 180), 180);
  assert.equal(skipassForDays(8, 48, 180), 276); // 180 + 2 x 48
  assert.equal(skipassForDays(4, 48, null), 192);
  assert.equal(skipassForDays(2, null, 180), null);
});

test('rooms from people and capacity', () => {
  assert.equal(roomsNeeded(2, 2), 1);
  assert.equal(roomsNeeded(3, 2), 2);
  assert.equal(roomsNeeded(0, 2), 1);
});

const poiana: CalculatorData = {
  // 240 / 900 / 140 / 480 lei at 5 lei per euro, for round numbers.
  skipassEur: { adult_1d: 48, adult_6d: 180, child_1d: 28, child_6d: 96 },
  accommodationEur: { budget: 70, mid: 120, premium: 220 },
  roomCapacity: 2,
  rentalEur: { adult: 25, child: 18 },
  drive: { bucuresti: { km: 187, road_costs_eur: 0 } },
};

const base: CalculatorInput = {
  adults: 2,
  children: 1,
  skiDays: 5,
  nights: 5,
  tier: 'mid',
  rental: true,
  transport: 'car',
  city: 'bucuresti',
  manualTransportEur: 0,
  fuelPriceEurPerL: 1.6,
  consumptionL100: 7,
};

test('hand-checked case: 2 adults + 1 child, 5 days, Poiana Brașov, mid tier, from București', () => {
  const r = estimate(poiana, base);
  // Skipass: adult min(5 x 48, 180) = 180 x 2 = 360; child min(5 x 28, 96) = 96. Total 456.
  assert.equal(r.skipass, 456);
  // Rooms: ceil(3 / 2) = 2. Accommodation: 120 x 5 nights x 2 rooms = 1200.
  assert.equal(r.rooms, 2);
  assert.equal(r.accommodation, 1200);
  // Rental: (25 x 2 + 18 x 1) x 5 days = 340.
  assert.equal(r.rental, 340);
  // Car: 187 x 2 = 374 km x 7 / 100 = 26.18 l x 1.6 = 41.888 -> 41.89; + 0 road costs.
  assert.equal(r.transport, 41.89);
  assert.equal(r.total, 2037.89);
  assert.equal(r.incomplete, false);
});

test('missing data is unavailable, not zero', () => {
  const bansko: CalculatorData = { ...poiana, skipassEur: { adult_1d: null, adult_6d: null, child_1d: null, child_6d: null } };
  const r = estimate(bansko, base);
  assert.equal(r.skipass, null);
  assert.equal(r.incomplete, true);
  assert.equal(r.total, 1200 + 340 + 41.89);

  const noCity = estimate(poiana, { ...base, city: 'cluj' });
  assert.equal(noCity.transport, null);
});

test('no rental and manual transport', () => {
  const r = estimate(poiana, { ...base, rental: false, transport: 'manual', manualTransportEur: 250 });
  assert.equal(r.rental, 0);
  assert.equal(r.transport, 250);
});
