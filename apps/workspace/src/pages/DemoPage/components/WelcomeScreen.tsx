import React from 'react';
import { Upload, Sparkles, Search, Eye, Sliders, ShieldCheck } from 'lucide-react';
import { UiLanguage } from '../../../i18n/uiTranslations';

export interface WelcomeScreenProps {
  onTryDemo?: () => void;
  onUpload?: () => void;
  onSelectDemo?: () => void;
  onOpenUpload?: () => void;
  uiLang?: UiLanguage;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onTryDemo,
  onUpload,
  onSelectDemo,
  onOpenUpload,
  uiLang = 'ru',
}) => {
  const handleUpload = onUpload || onOpenUpload || (() => {});
  const handleTryDemo = onTryDemo || onSelectDemo || (() => {});

  return (
    <div className="page" data-testid="demo-welcome-screen">
      <div className="card p-8 md:p-12 border border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 badge badge-accent mono mb-4">
            <Sparkles size={13} />
            <span>EIDOS v3.4.0 · Hybrid Search & Explainable Ranking Studio</span>
          </div>

          <h1 className="page-title text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            {uiLang === 'ja'
              ? '説明可能なハイブリッド検索エンジン'
              : uiLang === 'en'
              ? 'Hybrid Search with Explainable Ranking'
              : 'Гибридный поиск с объяснимым ранжированием'}
          </h1>

          <p className="text-base md:text-lg text-[var(--text-sec)] max-w-xl mx-auto leading-relaxed mb-7">
            {uiLang === 'ja' ? (
              <>
                なぜこの商品が上位なのかを <strong className="mono text-[var(--success)]">0.5 ms</strong> で可視化。
                セマンティック・語彙一致・ビジネスルールをリアルタイムで制御します。
              </>
            ) : uiLang === 'en' ? (
              <>
                Understand why top items rank #1 in <strong className="mono text-[var(--success)]">0.5 ms</strong>.
                Control semantic vectors, BM25 keywords, and business rules in real time.
              </>
            ) : (
              <>
                Пойми, почему именно эти товары в топе — за <strong className="mono text-[var(--success)]">0.5 мс</strong>.
                Управляй балансом смысла, ключевых слов и бизнес-правил в реальном времени.
              </>
            )}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-8">
            <button
              type="button"
              onClick={handleTryDemo}
              data-testid="welcome-demo-btn"
              className="btn btn-primary px-7 py-3.5 text-sm font-bold w-full sm:w-auto shadow-sm"
            >
              <Sparkles size={16} />
              <span>
                {uiLang === 'ja'
                  ? 'デモカタログで試す (48商品)'
                  : uiLang === 'en'
                  ? 'Try on Demo Catalog (48 items)'
                  : 'Попробовать на демо-каталоге (48 товаров)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleUpload}
              data-testid="welcome-upload-btn"
              className="btn btn-secondary px-6 py-3.5 text-sm w-full sm:w-auto"
            >
              <Upload size={16} />
              <span>
                {uiLang === 'ja'
                  ? 'CSV / JSON をアップロード'
                  : uiLang === 'en'
                  ? 'Upload Own CSV / JSON'
                  : 'Загрузить свой CSV / JSON'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-[var(--border)]">
          <div className="card p-4 bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1">
              <Search size={15} className="text-[var(--accent)]" />
              <span>
                {uiLang === 'ja'
                  ? '1. 検索意図の自動解析'
                  : uiLang === 'en'
                  ? '1. Intent-Aware Parsing'
                  : '1. Умный разбор намерения'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-sec)] leading-relaxed">
              {uiLang === 'ja'
                ? 'クエリからカテゴリ・利用シーン・予算上限を自動抽出し、384次元ベクトルと融合します。'
                : uiLang === 'en'
                ? 'Automatically extracts product category, use-case scenario, and budget constraints from natural queries.'
                : 'Запрос «недорогие наушники для бега» автоматически выделяет категорию, сценарий и бюджет.'}
            </p>
          </div>

          <div className="card p-4 bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1">
              <Eye size={15} className="text-[var(--success)]" />
              <span>
                {uiLang === 'ja'
                  ? '2. 透明な X-Ray (7要素分解)'
                  : uiLang === 'en'
                  ? '2. Transparent X-Ray (7 Factors)'
                  : '2. Прозрачный X-Ray (7 факторов)'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-sec)] leading-relaxed">
              {uiLang === 'ja'
                ? 'Denseベクトル、BM25、RRF、MMR多様性、ビジネスブーストの寄与度を1件ごとに可視化。'
                : uiLang === 'en'
                ? 'Exact mathematical breakdown of every rank position: Dense, BM25, RRF, MMR, and Cognitive Boosts.'
                : 'Точная формула каждого места в выдаче: Семантика, BM25, RRF, MMR, Бизнес-буст и 3 когнитивных вектора.'}
            </p>
          </div>

          <div className="card p-4 bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1">
              <Sliders size={15} className="text-[var(--accent)]" />
              <span>
                {uiLang === 'ja'
                  ? '3. リアルタイム制御 (60 FPS)'
                  : uiLang === 'en'
                  ? '3. Real-Time Control (60 FPS)'
                  : '3. Мгновенный контроль (60 FPS)'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-sec)] leading-relaxed">
              {uiLang === 'ja'
                ? 'Semantic ↔ Lexical比率の調整やMMR/IntentのON/OFFを即座にテストし、設定をコード出力。'
                : uiLang === 'en'
                ? 'Tune Semantic ↔ Lexical alpha, toggle MMR or Intent in 1 click, and export ranking config to code.'
                : 'Переключай вес Semantic ↔ Lexical, отключай MMR или Intent в 1 клик и экспортируй конфиг в код.'}
            </p>
          </div>
        </div>

        <div className="mt-5 px-4 py-2.5 rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-sec)]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--success)]" />
            <span>
              <strong className="text-[var(--text)]">
                {uiLang === 'ja' ? 'マイカタログ (0 SKU):' : uiLang === 'en' ? 'My Catalog (0 SKU):' : 'Мой каталог (0 SKU):'}
              </strong>{' '}
              {uiLang === 'ja'
                ? 'デモデータの混入がないクリーンな本番ワークスペース。'
                : uiLang === 'en'
                ? 'Clean production workspace with zero preloaded demo noise.'
                : 'чистый рабочий контур без предзагруженных демо-данных.'}
            </span>
          </div>
          <span className="mono">EIDOS v3.4.0 · .csv / .json / REST API</span>
        </div>
      </div>
    </div>
  );
};

