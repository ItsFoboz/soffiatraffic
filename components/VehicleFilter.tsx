'use client';

import type { VehicleType } from '@/lib/types';
import { useT } from './TranslationContext';

type FilterOption = 'all' | VehicleType;

interface VehicleFilterProps {
  active: FilterOption;
  onChange: (filter: FilterOption) => void;
  counts: Record<VehicleType, number>;
}

const TYPE_ICONS: Record<FilterOption, string> = {
  all:     '🚏',
  bus:     '🚌',
  tram:    '🚊',
  trolley: '🚎',
  metro:   '🚇',
};

/** Active background per tab type — primary for "all", transport color for each type */
const ACTIVE_BG: Record<FilterOption, string> = {
  all:     'var(--color-primary)',
  bus:     'var(--color-bus)',
  tram:    'var(--color-tram)',
  trolley: 'var(--color-trolley)',
  metro:   'var(--color-metro)',
};

export default function VehicleFilter({ active, onChange, counts }: VehicleFilterProps) {
  const { t } = useT();
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const filters: FilterOption[] = ['all', 'bus', 'tram', 'trolley', 'metro'];

  return (
    /* White card container */
    <div
      className="flex overflow-x-auto no-scrollbar"
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '4px',
        gap: '2px',
      }}
    >
      {filters.map((f) => {
        const isActive = active === f;
        const count = f === 'all' ? total : (counts[f as VehicleType] ?? 0);

        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            style={
              isActive
                ? {
                    background: ACTIVE_BG[f],
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '6px 12px',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'background 150ms ease, color 150ms ease',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--color-text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 12px',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'background 150ms ease, color 150ms ease',
                  }
            }
          >
            <span className="text-sm leading-none">{TYPE_ICONS[f]}</span>
            <span>{t(`filter.${f}`)}</span>
            <span
              className="text-xs rounded-full px-1.5 py-0.5"
              style={{
                background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                fontWeight: 'var(--font-weight-semibold)',
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
