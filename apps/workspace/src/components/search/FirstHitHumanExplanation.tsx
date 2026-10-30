import React, { useState } from 'react';
import { Copy, Check, Info } from 'lucide-react';
import { HybridSearchHit } from '../../utils/recommenderEngine';
import { UiLanguage } from '../../i18n/uiTranslations';

export interface FirstHitHumanExplanationProps {
  hit: HybridSearchHit;
  alpha: number;
  uiLang?: UiLanguage;
}

export function buildHumanReadableExplanation(
  hit: HybridSearchHit,
  alpha: number,
  uiLang: UiLanguage = 'ru'
): string {
  const densePct = Math.round((hit.denseScore || 0) * 100);
  const bm25Pct = Math.round((hit.bm25Score || 0) * 100);
  const fusedPct = ((hit.fusedScore || 0) * 100).toFixed(1);
  const rrfPermille = (((hit.rrfScore ?? hit.fusedScore * 0.016) || 0) * 1000).toFixed(2);
  const tokens =
    hit.matchedTokens && hit.matchedTokens.length > 0
      ? hit.matchedTokens.slice(0, 4).join(', ')
      : null;

  if (uiLang === 'en') {
    const primaryDriver =
      densePct >= bm25Pct
        ? `strong semantic meaning match (Dense 384-d: ${densePct}%)`
        : `exact keyword overlap (BM25: ${bm25Pct}%)`;
    const secondaryDriver =
      tokens && bm25Pct > 0
        ? ` reinforced by matched terms (${tokens}, BM25: ${bm25Pct}%)`
        : densePct > 0 && bm25Pct > 0
          ? ` combined with lexical score (${bm25Pct}%)`
          : '';
    return `Ranked #1 (Fused ${fusedPct}%, RRF ${rrfPermille}‰ at α=${alpha.toFixed(2)}) due to ${primaryDriver}${secondaryDriver}.`;
  }

  const primaryDriverRu =
    densePct >= bm25Pct
      ? `высокой семантической близости смысла (Dense 384-d: ${densePct}%)`
      : `точному совпадению ключевых слов (BM25: ${bm25Pct}%)`;
  const secondaryDriverRu =
    tokens && bm25Pct > 0
      ? ` и совпадению токенов запроса (${tokens}, BM25: ${bm25Pct}%)`
      : densePct > 0 && bm25Pct > 0
        ? ` в сочетании с лексическим весом (${bm25Pct}%)`
        : '';

  return `Товар на #1 месте (Итоговый балл ${fusedPct}%, RRF ${rrfPermille}‰ при α=${alpha.toFixed(2)}) благодаря ${primaryDriverRu}${secondaryDriverRu}.`;
}

export const FirstHitHumanExplanation: React.FC<FirstHitHumanExplanationProps> = ({
  hit,
  alpha,
  uiLang = 'ru',
}) => {
  const [copied, setCopied] = useState(false);
  const isRu = uiLang === 'ru';
  const explanationText = buildHumanReadableExplanation(hit, alpha, uiLang);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(explanationText).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      data-testid="first-hit-human-explanation"
      className="px-3 py-2 mb-2.5 rounded-md bg-[var(--surface)] border border-[var(--accent)]/40 flex flex-wrap items-center justify-between gap-2 text-xs"
    >
      <div className="flex items-start gap-2 flex-1 min-w-[220px]">
        <Info size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
        <span className="text-[var(--text)] leading-snug">{explanationText}</span>
      </div>
      <button
        type="button"
        data-testid="copy-first-hit-explanation"
        onClick={handleCopy}
        className="btn btn-secondary btn-sm shrink-0"
      >
        {copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
        <span>
          {copied
            ? isRu
              ? 'Скопировано'
              : 'Copied'
            : isRu
              ? 'Скопировать объяснение'
              : 'Copy explanation'}
        </span>
      </button>
    </div>
  );
};
