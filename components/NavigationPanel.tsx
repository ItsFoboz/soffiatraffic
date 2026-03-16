'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { NavStep, TransitRouteResult, VehicleType } from '@/lib/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<VehicleType, string> = {
  bus: '🚌', tram: '🚊', trolley: '🚎', metro: '🚇',
};
const TYPE_LABELS: Record<VehicleType, string> = {
  bus: 'Bus', tram: 'Tram', trolley: 'Trolley', metro: 'Metro',
};

/** Auto-advance radius (metres) varies by step type */
const ADVANCE_RADIUS: Record<NavStep['type'], number> = {
  walk:     45,
  transit: 100,  // vehicles stop imprecisely, need extra slack
  transfer: 45,
  arrive:   30,
};

// ─── Maths helpers ───────────────────────────────────────────────────────────

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** True bearing (0 = North, 90 = East) from A to B */
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function cardinalDir(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function fmtDist(m: number): string {
  if (m < 15)   return 'here';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function stepIcon(step: NavStep): string {
  if (step.type === 'walk')     return '🚶';
  if (step.type === 'transfer') return '🔄';
  if (step.type === 'arrive')   return '📍';
  if (step.vehicleType)         return TYPE_ICONS[step.vehicleType];
  return '🚌';
}

// ─── buildNavSteps (exported for reuse) ─────────────────────────────────────

export function buildNavSteps(route: TransitRouteResult, destLat: number, destLng: number): NavStep[] {
  const steps: NavStep[] = [];

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

  if (route.isTransfer && route.line2 && route.type2 && route.boardStop2 && route.alightStop2) {
    const walkDist = route.transferWalk ?? 0;
    if (walkDist > 50) {
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

  steps.push({ type: 'arrive', instruction: 'You have arrived!', targetLat: destLat, targetLng: destLng });

  return steps;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface NavigationPanelProps {
  route: TransitRouteResult;
  destName: string;
  destLat: number;
  destLng: number;
  onEnd: () => void;
  /** Called on every GPS fix — MapTab uses this to update the user marker */
  onGpsUpdate?: (lat: number, lng: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NavigationPanel({
  route, destName, destLat, destLng, onEnd, onGpsUpdate,
}: NavigationPanelProps) {
  const [steps]                   = useState<NavStep[]>(() => buildNavSteps(route, destLat, destLng));
  const [stepIdx, setStepIdx]     = useState(0);
  // GPS state
  const [userPos, setUserPos]     = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy]   = useState<number | null>(null);
  const [speed, setSpeed]         = useState<number | null>(null);   // m/s
  const [gpsReady, setGpsReady]   = useState(false);
  // Navigation metrics
  const [distToNext, setDistToNext]   = useState<number | null>(null);
  const [bearingToTgt, setBearing]    = useState<number | null>(null);

  const currentStep = steps[stepIdx];
  const nextStep    = steps[stepIdx + 1] ?? null;
  const isLastStep  = stepIdx === steps.length - 1;

  // ── Dynamic ETA (uses actual GPS speed when walking) ───────────────────────
  const remainingMin = useMemo(() => {
    const walkSpeedMs = (speed && speed > 0.3 && speed < 4) ? speed : 1.1; // default 1.1 m/s
    return steps.slice(stepIdx).reduce((acc, s) => {
      if (s.type === 'walk'    && s.distanceM)  return acc + Math.max(1, Math.ceil(s.distanceM / walkSpeedMs / 60));
      if (s.type === 'transit' && s.numStops)   return acc + s.numStops * 2;
      if (s.type === 'transfer')                return acc + 2;
      return acc;
    }, 0);
  }, [steps, stepIdx, speed]);

  // ── Off-route: walk steps only ─────────────────────────────────────────────
  const isOffRoute = useMemo(() => {
    if (currentStep.type !== 'walk' || distToNext === null || !currentStep.distanceM) return false;
    // Off-route if user is much farther from target than the expected walk distance
    return distToNext > 300 && distToNext > currentStep.distanceM * 1.8;
  }, [currentStep, distToNext]);

  // ── GPS status ─────────────────────────────────────────────────────────────
  type GpsStatus = 'searching' | 'good' | 'ok' | 'weak';
  const gpsStatus: GpsStatus = !gpsReady
    ? 'searching'
    : accuracy === null ? 'ok'
    : accuracy <= 20 ? 'good'
    : accuracy <= 60 ? 'ok'
    : 'weak';

  const GPS_CONFIG: Record<GpsStatus, { color: string; label: string; dot: string }> = {
    searching: { color: 'var(--color-text-muted)', label: 'Searching…',  dot: '◌' },
    good:      { color: 'var(--color-live)',        label: `±${Math.round(accuracy ?? 0)}m`, dot: '●' },
    ok:        { color: 'var(--color-warning)',     label: `±${Math.round(accuracy ?? 0)}m`, dot: '◉' },
    weak:      { color: 'var(--color-error)',       label: `±${Math.round(accuracy ?? 0)}m`, dot: '○' },
  };
  const gpsCfg = GPS_CONFIG[gpsStatus];

  // ── Keep onGpsUpdate ref stable ────────────────────────────────────────────
  const onGpsUpdateRef = useRef(onGpsUpdate);
  useEffect(() => { onGpsUpdateRef.current = onGpsUpdate; }, [onGpsUpdate]);

  // ── GPS watchPosition ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsReady(true); return; }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc, speed: spd } = pos.coords;
        setUserPos([latitude, longitude]);
        setAccuracy(acc ?? null);
        setSpeed(spd ?? null);
        setGpsReady(true);
        onGpsUpdateRef.current?.(latitude, longitude);
      },
      (err) => {
        console.warn('GPS:', err.code, err.message);
        setGpsReady(true);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Auto-advance on proximity ──────────────────────────────────────────────
  const advance = useCallback(() => {
    setStepIdx((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  useEffect(() => {
    if (!userPos || !currentStep.targetLat || !currentStep.targetLng) return;
    const d = distM(userPos[0], userPos[1], currentStep.targetLat, currentStep.targetLng);
    const b = bearingDeg(userPos[0], userPos[1], currentStep.targetLat, currentStep.targetLng);
    setDistToNext(d);
    setBearing(b);
    if (d < ADVANCE_RADIUS[currentStep.type] && !isLastStep) advance();
  }, [userPos, currentStep, isLastStep, advance]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const stepBg = (type: NavStep['type']) => {
    if (type === 'arrive')   return '#dcfce7';
    if (type === 'walk')     return '#dbeafe';
    if (type === 'transfer') return '#ffedd5';
    return 'var(--color-primary)';
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto">
      <div style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
        borderTop: '1px solid var(--color-border)',
      }}>

        {/* ── Top bar: End · Destination · ETA + GPS ──────────────────────── */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2"
          style={{ borderBottom: '1px solid var(--color-border)' }}>
          <button
            onClick={onEnd}
            className="flex items-center gap-1 flex-shrink-0"
            style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            End
          </button>

          <div className="flex-1 min-w-0 text-center">
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Navigating to</p>
            <p className="truncate font-bold" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
              {destName}
            </p>
          </div>

          <div className="text-right flex-shrink-0">
            <p className="font-bold" style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
              ~{remainingMin} min
            </p>
            <p className="flex items-center justify-end gap-1"
               style={{ fontSize: 'var(--font-size-xs)', color: gpsCfg.color }}>
              <span>{gpsCfg.dot}</span>
              <span>{accuracy !== null ? gpsCfg.label : gpsStatus === 'searching' ? 'GPS…' : 'GPS'}</span>
            </p>
          </div>
        </div>

        {/* ── Current step instruction ─────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            {/* Icon bubble */}
            <div className="flex items-center justify-center text-2xl flex-shrink-0"
              style={{ width: '52px', height: '52px', borderRadius: 'var(--radius-lg)', background: stepBg(currentStep.type) }}>
              {stepIcon(currentStep)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold leading-snug"
                 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-primary)' }}>
                {currentStep.instruction}
              </p>

              {/* Walk: live distance + compass arrow */}
              {currentStep.type === 'walk' && distToNext !== null && !isLastStep && (
                <div className="flex items-center gap-2 mt-1">
                  {bearingToTgt !== null && (
                    <span
                      style={{
                        display: 'inline-block',
                        transform: `rotate(${bearingToTgt}deg)`,
                        fontSize: '20px',
                        lineHeight: 1,
                        color: isOffRoute ? 'var(--color-error)' : 'var(--color-primary)',
                        transition: 'transform 300ms ease',
                      }}
                    >↑</span>
                  )}
                  <p className="font-semibold" style={{
                    fontSize: 'var(--font-size-base)',
                    color: isOffRoute ? 'var(--color-error)' : 'var(--color-primary)',
                  }}>
                    {fmtDist(distToNext)}
                    {bearingToTgt !== null && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 400, marginLeft: '6px' }}>
                        heading {cardinalDir(bearingToTgt)}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Transit: distance to alight stop */}
              {currentStep.type === 'transit' && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {distToNext !== null
                    ? <>Alight in <strong>{fmtDist(distToNext)}</strong></>
                    : currentStep.detail}
                </p>
              )}

              {/* Transfer / arrive */}
              {(currentStep.type === 'transfer' || currentStep.type === 'arrive') && currentStep.detail && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  {currentStep.detail}
                </p>
              )}
            </div>
          </div>

          {/* Off-route warning */}
          {isOffRoute && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
              <span className="text-base">⚠️</span>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', fontWeight: 'var(--font-weight-medium)' }}>
                You appear to be off route.
                {bearingToTgt !== null && <> Head {cardinalDir(bearingToTgt)} toward the waypoint.</>}
              </p>
            </div>
          )}

          {/* Progress dots */}
          <div className="flex items-center gap-1 mt-3 justify-center">
            {steps.map((_, i) => (
              <div key={i} className="rounded-full" style={{
                width:      i === stepIdx ? '16px' : '8px',
                height:     '8px',
                background: i === stepIdx ? 'var(--color-primary)'
                          : i < stepIdx  ? 'var(--color-live)'
                          : 'var(--color-border)',
                transition: 'all 200ms ease',
              }} />
            ))}
          </div>
        </div>

        {/* ── Next step preview ────────────────────────────────────────────── */}
        {nextStep && !isLastStep && (
          <div className="mx-4 mb-3 px-3 py-2.5 flex items-center gap-2.5 rounded-xl"
            style={{ background: 'var(--color-bg)' }}>
            <span className="text-base flex-shrink-0">{stepIcon(nextStep)}</span>
            <div className="min-w-0">
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-weight-medium)' }}>Next</p>
              <p className="font-semibold truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                {nextStep.instruction}
              </p>
              {nextStep.detail && (
                <p className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {nextStep.detail}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Manual advance (GPS fallback) ────────────────────────────────── */}
        {!isLastStep && (
          <div className="px-4 pb-3">
            <button
              onClick={advance}
              className="w-full py-2 rounded-xl"
              style={{
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-secondary)',
                background: 'var(--color-surface)',
              }}
            >
              Mark step as done →
            </button>
          </div>
        )}

        {/* ── All steps collapsible ────────────────────────────────────────── */}
        <AllStepsList steps={steps} currentIdx={stepIdx} onJump={setStepIdx} />
      </div>
    </div>
  );
}

// ─── Collapsible full step list ──────────────────────────────────────────────

function AllStepsList({
  steps, currentIdx, onJump,
}: { steps: NavStep[]; currentIdx: number; onJump: (i: number) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderTop: '1px solid var(--color-border)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between"
        style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-semibold)' }}
      >
        <span>All steps ({steps.length})</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="max-h-52 overflow-y-auto px-4 pb-4 space-y-1">
          {steps.map((step, i) => (
            <button
              key={i}
              onClick={() => onJump(i)}
              className="w-full text-left flex items-start gap-2.5 px-2 py-2 rounded-lg"
              style={{
                background: i === currentIdx ? '#eff6ff' : 'transparent',
                border:     i === currentIdx ? '1px solid #bfdbfe' : '1px solid transparent',
                opacity:    i < currentIdx ? 0.5 : 1,
              }}
            >
              <span className="text-base flex-shrink-0 mt-0.5">{stepIcon(step)}</span>
              <div className="min-w-0 flex-1">
                <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                  {step.instruction}
                </p>
                {step.detail && (
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{step.detail}</p>
                )}
              </div>
              {i < currentIdx && (
                <span style={{ color: 'var(--color-live)', fontSize: 'var(--font-size-xs)' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
