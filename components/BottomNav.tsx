'use client';

import { useT } from './TranslationContext';

type Tab = 'map' | 'routes' | 'stops' | 'favorites';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { t } = useT();

  const tabs: { id: Tab; icon: string; labelKey: string }[] = [
    { id: 'map', icon: '🗺️', labelKey: 'nav.map' },
    { id: 'routes', icon: '🔀', labelKey: 'nav.routes' },
    { id: 'stops', icon: '🚏', labelKey: 'nav.stops' },
    { id: 'favorites', icon: '⭐', labelKey: 'nav.favorites' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb">
      <div className="flex items-stretch h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span className="text-[10px] font-medium">{t(tab.labelKey)}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 w-8 h-0.5 bg-blue-600 rounded-t" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
