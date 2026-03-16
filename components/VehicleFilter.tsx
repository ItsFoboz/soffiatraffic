'use client';

import type { VehicleType } from '@/lib/types';
import { useT } from './TranslationContext';

type FilterOption = 'all' | VehicleType;

interface VehicleFilterProps {
  active: FilterOption;
  onChange: (filter: FilterOption) => void;
  counts: Record<VehicleType, number>;
}

const FILTER_COLORS: Record<FilterOption, string> = {
  all: 'bg-gray-800 text-white',
  bus: 'bg-blue-600 text-white',
  tram: 'bg-red-600 text-white',
  trolley: 'bg-green-600 text-white',
  metro: 'bg-purple-600 text-white',
};

const FILTER_INACTIVE: Record<FilterOption, string> = {
  all: 'bg-gray-100 text-gray-700',
  bus: 'bg-blue-50 text-blue-700',
  tram: 'bg-red-50 text-red-700',
  trolley: 'bg-green-50 text-green-700',
  metro: 'bg-purple-50 text-purple-700',
};

export default function VehicleFilter({ active, onChange, counts }: VehicleFilterProps) {
  const { t } = useT();
  const total = Object.values(counts).reduce((s, v) => s + v, 0);

  const filters: FilterOption[] = ['all', 'bus', 'tram', 'trolley', 'metro'];

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {filters.map((f) => {
        const isActive = active === f;
        const count = f === 'all' ? total : (counts[f as VehicleType] ?? 0);
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              isActive ? FILTER_COLORS[f] : FILTER_INACTIVE[f]
            }`}
          >
            <span>{t(`filter.${f}`)}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-black/10'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
