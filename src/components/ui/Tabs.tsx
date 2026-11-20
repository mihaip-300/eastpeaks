/** @jsxImportSource preact */
// Accessible tabs (WAI-ARIA tabs pattern): arrow keys, Home/End, roving tabindex.
// Panels are server-rendered HTML passed in as named slots: <Tabs tabs={[{id:'a',...}]}><div slot="a">…</div></Tabs>
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';

interface Props {
  tabs: { id: string; label: string }[];
  label: string;
  tone?: 'light' | 'dark';
  [slot: string]: unknown;
}

export default function Tabs(props: Props) {
  const { tabs, label, tone = 'light' } = props;
  const [active, setActive] = useState(tabs[0]?.id);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const dark = tone === 'dark';

  function onKey(e: KeyboardEvent, i: number) {
    const last = tabs.length - 1;
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (next == null) return;
    e.preventDefault();
    setActive(tabs[next]!.id);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label={label} class={`flex gap-8 overflow-x-auto border-b ${dark ? 'border-gold/25' : 'border-stone'}`}>
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              onKeyDown={(e) => onKey(e as unknown as KeyboardEvent, i)}
              class={`relative shrink-0 pb-3.5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors ${
                selected ? (dark ? 'text-ivory' : 'text-midnight') : dark ? 'text-mist hover:text-ivory' : 'text-slate hover:text-midnight'
              }`}
            >
              {t.label}
              <span class={`absolute inset-x-0 -bottom-px h-0.5 transition-colors ${selected ? 'bg-alpine-red' : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`panel-${t.id}`} role="tabpanel" aria-labelledby={`tab-${t.id}`} hidden={t.id !== active} tabIndex={0} class="pt-8 focus-visible:outline-offset-4">
          {props[t.id] as ComponentChildren}
        </div>
      ))}
    </div>
  );
}
