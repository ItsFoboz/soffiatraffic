'use client';

import { useState, useEffect, useCallback } from 'react';
import type { NavStep, TransitRouteResult, VehicleType } from '@/lib/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<VehicleType, string> = {
  bus: '🚌', tram: '🚊', trolley: '🚎', metro: '🚇',
};

const TYPE_LABELS: Record<VehicleType, string> = {
  bus: 'Bus', tram: 'Tram', trolley: 'Trolley', metro: 'Metro',
};

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function stepIcon(step: NavStep): string {
  if (step.type === 'walk')     return '🚶';
  if (step.type === 'transfer') return '🔄';
  if (step.type === 'arrive')   return '📍';
  if (step.vehicleType)         return TYPE_ICONS[step.vehicleType];
  return '🚌';
}

export function buildNavSteps(route: TransitRouteResult, destLat: number, destLng: number): NavStep[] {
  const steps: NavStep[] = [];

  // 1. Walk to first boarding stop
  if (route.walkToStop > 20) {
    steps.push({
      type: 'walk',
      instruction: `Walk to ${route.boardStop.name}`,
      detail: `${fmtDist(route.walkToStop)} · ~${Math.max(1, Math.round(route.walkToStop / 80))} min`,
      distanceM: route.walkToStop,
      targetLat: route.boardStop.lat,
      targetLng: route.boardStop.lng,
    });
  }

  // 2. First transit leg
  steps.push({
    type: 'transit',
    instruction: `Take ${route.type ? TYPE_LABELS[route.type] : ''} ${route.line}`,
    detail: `${route.numStops} stop${route.numStops !== 1 ? 's' : ''} → ${route.alightStop.name}`,
    line: route.line,
    vehicleType: route.type,
    numStops: route.numStops,
    targetLat: route.alightStop.lat,
    targetLng: route.alightStop.lng,
  });

  // 3. Transfer + second leg (if applicable)
  if (route.isTransfer && route.line2 && route.type2 && route.boardStop2 && route.alightStop2) {
    const walkDist = route.transferWalk ?? 0;
    if (walkDist > 50 && route.boardStop2) {
      steps.push({
        type: 'walk',
        instruction: `Walk to ${route.boardStop2.name}`,
        detail: `${fmtDist(walkDist)} transfer walk`,
        distanceM: walkDist,
        targetLat: route.boardStop2.lat,
        targetLng: route.boardStop2.lng,
      });
    } else {
      steps.push({
        type: 'transfer',
        instruction: `Transfer at ${route.transferStop?.name ?? route.alightStop.name}`,
        detail: `Change to ${TYPE_LABELS[route.type2]} ${route.line2}`,
        targetLat: route.alightStop.lat,
        targetLng: route.alightStop.lng,
      });
    }

    steps.push({
      type: 'transit',
      instruction: `Take ${TYPE_LABELS[route.type2]} ${route.line2}`,
      detail: `${route.numStops2 ?? 0} stop${route.numStops2 !== 1 ? 's' : ''} → ${route.alightStop2.name}`,
      line: route.line2,
      vehicleType: route.type2,
      numStops: route.numStops2,
      targetLat: route.alightStop2.lat,
      targetLng: route.alightStop2.lng,
    });
  }

  // 4. Walk to destination
  if (route.walkFromStop > 20) {
    steps.push({
      type: 'walk',
      instruction: 'Walk to destination',
      detail: `${fmtDist(route.walkFromStop)} · ~${Math.max(1, Math.round(route.walkFromStop / 80))} min`,
      distanceM: route.walkFromStop,
      targetLat: destLat,
      targetLng: destLng,
    });
  }

  // 5. Arrive
  steps.push({
    type: 'arrive',
    instruction: 'You have arrived!',
    targetLat: destLat,
    targetLng: destLng,
  });

  return steps;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface NavigationPanelProps {
  route: TransitRouteResult;
  destName: string;
  destLat: number;
  destLng: number;
  onEnd: () => void;
}

const ADVANCE_RADIUS = 60; // metres — auto-advance when this close to waypoint

export default function NavigationPanel({ route, destName, destLat, destLng, onEnd }: NavigationPanelProps) {
  const [steps] = useState<NavStep[]>(() => buildNavSteps(route, destLat, destLng));
  const [stepIdx, setStepIdx] = useState(0);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [distToNext, setDistToNext] = useState<number | null>(null);

  const currentStep = steps[stepIdx];
  const nextStep    = steps[stepIdx + 1] ?? null;
  const isLastStep  = stepIdx === steps.length - 1;

  // Remaining duration estimate
  const remainingSteps = steps.slice(stepIdx);
  const remainingMin = remainingSteps.reduce((acc, s) => {
    if (s.type === 'walk' && s.distanceM)  return acc + Math.max(1, Math.round(s.distanceM / 80));
    if (s.type === 'transit' && s.numStops) return acc + s.numStops * 2;
    if (s.type === 'transfer')              return acc + 2;
    return acc;
  }, 0);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Auto-advance based on proximity
  const advance = useCallback(() => {
    setStepIdx((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  useEffect(() => {
    if (!userPos || !currentStep.targetLat || !currentStep.targetLng) return;
    const d = distM(userPos[0], userPos[1], currentStep.targetLat, currentStep.targetLng);
    setDistToNext(d);
    if (d < ADVANCE_RADIUS && !isLastStep) advance();
  }, [userPos, currentStep, isLastStep, advance]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto">
      {/* Backdrop blur strip */}
      <div className="bg-white/95 backdrop-blur-md shadow-2xl rounded-t-2xl border-t border-gray-200">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
          <button
            onClick={onEnd}
            className="flex items-center gap-1.5 text-sm text-red-600 font-semibold hover:text-red-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            End
          </button>
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium">Navigating to</p>
            <p className="text-xs font-bold text-gray-800 truncate max-w-[180px]">{destName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">~{remainingMin} min</p>
            <p className="text-xs text-gray-400">left</p>
          </div>
        </div>

        {/* Current step — big */}
        <div className="px-4 py-4">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
              currentStep.type === 'arrive'   ? 'bg-green-100' :
              currentStep.type === 'walk'     ? 'bg-blue-100'  :
              currentStep.type === 'transfer' ? 'bg-orange-100' :
              'bg-blue-600'
            }`}>
              {stepIcon(currentStep)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-gray-900 leading-snug">{currentStep.instruction}</p>
              {currentStep.detail && <p className="text-sm text-gray-500 mt-0.5">{currentStep.detail}</p>}
              {distToNext !== null && !isLastStep && currentStep.type !== 'arrive' && (
                <p className="text-sm font-semibold text-blue-600 mt-1">{fmtDist(distToNext)} away</p>
              )}
            </div>
          </div>

          {/* Step progress dots */}
          <div className="flex items-center gap-1 mt-3 justify-center">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all ${
                  i === stepIdx ? 'w-4 h-2 bg-blue-600' :
                  i < stepIdx  ? 'w-2 h-2 bg-blue-300' :
                  'w-2 h-2 bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Next step preview */}
        {nextStep && !isLastStep && (
          <div className="mx-4 mb-4 px-3 py-2.5 bg-gray-50 rounded-xl flex items-center gap-2.5">
            <span className="text-base flex-shrink-0">{stepIcon(nextStep)}</span>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">Next</p>
              <p className="text-sm font-semibold text-gray-700 truncate">{nextStep.instruction}</p>
              {nextStep.detail && <p className="text-xs text-gray-500 truncate">{nextStep.detail}</p>}
            </div>
          </div>
        )}

        {/* Manual advance (in case GPS is off) */}
        {!isLastStep && (
          <div className="px-4 pb-4">
            <button
              onClick={advance}
              className="w-full py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              Mark as done →
            </button>
          </div>
        )}

        {/* Full step list (collapsed by default) */}
        <AllStepsList steps={steps} currentIdx={stepIdx} onJump={setStepIdx} />
      </div>
    </div>
  );
}

function AllStepsList({ steps, currentIdx, onJump }: { steps: NavStep[]; currentIdx: number; onJump: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-blue-600 font-semibold hover:bg-gray-50 transition-colors"
      >
        <span>All steps ({steps.length})</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto px-4 pb-4 space-y-1">
          {steps.map((step, i) => (
            <button
              key={i}
              onClick={() => onJump(i)}
              className={`w-full text-left flex items-start gap-2.5 px-2 py-2 rounded-lg transition-colors ${
                i === currentIdx ? 'bg-blue-50 border border-blue-200' :
                i < currentIdx  ? 'opacity-50' : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-base flex-shrink-0 mt-0.5">{stepIcon(step)}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800">{step.instruction}</p>
                {step.detail && <p className="text-xs text-gray-500">{step.detail}</p>}
              </div>
              {i < currentIdx && <span className="ml-auto text-green-500 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
