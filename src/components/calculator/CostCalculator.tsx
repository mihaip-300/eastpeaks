/** @jsxImportSource preact */
import { useMemo, useState } from 'preact/hooks';
import { AFFILIATE_REL, affiliateHref } from '../../lib/affiliate';
import { estimate, roomsNeeded, type CalculatorData, type City, type Tier } from '../../lib/calculator';

interface Props {
  slug: string;
  name: string;
  data: CalculatorData;
  ronPerEur: number;
  rateNote: string;
  defaultFuelPriceRon: number;
  defaultConsumption: number;
  /** Booking target for the "find accommodation" button, if the resort has one. */
  bookingTarget: string | null;
}

const CITIES: { key: City; label: string }[] = [
  { key: 'bucuresti', label: 'București' },
  { key: 'cluj', label: 'Cluj-Napoca' },
  { key: 'brasov', label: 'Brașov' },
];
const TIERS: { key: Tier; label: string }[] = [
  { key: 'budget', label: 'Buget' },
  { key: 'mid', label: 'Mediu' },
  { key: 'premium', label: 'Premium' },
];

const eur = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 });
const lei = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });

function clampInt(value: string, min: number, max: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function Num(props: { id: string; label: string; value: number; min: number; max: number; onInput: (v: number) => void; step?: number }) {
  return (
    <div>
      <label for={props.id} class="label block text-mist">
        {props.label}
      </label>
      <input
        id={props.id}
        type="number"
        inputMode="numeric"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onInput={(e) => props.onInput(clampInt((e.target as HTMLInputElement).value, props.min, props.max))}
        class="mt-2 w-full rounded-sm border border-gold/25 bg-midnight px-3 py-2.5 text-ivory tabular-nums focus:border-gold"
      />
    </div>
  );
}

export default function CostCalculator({ slug, name, data, ronPerEur, rateNote, defaultFuelPriceRon, defaultConsumption, bookingTarget }: Props) {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [skiDays, setSkiDays] = useState(5);
  const [nights, setNights] = useState(5);
  const [tier, setTier] = useState<Tier>('mid');
  const [roomsOverride, setRoomsOverride] = useState<number | null>(null);
  const [rental, setRental] = useState(false);
  const [transport, setTransport] = useState<'car' | 'manual'>('car');
  const [city, setCity] = useState<City>('bucuresti');
  const [manualTransport, setManualTransport] = useState(200);
  const [fuelRon, setFuelRon] = useState(defaultFuelPriceRon);
  const [consumption, setConsumption] = useState(defaultConsumption);

  const autoRooms = roomsNeeded(adults + children, data.roomCapacity);
  const rooms = roomsOverride ?? autoRooms;

  const result = useMemo(
    () =>
      estimate(data, {
        adults,
        children,
        skiDays,
        nights,
        tier,
        rooms,
        rental,
        transport,
        city,
        manualTransportEur: manualTransport,
        fuelPriceEurPerL: fuelRon / ronPerEur,
        consumptionL100: consumption,
      }),
    [adults, children, skiDays, nights, tier, rooms, rental, transport, city, manualTransport, fuelRon, consumption],
  );

  const lines: { label: string; value: number | null; hint?: string }[] = [
    { label: 'Skipass', value: result.skipass, hint: `${skiDays} ${skiDays === 1 ? 'zi' : 'zile'}` },
    { label: 'Cazare', value: result.accommodation, hint: `${nights} ${nights === 1 ? 'noapte' : 'nopți'}, ${rooms} ${rooms === 1 ? 'cameră' : 'camere'}` },
    ...(rental ? [{ label: 'Închiriere echipament', value: result.rental }] : []),
    { label: transport === 'car' ? 'Mașină (carburant și taxe)' : 'Transport', value: result.transport, hint: transport === 'car' ? `dus-întors din ${CITIES.find((c) => c.key === city)?.label}` : undefined },
  ];

  const field = 'mt-2 w-full rounded-sm border border-gold/25 bg-midnight px-3 py-2.5 text-ivory focus:border-gold';

  return (
    <div class="grid gap-10 lg:grid-cols-[1fr_21rem]">
      <form class="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3" onSubmit={(e) => e.preventDefault()}>
        <Num id="calc-adults" label="Adulți" value={adults} min={1} max={20} onInput={setAdults} />
        <Num id="calc-children" label="Copii" value={children} min={0} max={20} onInput={setChildren} />
        <Num id="calc-days" label="Zile de schi" value={skiDays} min={1} max={14} onInput={setSkiDays} />
        <Num id="calc-nights" label="Nopți" value={nights} min={0} max={21} onInput={setNights} />

        <div>
          <label for="calc-tier" class="label block text-mist">Cazare</label>
          <select id="calc-tier" value={tier} onChange={(e) => setTier((e.target as HTMLSelectElement).value as Tier)} class={field}>
            {TIERS.map((t) => (
              <option value={t.key} disabled={data.accommodationEur[t.key] == null}>{t.label}</option>
            ))}
          </select>
        </div>
        <Num
          id="calc-rooms"
          label="Camere"
          value={rooms}
          min={1}
          max={20}
          onInput={(v) => setRoomsOverride(v === autoRooms ? null : v)}
        />

        <fieldset class="col-span-2 sm:col-span-3">
          <legend class="label text-mist">Transport</legend>
          <div class="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            <label class="inline-flex items-center gap-2">
              <input type="radio" name="calc-transport" checked={transport === 'car'} onChange={() => setTransport('car')} class="accent-alpine-red" />
              Cu mașina
            </label>
            <label class="inline-flex items-center gap-2">
              <input type="radio" name="calc-transport" checked={transport === 'manual'} onChange={() => setTransport('manual')} class="accent-alpine-red" />
              Altfel (introduc costul)
            </label>
          </div>
        </fieldset>

        {transport === 'car' ? (
          <>
            <div>
              <label for="calc-city" class="label block text-mist">Plecare din</label>
              <select id="calc-city" value={city} onChange={(e) => setCity((e.target as HTMLSelectElement).value as City)} class={field}>
                {CITIES.map((c) => (
                  <option value={c.key} disabled={!data.drive[c.key]}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label for="calc-fuel" class="label block text-mist">Carburant (lei/l)</label>
              <input id="calc-fuel" type="number" inputMode="decimal" min={1} max={20} step={0.1} value={fuelRon}
                onInput={(e) => setFuelRon(Number((e.target as HTMLInputElement).value) || defaultFuelPriceRon)} class={`${field} tabular-nums`} />
            </div>
            <div>
              <label for="calc-consumption" class="label block text-mist">Consum (l/100 km)</label>
              <input id="calc-consumption" type="number" inputMode="decimal" min={2} max={25} step={0.1} value={consumption}
                onInput={(e) => setConsumption(Number((e.target as HTMLInputElement).value) || defaultConsumption)} class={`${field} tabular-nums`} />
            </div>
          </>
        ) : (
          <Num id="calc-manual" label="Cost transport (€, total)" value={manualTransport} min={0} max={20000} onInput={setManualTransport} />
        )}

        <label class="col-span-2 inline-flex items-center gap-2 sm:col-span-3">
          <input type="checkbox" checked={rental} onChange={() => setRental((v) => !v)} class="accent-alpine-red" />
          Închiriez echipament (schiuri, clăpari, bețe)
        </label>
      </form>

      <div class="rounded-lg bg-midnight p-6 sm:p-7" aria-live="polite">
        <h3 class="label">Estimare pentru {name}</h3>
        <dl class="mt-5 space-y-3 text-[0.9375rem]">
          {lines.map((l) => (
            <div class="flex items-baseline justify-between gap-3">
              <dt>
                {l.label}
                {l.hint && <span class="block text-xs text-mist">{l.hint}</span>}
              </dt>
              <dd class="text-right tabular-nums">{l.value == null ? <span class="text-mist">nedisponibil</span> : eur.format(l.value)}</dd>
            </div>
          ))}
        </dl>
        <div class="mt-6 border-t border-gold/25 pt-5">
          <p class="flex items-baseline justify-between">
            <span class="label">Total</span>
            <span class="font-display text-[2.75rem] leading-none text-gold tabular-nums">{eur.format(result.total)}</span>
          </p>
          <p class="text-right text-sm text-mist tabular-nums">≈ {lei.format(result.total * ronPerEur)} lei</p>
          {result.incomplete && <p class="mt-2 text-xs text-mist">Totalul nu include liniile „nedisponibil”.</p>}
          <p class="mt-2 text-xs text-mist">{rateNote}</p>
        </div>
        {bookingTarget && (
          <a
            href={affiliateHref('booking', bookingTarget, slug)}
            rel={AFFILIATE_REL}
            target="_blank"
            class="btn btn-primary mt-6 w-full"
          >
            Vezi cazări în {name}
          </a>
        )}
      </div>
    </div>
  );
}
