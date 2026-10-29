import React, { useRef, useState, useCallback } from 'react';
import { Compass, Sparkles, RotateCcw, Crosshair } from 'lucide-react';
import { IntentRadarCoordinates } from '@eidos/core';
import { UiLanguage } from '../../i18n/uiTranslations';

interface IntentVectorSynthesizerProps {
  coordinates: IntentRadarCoordinates;
  onChangeCoordinates: (coords: IntentRadarCoordinates) => void;
  serendipityActiveCount: number;
  effectiveAlpha: number;
  uiLang?: UiLanguage;
}

export const IntentVectorSynthesizer: React.FC<IntentVectorSynthesizerProps> = ({
  coordinates,
  onChangeCoordinates,
  serendipityActiveCount,
  effectiveAlpha,
  uiLang = 'ru',
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isRu = uiLang === 'ru';

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const relX = (clientX - rect.left) / Math.max(1, rect.width);
      const relY = (clientY - rect.top) / Math.max(1, rect.height);
      const axisDiscovery = Math.round(Math.max(-1, Math.min(1, relX * 2 - 1)) * 100) / 100;
      // Invert Y so top is +1.0 (Flagship) and bottom is -1.0 (Pragmatic)
      const axisTier = Math.round(Math.max(-1, Math.min(1, 1 - relY * 2)) * 100) / 100;
      onChangeCoordinates({ axisDiscovery, axisTier });
    },
    [onChangeCoordinates]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
    }
  };

  const cursorLeftPct = ((coordinates.axisDiscovery + 1) / 2) * 100;
  const cursorTopPct = ((1 - coordinates.axisTier) / 2) * 100;
  const orthoBlendPct = Math.round(Math.max(0, coordinates.axisDiscovery) * 42);

  const presets: Array<{ label: string; coords: IntentRadarCoordinates }> = isRu
    ? [
        { label: 'Снайпер (-0.6, 0.0)', coords: { axisDiscovery: -0.6, axisTier: 0 } },
        { label: 'Баланс (0.0, 0.0)', coords: { axisDiscovery: 0, axisTier: 0 } },
        { label: 'Анти-Эхо-Камера (+0.75, +0.2)', coords: { axisDiscovery: 0.75, axisTier: 0.2 } },
        { label: 'Прагматичный инсайт (+0.5, -0.65)', coords: { axisDiscovery: 0.5, axisTier: -0.65 } },
        { label: 'Флагманский максимум (+0.3, +0.8)', coords: { axisDiscovery: 0.3, axisTier: 0.8 } },
      ]
    : [
        { label: 'Sniper (-0.6, 0.0)', coords: { axisDiscovery: -0.6, axisTier: 0 } },
        { label: 'Center (0.0, 0.0)', coords: { axisDiscovery: 0, axisTier: 0 } },
        { label: 'Serendipity Ray (+0.75, +0.2)', coords: { axisDiscovery: 0.75, axisTier: 0.2 } },
        { label: 'Value Insight (+0.5, -0.65)', coords: { axisDiscovery: 0.5, axisTier: -0.65 } },
        { label: 'Flagship Peak (+0.3, +0.8)', coords: { axisDiscovery: 0.3, axisTier: 0.8 } },
      ];

  return (
    <div
      className="card p-4 border border-[var(--border)] bg-[var(--bg-alt)]"
      data-testid="intent-vector-synthesizer"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Compass size={16} className="text-[var(--accent)]" />
          <div>
            <div className="text-sm font-bold text-[var(--text)]">
              {isRu
                ? '2D-Радар: Векторный синтезатор намерения'
                : '2D Intent Vector Synthesizer'}
            </div>
            <div className="text-[0.6875rem] text-[var(--text-sec)]">
              {isRu
                ? 'Управление ортогональной проекцией Грама–Шмидта и смысловыми полюсами выдачи в реальном времени'
                : 'Real-time Gram-Schmidt orthogonal steering across discovery & utility poles'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="badge badge-accent mono text-[0.6875rem]">
            X:{coordinates.axisDiscovery >= 0 ? `+${coordinates.axisDiscovery.toFixed(2)}` : coordinates.axisDiscovery.toFixed(2)}{' '}
            · Y:{coordinates.axisTier >= 0 ? `+${coordinates.axisTier.toFixed(2)}` : coordinates.axisTier.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => onChangeCoordinates({ axisDiscovery: 0, axisTier: 0 })}
            className="btn btn-secondary btn-sm"
            title={isRu ? 'Сбросить радар в центр' : 'Reset radar'}
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] gap-4 items-center">
        {/* Interactive 2D Coordinate Pad */}
        <div
          ref={padRef}
          data-testid="intent-radar-pad"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-full h-[168px] rounded-lg border border-[var(--border)] bg-[var(--bg)] select-none cursor-crosshair overflow-hidden touch-none"
        >
          {/* Crosshair axes */}
          <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--border)]" />
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--border)]" />

          {/* Concentric radar rings */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-dashed border-[var(--border)] pointer-events-none" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 rounded-full border border-dashed border-[var(--border)] opacity-60 pointer-events-none" />

          {/* Pole labels */}
          <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[0.625rem] font-semibold text-[var(--text-sec)] pointer-events-none">
            {isRu ? '▲ Флагман / Глубина' : '▲ Flagship Spec'}
          </span>
          <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[0.625rem] font-semibold text-[var(--text-sec)] pointer-events-none">
            {isRu ? '▼ Прагматизм / Цена' : '▼ Value Utility'}
          </span>
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[0.625rem] font-semibold text-[var(--text-sec)] pointer-events-none">
            {isRu ? '◄ Снайпер' : '◄ Sniper'}
          </span>
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[0.625rem] font-semibold text-[var(--accent)] pointer-events-none">
            {isRu ? 'Serendipity ►' : 'Discovery ►'}
          </span>

          {/* Active Vector Target Node */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--accent)] border-2 border-white shadow-md flex items-center justify-center pointer-events-none transition-transform duration-75"
            style={{
              left: `${cursorLeftPct}%`,
              top: `${cursorTopPct}%`,
            }}
          >
            <Crosshair size={10} className="text-white" />
          </div>
        </div>

        {/* Telemetry & Pole Presets */}
        <div className="flex flex-col justify-between gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-md bg-[var(--bg)] border border-[var(--border)]">
              <div className="text-[0.6875rem] text-[var(--text-sec)]">
                {isRu ? 'Ортогональный сдвиг' : 'Orthogonal Blend'}
              </div>
              <div className="mono text-sm font-bold text-[var(--accent)] mt-0.5">
                {orthoBlendPct}% ⊥
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-[var(--bg)] border border-[var(--border)]">
              <div className="text-[0.6875rem] text-[var(--text-sec)]">
                {isRu ? 'Эффективный α' : 'Effective α'}
              </div>
              <div className="mono text-sm font-bold text-[var(--success)] mt-0.5">
                {effectiveAlpha.toFixed(2)}
              </div>
            </div>

            <div className="p-2.5 rounded-md bg-[var(--bg)] border border-[var(--border)]">
              <div className="text-[0.6875rem] text-[var(--text-sec)]">
                {isRu ? 'Точки открытий' : 'Serendipity Hits'}
              </div>
              <div className="mono text-sm font-bold text-[var(--text)] mt-0.5 flex items-center gap-1">
                <Sparkles size={12} className="text-[var(--accent)]" />
                <span>{serendipityActiveCount}</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-[var(--text-sec)] leading-relaxed">
            {coordinates.axisDiscovery > 0.25
              ? isRu
                ? `Активирован луч «Анти-Эхо-Камеры»: из вектора запроса вычитается проекция доминирующего кластера (${orthoBlendPct}%), открывая скрытые межкластерные товары.`
                : `Anti-Echo-Chamber ray active: subtracting ${orthoBlendPct}% dominant cluster projection to surface cross-category insights.`
              : coordinates.axisDiscovery < -0.25
              ? isRu
                ? 'Режим «Консервативный снайпер»: подавление периферийных кластеров и жёсткая фиксация на ядре запроса.'
                : 'Conservative Sniper mode: suppressing peripheral clusters for strict core precision.'
              : isRu
              ? 'Переместите прицел на 2D-радаре или выберите готовый векторный полюс ниже:'
              : 'Drag the target on the 2D radar or select a vector pole preset below:'}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => {
              const isSelected =
                Math.abs(coordinates.axisDiscovery - p.coords.axisDiscovery) < 0.08 &&
                Math.abs(coordinates.axisTier - p.coords.axisTier) < 0.08;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChangeCoordinates(p.coords)}
                  className={isSelected ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
