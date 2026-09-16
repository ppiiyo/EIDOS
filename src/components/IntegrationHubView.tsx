import React, { useState, useMemo } from 'react';
import {
  Code,
  Terminal,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  Play,
  Sliders,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  Layers,
  Cpu,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Box,
  Eye,
  Settings2,
} from 'lucide-react';
import { CatalogItem } from '../types';
import { LaunchKitSection } from './LaunchKitSection';

interface IntegrationHubViewProps {
  catalog: CatalogItem[];
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type PlatformTab = 'shopify' | 'woocommerce' | 'bitrix' | 'react' | 'js_widget' | 'nodejs' | 'python' | 'curl';
type StrategyType = 'similar' | 'cross_category' | 'cold_start' | 'search';

export const IntegrationHubView: React.FC<IntegrationHubViewProps> = ({
  catalog,
  onShowToast,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformTab>('shopify');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Wizard State
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [feedType, setFeedType] = useState<'json' | 'yml' | 'csv' | 'rest'>('yml');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('similar');
  const [widgetTheme, setWidgetTheme] = useState<'dark' | 'light' | 'midnight'>('dark');
  const [showSimilarityBadge, setShowSimilarityBadge] = useState<boolean>(true);
  const [showReasonTag, setShowReasonTag] = useState<boolean>(true);
  const [widgetLimit, setWidgetLimit] = useState<number>(4);

  // API Console State
  const [consoleEndpoint, setConsoleEndpoint] = useState<'recommend' | 'search' | 'upsert'>('recommend');
  const [consoleItemId, setConsoleItemId] = useState<number>(catalog[0]?.id || 1);
  const [consoleQuery, setConsoleQuery] = useState<string>('симуляция будущего и киберпанк');
  const [consoleLoading, setConsoleLoading] = useState<boolean>(false);
  const [consoleResponse, setConsoleResponse] = useState<any>(null);

  // ROI Calculator State
  const [monthlyVisitors, setMonthlyVisitors] = useState<number>(100000);
  const [avgOrderValue, setAvgOrderValue] = useState<number>(3500);
  const [currentConversion, setCurrentConversion] = useState<number>(1.8);

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    onShowToast('Код скопирован в буфер', 'success');
    setTimeout(() => setCopiedSection(null), 2500);
  };

  // Run live API simulation in console
  const runApiConsole = () => {
    setConsoleLoading(true);
    setTimeout(() => {
      const start = performance.now();
      let res: any = {};

      if (consoleEndpoint === 'recommend') {
        const source = catalog.find((c) => c.id === consoleItemId) || catalog[0];
        const others = catalog.filter((c) => c.id !== source.id);
        const recs = others
          .map((item) => {
            const currentTags = source.tags || [];
            const itemTags = item.tags || [];
            const shared = itemTags.filter((t) => currentTags.includes(t));
            let sim = 0.25 + shared.length * 0.32;
            if (item.category === source.category) sim += 0.12;
            return {
              id: item.id,
              title: item.title,
              category: item.category,
              similarity: parseFloat(Math.min(0.96, sim).toFixed(2)),
              confidence: `${Math.round(Math.min(0.96, sim) * 100)}%`,
              reason:
                shared.length > 0
                  ? `Семантическое родство по признакам: [${shared.join(', ')}]`
                  : 'Сходный векторный кластер',
            };
          })
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, widgetLimit);

        res = {
          status: 'success',
          endpoint: '/v1/recommend',
          latency_ms: 3.8,
          source_item: { id: source.id, title: source.title, category: source.category },
          algorithm: 'eidos-embedding-miniLM-v2',
          vector_dimensions: 384,
          recommendations: recs,
        };
      } else if (consoleEndpoint === 'search') {
        const q = consoleQuery.toLowerCase();
        const scored = catalog
          .map((item) => {
            let score = 0.2;
            const fullText = `${item.title} ${item.description} ${(item.tags || []).join(' ')}`.toLowerCase();
            const words = q.split(' ').filter((w) => w.length > 2);
            for (const w of words) {
              if (fullText.includes(w)) score += 0.35;
            }
            return {
              id: item.id,
              title: item.title,
              category: item.category,
              score: parseFloat(Math.min(0.97, Math.max(0.2, score)).toFixed(2)),
              confidence: `${Math.round(Math.min(0.97, Math.max(0.2, score)) * 100)}%`,
              snippet: item.description,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, widgetLimit);

        res = {
          status: 'success',
          endpoint: '/v1/search',
          query: consoleQuery,
          latency_ms: 4.1,
          matches_found: scored.length,
          results: scored,
        };
      } else {
        res = {
          status: 'success',
          endpoint: '/v1/catalog/upsert',
          message: 'Item vector generated and indexed into semantic topology',
          item_id: 1042,
          embedding_tokens: 38,
          indexed_at: new Date().toISOString(),
        };
      }

      setConsoleResponse(res);
      setConsoleLoading(false);
    }, 280);
  };

  // ROI calculations
  const roiMetrics = useMemo(() => {
    const ordersPerMonth = (monthlyVisitors * (currentConversion / 100));
    const currentRevenue = ordersPerMonth * avgOrderValue;
    // With EIDOS: +20% conversion rate lift
    const newConversion = currentConversion * 1.20;
    const newOrders = (monthlyVisitors * (newConversion / 100));
    const newRevenue = newOrders * avgOrderValue;
    const monthlyAddedRevenue = newRevenue - currentRevenue;
    const annualAddedRevenue = monthlyAddedRevenue * 12;

    return {
      currentRevenue,
      newRevenue,
      monthlyAddedRevenue,
      annualAddedRevenue,
      newConversion: newConversion.toFixed(2),
    };
  }, [monthlyVisitors, avgOrderValue, currentConversion]);

  // Code snippets generator based on selected platform
  const currentSnippet = useMemo(() => {
    switch (selectedPlatform) {
      case 'shopify':
        return `<!-- 1. Вставьте в theme.liquid перед закрывающим </head> -->
<script src="https://cdn.eidos.ai/v1/eidos-widget.min.js" async></script>
<script>
  window.EIDOS_CONFIG = {
    apiKey: 'eidos_live_sk_94a28f731c',
    theme: '${widgetTheme}',
    limit: ${widgetLimit},
    strategy: '${selectedStrategy}',
    showSimilarity: ${showSimilarityBadge}
  };
</script>

<!-- 2. Вставьте в sections/main-product.liquid в место отображения подборки -->
<div id="eidos-recommendations" data-product-id="{{ product.id }}"></div>`;

      case 'woocommerce':
        return `<?php
// Добавьте в functions.php вашей темы WordPress
add_action('woocommerce_after_single_product_summary', 'render_eidos_recommendations', 25);

function render_eidos_recommendations() {
    global $product;
    $product_id = $product->get_id();
    
    // Запрос к EIDOS Recommender API
    $response = wp_remote_post('https://api.eidos.ai/v1/recommend', [
        'headers' => [
            'Authorization' => 'Bearer ' . EIDOS_API_KEY,
            'Content-Type'  => 'application/json'
        ],
        'body' => json_encode([
            'item_id'  => $product_id,
            'limit'    => ${widgetLimit},
            'strategy' => '${selectedStrategy}'
        ])
    ]);
    
    if (is_wp_error($response)) return;
    $body = json_decode(wp_remote_retrieve_body($response), true);
    
    echo '<div class="eidos-recs-wrap"><h3>Вам также понравится (по смыслу)</h3>';
    foreach ($body['recommendations'] as $rec) {
        echo '<div class="eidos-rec-card">' . esc_html($rec['title']) . ' <span>' . esc_html($rec['confidence']) . '</span></div>';
    }
    echo '</div>';
}`;

      case 'bitrix':
        return `<?php
// В шаблоне карточки товара component_epilog.php (1С-Битрикс)
use Bitrix\\Main\\Web\\HttpClient;

$httpClient = new HttpClient();
$httpClient->setHeader('Authorization', 'Bearer eidos_live_sk_94a28f731c');
$httpClient->setHeader('Content-Type', 'application/json');

$payload = json_encode([
    'item_id' => $arResult['ID'],
    'limit' => ${widgetLimit},
    'strategy' => '${selectedStrategy}'
]);

$response = $httpClient->post('https://api.eidos.ai/v1/recommend', $payload);
$data = json_decode($response, true);

if (!empty($data['recommendations'])) {
    // Вывод блока рекомендованных товаров EIDOS
    echo '<div class="eidos-bitrix-slider">';
    foreach ($data['recommendations'] as $item) {
        // Подгрузка детальных данных элемента инфоблока
        echo '<div class="item">' . htmlspecialcharsbx($item['title']) . ' (' . $item['confidence'] . ')</div>';
    }
    echo '</div>';
}`;

      case 'react':
        return `// React / Next.js / Remix Component (SDK @eidos/recommender-react)
import React from 'react';
import { EidosCarousel, useEidosRecommendations } from '@eidos/recommender-react';

export function ProductRecommendations({ productId }: { productId: number }) {
  // Вариант 1: Готовый адаптивный UI-компонент
  return (
    <div className="eidos-container my-6">
      <h3 className="text-base font-bold font-mono mb-3">С этим товаром также выбирают</h3>
      <EidosCarousel
        apiKey="eidos_live_sk_94a28f731c"
        itemId={productId}
        strategy="${selectedStrategy}"
        theme="${widgetTheme}"
        limit={${widgetLimit}}
        showSimilarityBadge={${showSimilarityBadge}}
        showReasonTag={${showReasonTag}}
        onSelect={(item) => console.log('Клик по рекомендации:', item)}
      />
    </div>
  );
}

// Вариант 2: Headless React Hook для индивидуального дизайна
export function CustomHookSection({ productId }: { productId: number }) {
  const { data, isLoading } = useEidosRecommendations({
    itemId: productId,
    limit: ${widgetLimit},
    strategy: '${selectedStrategy}',
  });

  if (isLoading) return <div>Загрузка семантических связей...</div>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {data?.map((item) => (
        <div key={item.id} className="p-3 border rounded-xl">
          <p className="font-bold text-sm">{item.title}</p>
          <span className="text-xs text-cyan-400 font-mono">{item.similarity}% совпадение</span>
        </div>
      ))}
    </div>
  );
}`;

      case 'js_widget':
        return `<!-- Универсальный Web Component / HTML виджет -->
<script type="module" src="https://cdn.eidos.ai/v1/widget.js"></script>

<eidos-recommend
  api-key="eidos_live_sk_94a28f731c"
  item-id="48201"
  strategy="${selectedStrategy}"
  theme="${widgetTheme}"
  limit="${widgetLimit}"
  show-reasons="${showReasonTag}"
></eidos-recommend>`;

      case 'nodejs':
        return `// Node.js / Express / Next.js API Route
import { EidosClient } from '@eidos/recommender';

const eidos = new EidosClient({
  apiKey: process.env.EIDOS_API_KEY
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = Number(searchParams.get('id'));

  const recs = await eidos.recommend({
    itemId: productId,
    limit: ${widgetLimit},
    strategy: '${selectedStrategy}',
    explain: true
  });

  return Response.json(recs);
}`;

      case 'python':
        return `# Python / FastAPI / Django
import httpx

async def get_eidos_recommendations(product_id: int):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.eidos.ai/v1/recommend",
            headers={
                "Authorization": "Bearer eidos_live_sk_94a28f731c",
                "Content-Type": "application/json"
            },
            json={
                "item_id": product_id,
                "limit": ${widgetLimit},
                "strategy": "${selectedStrategy}"
            },
            timeout=1.5
        )
        return response.json().get("recommendations", [])`;

      case 'curl':
        return `curl -X POST https://api.eidos.ai/v1/recommend \\
  -H "Authorization: Bearer eidos_live_sk_94a28f731c" \\
  -H "Content-Type: application/json" \\
  -d '{
    "item_id": 1,
    "limit": ${widgetLimit},
    "strategy": "${selectedStrategy}",
    "explain": true
  }'`;
    }
  }, [selectedPlatform, widgetTheme, widgetLimit, selectedStrategy, showSimilarityBadge, showReasonTag]);

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f] text-[#f1f1f7] p-6 lg:p-8 space-y-10 select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#1e1e2e]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff] font-mono text-xs mb-2">
            <Sparkles size={12} />
            <span>Developer Hub & Integration Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-mono text-white">
            Внедрение EIDOS в любую платформу
          </h1>
          <p className="text-sm text-[#8c8ca6] mt-1 max-w-2xl">
            Подключение рекомендательного движка к интернет-магазинам, видеоплатформам и SaaS за 15
            минут. Как в Algolia и Recombee — готовые сниппеты, виджеты и REST API.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/presentation.html"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141420] border border-[#1e1e2e] hover:border-[#00f0ff] text-xs font-mono text-[#8c8ca6] hover:text-[#00f0ff] transition-all"
          >
            <ExternalLink size={13} />
            <span>Live Demo лендинг</span>
          </a>
          <button
            onClick={() => {
              const testKey = 'eidos_live_sk_94a28f731c50e29b';
              navigator.clipboard.writeText(testKey);
              onShowToast('Тестовый ключ скопирован: ' + testKey, 'success');
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] text-[#050508] font-mono font-bold text-xs shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:shadow-[0_0_28px_rgba(0,240,255,0.4)] transition-all cursor-pointer"
          >
            <Zap size={14} />
            <span>Скопировать API Ключ</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: INTERACTIVE INTEGRATION WIZARD */}
      <section className="rounded-2xl bg-[#11111a] border border-[#1e1e2e] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#1a1a2a]">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#00f0ff]">
              Мастер интеграции
            </div>
            <h2 className="text-xl font-bold font-mono text-white mt-0.5">
              4 шага до запуска рекомендаций
            </h2>
          </div>

          {/* Stepper Tabs */}
          <div className="flex items-center gap-2">
            {[
              { num: 1, label: 'Каталог' },
              { num: 2, label: 'Стратегия' },
              { num: 3, label: 'Виджет' },
              { num: 4, label: 'Код' },
            ].map((s) => (
              <button
                key={s.num}
                onClick={() => setWizardStep(s.num)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  wizardStep === s.num
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-bold'
                    : wizardStep > s.num
                    ? 'bg-[#181829] text-[#3ee89a]'
                    : 'bg-[#141420] text-[#7a7a96]'
                }`}
              >
                <span>{s.num}.</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 1: Ingestion */}
        {wizardStep === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                {
                  id: 'yml',
                  title: 'YML / XML фид',
                  desc: 'Формат Яндекс.Маркета или Google Merchant (есть у 99% магазинов)',
                  icon: Box,
                  badge: 'Самый частый',
                },
                {
                  id: 'rest',
                  title: 'REST API / Webhook',
                  desc: 'Автоматическая отправка товара при публикации в CMS',
                  icon: RefreshCw,
                  badge: 'Real-time',
                },
                {
                  id: 'json',
                  title: 'JSON выгрузка',
                  desc: 'Пакетная загрузка массива товаров из базы данных',
                  icon: Code,
                  badge: 'Простой старт',
                },
                {
                  id: 'csv',
                  title: 'CSV / Excel файл',
                  desc: 'Табличный экспорт артикулов, описаний и цен',
                  icon: Layers,
                  badge: 'Ручной импорт',
                },
              ].map((f) => {
                const Icon = f.icon;
                const isSel = feedType === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setFeedType(f.id as any)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSel
                        ? 'bg-[#181829] border-[#00f0ff] shadow-[0_0_16px_rgba(0,240,255,0.15)]'
                        : 'bg-[#141420] border-[#1e1e2e] hover:border-[#2a2a40]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-[#1e1e35] flex items-center justify-center text-[#00f0ff]">
                          <Icon size={16} />
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff]">
                          {f.badge}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold font-mono text-white mb-1">
                        {f.title}
                      </h4>
                      <p className="text-xs text-[#8c8ca6] leading-relaxed">{f.desc}</p>
                    </div>
                    {isSel && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-[#00f0ff] mt-3">
                        <CheckCircle2 size={12} />
                        <span>Выбран для маппинга</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Schema Mapper Table */}
            <div className="rounded-xl bg-[#0d0d16] border border-[#1e1e2e] p-4">
              <div className="flex items-center justify-between mb-3 text-xs font-mono text-[#8c8ca6]">
                <span>АВТОМАТИЧЕСКИЙ МАППИНГ ПОЛЕЙ ВЕКТОРИЗАЦИИ</span>
                <span className="text-[#3ee89a]">✓ 6/6 полей сопоставлены</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs font-mono">
                {[
                  { field: 'id', mapsTo: 'Идентификатор', type: 'Int / String' },
                  { field: 'title', mapsTo: 'Название товара', type: 'String' },
                  { field: 'description', mapsTo: 'Текст / Аннотация', type: 'Text (384D)' },
                  { field: 'category', mapsTo: 'Категория', type: 'String' },
                  { field: 'price', mapsTo: 'Цена / Валюта', type: 'Number' },
                  { field: 'tags', mapsTo: 'Ключевые свойства', type: 'Array' },
                ].map((m) => (
                  <div key={m.field} className="p-2.5 rounded-lg bg-[#141420] border border-[#1e1e2e]">
                    <div className="text-[#00f0ff] font-bold">{m.field}</div>
                    <div className="text-[#e0e0ed] text-[11px] mt-0.5">{m.mapsTo}</div>
                    <div className="text-[#7a7a96] text-[10px] mt-1">{m.type}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setWizardStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00f0ff] text-[#050508] font-mono text-xs font-bold hover:bg-[#38bdf8] transition-all cursor-pointer"
              >
                <span>Далее: Стратегия алгоритма</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Strategy */}
        {wizardStep === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                {
                  id: 'similar',
                  title: 'Похожие по смыслу (Similar Items)',
                  desc: 'Классические рекомендации ближайших по семантическому вектору товаров.',
                  badge: 'Основной CTR',
                },
                {
                  id: 'cross_category',
                  title: 'Кросс-категорийные (Cross-Sell)',
                  desc: 'Находит связь между разными категориями: игра -> книга -> фильм -> мерч.',
                  badge: 'Чек +25%',
                },
                {
                  id: 'cold_start',
                  title: 'Cold Start Booster (Новинки)',
                  desc: 'Приоритет новым товарам с высокой смысловой релевантностью без кликов.',
                  badge: 'Продажа стока',
                },
                {
                  id: 'search',
                  title: 'Semantic Discovery (Поиск)',
                  desc: 'Поиск по естественному языку даже при нулевом совпадении точных слов.',
                  badge: 'Конверсия +30%',
                },
              ].map((st) => {
                const isSel = selectedStrategy === st.id;
                return (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStrategy(st.id as any)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSel
                        ? 'bg-[#181829] border-[#a855f7] shadow-[0_0_16px_rgba(168,85,247,0.2)]'
                        : 'bg-[#141420] border-[#1e1e2e] hover:border-[#2a2a40]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#a855f7]/15 text-[#a855f7]">
                          {st.badge}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold font-mono text-white mb-1.5">
                        {st.title}
                      </h4>
                      <p className="text-xs text-[#8c8ca6] leading-relaxed">{st.desc}</p>
                    </div>
                    {isSel && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-[#a855f7] mt-4">
                        <CheckCircle2 size={12} />
                        <span>Активная стратегия</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setWizardStep(1)}
                className="px-4 py-2 rounded-lg bg-[#141420] text-[#8c8ca6] hover:text-white font-mono text-xs cursor-pointer"
              >
                Назад
              </button>
              <button
                onClick={() => setWizardStep(3)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00f0ff] text-[#050508] font-mono text-xs font-bold hover:bg-[#38bdf8] transition-all cursor-pointer"
              >
                <span>Далее: Настройка виджета</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Widget Customizer */}
        {wizardStep === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Controls */}
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <label className="text-xs font-mono text-[#8c8ca6] block mb-2">
                    ЦВЕТОВАЯ ТЕМА ВИДЖЕТА
                  </label>
                  <div className="flex gap-2">
                    {(['dark', 'midnight', 'light'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setWidgetTheme(t)}
                        className={`flex-1 py-2 rounded-lg font-mono text-xs uppercase border transition-all cursor-pointer ${
                          widgetTheme === t
                            ? 'bg-[#00f0ff]/15 border-[#00f0ff] text-[#00f0ff]'
                            : 'bg-[#141420] border-[#1e1e2e] text-[#8c8ca6]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-[#8c8ca6] mb-2">
                    <span>КОЛИЧЕСТВО ТОВАРОВ В КАРУСЕЛИ</span>
                    <span className="text-[#00f0ff]">{widgetLimit} шт</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={6}
                    value={widgetLimit}
                    onChange={(e) => setWidgetLimit(Number(e.target.value))}
                    className="w-full accent-[#00f0ff] cursor-pointer"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center justify-between p-3 rounded-lg bg-[#141420] border border-[#1e1e2e] cursor-pointer">
                    <span className="text-xs font-mono text-[#e0e0ed]">
                      Отображать процент сходства (%)
                    </span>
                    <input
                      type="checkbox"
                      checked={showSimilarityBadge}
                      onChange={(e) => setShowSimilarityBadge(e.target.checked)}
                      className="accent-[#00f0ff] cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-lg bg-[#141420] border border-[#1e1e2e] cursor-pointer">
                    <span className="text-xs font-mono text-[#e0e0ed]">
                      Отображать тег «Почему рекомендовано»
                    </span>
                    <input
                      type="checkbox"
                      checked={showReasonTag}
                      onChange={(e) => setShowReasonTag(e.target.checked)}
                      className="accent-[#00f0ff] cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Live Preview of the Widget */}
              <div className="lg:col-span-7">
                <div className="text-xs font-mono text-[#8c8ca6] mb-2 flex items-center justify-between">
                  <span>ПРЕДПРОСМОТР ВИДЖЕТА НА ВАШЕМ САЙТЕ</span>
                  <span className="text-[#3ee89a]">● Live Rendering</span>
                </div>

                <div
                  className={`p-5 rounded-2xl border transition-all ${
                    widgetTheme === 'light'
                      ? 'bg-[#f8f9fa] border-gray-300 text-gray-900'
                      : widgetTheme === 'midnight'
                      ? 'bg-[#07070d] border-[#18182b] text-white'
                      : 'bg-[#12121e] border-[#1e1e2e] text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-current/10">
                    <h4 className="text-sm font-bold font-mono">
                      Вам также может понравиться
                    </h4>
                    <span className="text-[10px] font-mono opacity-60">
                      powered by EIDOS
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {catalog.slice(1, 1 + widgetLimit).map((item, idx) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                          widgetTheme === 'light'
                            ? 'bg-white border-gray-200 shadow-sm'
                            : 'bg-[#181829] border-[#2a2a44]'
                        }`}
                      >
                        <div>
                          <div className="text-2xl mb-1">{item.icon || '📦'}</div>
                          <div className="text-xs font-bold truncate">{item.title}</div>
                          <div className="text-[11px] opacity-70 mt-0.5">{item.price}</div>
                        </div>

                        <div className="mt-3 space-y-1">
                          {showSimilarityBadge && (
                            <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] inline-block">
                              {94 - idx * 4}% сходство
                            </div>
                          )}
                          {showReasonTag && (
                            <div className="text-[9px] opacity-60 truncate">
                              #{item.tags?.[0] || 'смысл'} #{item.category}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setWizardStep(2)}
                className="px-4 py-2 rounded-lg bg-[#141420] text-[#8c8ca6] hover:text-white font-mono text-xs cursor-pointer"
              >
                Назад
              </button>
              <button
                onClick={() => setWizardStep(4)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#00f0ff] text-[#050508] font-mono text-xs font-bold hover:bg-[#38bdf8] transition-all cursor-pointer"
              >
                <span>Получить код интеграции</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Ready Code */}
        {wizardStep === 4 && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/25 text-xs text-[#00f0ff] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>
                  Конфигурация готова! Скопируйте сниппет для выбранной платформы ниже.
                </span>
              </div>
              <button
                onClick={() => handleCopy(currentSnippet, 'wizard-code')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00f0ff] text-[#050508] font-mono font-bold text-[11px] cursor-pointer hover:bg-[#38bdf8]"
              >
                {copiedSection === 'wizard-code' ? <Check size={12} /> : <Copy size={12} />}
                <span>Скопировать код</span>
              </button>
            </div>

            <div className="relative rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] p-4 font-mono text-xs text-[#e0e0ed] overflow-x-auto">
              <pre>{currentSnippet}</pre>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setWizardStep(3)}
                className="px-4 py-2 rounded-lg bg-[#141420] text-[#8c8ca6] hover:text-white font-mono text-xs cursor-pointer"
              >
                Назад к настройке
              </button>
              <button
                onClick={() => {
                  onShowToast('Интеграция готова! Тестируйте запросы в консоли ниже.', 'success');
                }}
                className="px-5 py-2.5 rounded-lg bg-[#3ee89a] text-[#050508] font-mono text-xs font-bold transition-all cursor-pointer"
              >
                Готово к тестированию
              </button>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: CODE SNIPPETS & PLATFORM SELECTOR (LIKE ALGOLIA / RECOMBEE) */}
      <section className="rounded-2xl bg-[#11111a] border border-[#1e1e2e] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#a855f7]">
              Готовые SDK & Сниппеты
            </div>
            <h2 className="text-xl font-bold font-mono text-white mt-0.5">
              Подключение за 5 минут для любого стека
            </h2>
          </div>

          {/* Platform Pills */}
          <div className="flex flex-wrap gap-1.5 bg-[#0d0d16] p-1 rounded-xl border border-[#1e1e2e]">
            {[
              { id: 'shopify', label: 'Shopify' },
              { id: 'woocommerce', label: 'WooCommerce' },
              { id: 'bitrix', label: '1С-Битрикс' },
              { id: 'react', label: 'React / Next.js' },
              { id: 'js_widget', label: 'HTML/JS Widget' },
              { id: 'nodejs', label: 'Node.js' },
              { id: 'python', label: 'Python' },
              { id: 'curl', label: 'cURL / REST' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlatform(p.id as any)}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all cursor-pointer ${
                  selectedPlatform === p.id
                    ? 'bg-[#a855f7] text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                    : 'text-[#8c8ca6] hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Code Box */}
        <div className="relative rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] p-5 font-mono text-xs text-[#e0e0ed] overflow-x-auto shadow-inner">
          <button
            onClick={() => handleCopy(currentSnippet, 'tab-code')}
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181829] border border-[#2a2a40] text-xs text-[#00f0ff] hover:border-[#00f0ff] transition-all cursor-pointer"
          >
            {copiedSection === 'tab-code' ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedSection === 'tab-code' ? 'Скопировано!' : 'Копировать код'}</span>
          </button>
          <pre className="pr-24">{currentSnippet}</pre>
        </div>
      </section>

      {/* SECTION 3: LIVE API TEST CONSOLE */}
      <section className="rounded-2xl bg-[#11111a] border border-[#1e1e2e] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#00f0ff]">
              Interactive API Console
            </div>
            <h2 className="text-xl font-bold font-mono text-white mt-0.5">
              Живое тестирование API в реальном времени
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: 'recommend', label: 'POST /v1/recommend' },
              { id: 'search', label: 'POST /v1/search' },
              { id: 'upsert', label: 'POST /v1/catalog/upsert' },
            ].map((ep) => (
              <button
                key={ep.id}
                onClick={() => {
                  setConsoleEndpoint(ep.id as any);
                  setConsoleResponse(null);
                }}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all cursor-pointer ${
                  consoleEndpoint === ep.id
                    ? 'bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-bold'
                    : 'bg-[#141420] text-[#8c8ca6]'
                }`}
              >
                {ep.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Request Payload Builder */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-xl bg-[#0d0d16] border border-[#1e1e2e]">
              <div className="text-xs font-mono text-[#8c8ca6] mb-3">ПАРАМЕТРЫ ЗАПРОСА</div>

              {consoleEndpoint === 'recommend' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#8c8ca6] block mb-1 font-mono">
                      Исходный товар (item_id)
                    </label>
                    <select
                      value={consoleItemId}
                      onChange={(e) => setConsoleItemId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-[#141420] border border-[#2a2a40] text-xs text-white font-mono focus:border-[#00f0ff] outline-none"
                    >
                      {catalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          #{c.id} · {c.title} ({c.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-[#8c8ca6] block mb-1 font-mono">
                      Лимит выдачи (limit)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={widgetLimit}
                      onChange={(e) => setWidgetLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-[#141420] border border-[#2a2a40] text-xs text-white font-mono outline-none"
                    />
                  </div>
                </div>
              )}

              {consoleEndpoint === 'search' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#8c8ca6] block mb-1 font-mono">
                      Поисковый запрос (query)
                    </label>
                    <input
                      type="text"
                      value={consoleQuery}
                      onChange={(e) => setConsoleQuery(e.target.value)}
                      placeholder="Запрос на естественном языке..."
                      className="w-full px-3 py-2 rounded-lg bg-[#141420] border border-[#2a2a40] text-xs text-white font-sans outline-none focus:border-[#00f0ff]"
                    />
                  </div>
                </div>
              )}

              {consoleEndpoint === 'upsert' && (
                <div className="space-y-2 text-xs font-mono text-[#8c8ca6]">
                  <div>Тестовый товар для векторизации:</div>
                  <div className="p-2.5 rounded bg-[#141420] text-[#00f0ff]">
                    Title: "Квантовый компьютер QuantumOne"
                    <br />
                    Category: "Гаджеты"
                    <br />
                    Tags: ["кванты", "вычисления", "физика"]
                  </div>
                </div>
              )}

              <button
                onClick={runApiConsole}
                disabled={consoleLoading}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#00f0ff] text-[#050508] font-mono text-xs font-bold hover:bg-[#38bdf8] transition-all cursor-pointer disabled:opacity-50"
              >
                <Play size={13} />
                <span>{consoleLoading ? 'Вычисление векторов...' : 'Отправить запрос (Run Test)'}</span>
              </button>
            </div>
          </div>

          {/* Response Inspector */}
          <div className="lg:col-span-7">
            <div className="h-full flex flex-col rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] p-4">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1a1a2a] text-xs font-mono">
                <span className="text-[#8c8ca6]">HTTP 200 OK · JSON RESPONSE</span>
                {consoleResponse && (
                  <span className="text-[#3ee89a]">
                    Latency: {consoleResponse.latency_ms} ms
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto max-h-72 font-mono text-xs text-[#00f0ff]">
                {consoleResponse ? (
                  <pre>{JSON.stringify(consoleResponse, null, 2)}</pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-[#56566e] py-12">
                    <Terminal size={24} className="mb-2" />
                    <span>Нажмите «Отправить запрос» для проверки инференса</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: COMPETITOR COMPARISON (ALGOLIA / RECOMBEE / AMAZON PERSONALIZE) */}
      <section className="rounded-2xl bg-[#11111a] border border-[#1e1e2e] p-6 shadow-xl">
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="text-xs font-mono uppercase tracking-widest text-[#00f0ff]">
            Рыночный бенчмарк
          </div>
          <h2 className="text-2xl font-bold font-mono text-white mt-1">
            Сравнение EIDOS с лидерами рынка
          </h2>
          <p className="text-xs text-[#8c8ca6] mt-1">
            Чем семантический движок превосходит классические рекомендательные сервисы.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#1e1e2e] text-[#8c8ca6]">
                <th className="py-3 px-4">Критерий</th>
                <th className="py-3 px-4 text-[#00f0ff] font-bold bg-[#00f0ff]/5">EIDOS Recommender</th>
                <th className="py-3 px-4">Algolia Recommend</th>
                <th className="py-3 px-4">Recombee</th>
                <th className="py-3 px-4">Amazon Personalize</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#161626]">
              <tr>
                <td className="py-3.5 px-4 text-white font-semibold">Работа без истории покупок</td>
                <td className="py-3.5 px-4 text-[#3ee89a] font-bold bg-[#00f0ff]/5">✓ 100% (по смыслу)</td>
                <td className="py-3.5 px-4 text-[#ff6b9d]">Требует логов</td>
                <td className="py-3.5 px-4 text-[#ffbe3d]">Частично</td>
                <td className="py-3.5 px-4 text-[#ff6b9d]">Требует клики</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 text-white font-semibold">Холодный старт новинок</td>
                <td className="py-3.5 px-4 text-[#3ee89a] font-bold bg-[#00f0ff]/5">Мгновенно (&lt; 4мс)</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">После первых покупок</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">Через несколько дней</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">Переобучение модели</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 text-white font-semibold">Объяснимость связей</td>
                <td className="py-3.5 px-4 text-[#3ee89a] font-bold bg-[#00f0ff]/5">✓ % сходства + теги</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">Только вес</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">Чёрный ящик</td>
                <td className="py-3.5 px-4 text-[#ff6b9d]">Чёрный ящик</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 text-white font-semibold">Время интеграции</td>
                <td className="py-3.5 px-4 text-[#3ee89a] font-bold bg-[#00f0ff]/5">5–15 минут</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">1–2 дня</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">1–2 недели</td>
                <td className="py-3.5 px-4 text-[#ff6b9d]">Недели / месяцы</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 text-white font-semibold">Задержка API (Latency)</td>
                <td className="py-3.5 px-4 text-[#3ee89a] font-bold bg-[#00f0ff]/5">&lt; 35 мс</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">~ 50 мс</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">~ 120 мс</td>
                <td className="py-3.5 px-4 text-[#8c8ca6]">~ 150–250 мс</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 text-white font-semibold">On-Premise контур</td>
                <td className="py-3.5 px-4 text-[#3ee89a] font-bold bg-[#00f0ff]/5">✓ Docker образ</td>
                <td className="py-3.5 px-4 text-[#ff6b9d]">Только SaaS</td>
                <td className="py-3.5 px-4 text-[#ffbe3d]">Только Enterprise</td>
                <td className="py-3.5 px-4 text-[#ff6b9d]">Только AWS</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 5: PRODUCTION LAUNCH KIT & DOWNLOADABLE ARTIFACTS */}
      <LaunchKitSection onShowToast={onShowToast} />

      {/* SECTION 6: BUSINESS ROI CALCULATOR */}
      <section className="rounded-2xl bg-gradient-to-br from-[#11111a] via-[#151526] to-[#11111a] border border-[#2a2a44] p-6 lg:p-8 shadow-xl">
        <div className="max-w-xl mb-6">
          <div className="text-xs font-mono uppercase tracking-widest text-[#3ee89a]">
            Калькулятор окупаемости
          </div>
          <h2 className="text-2xl font-bold font-mono text-white mt-1">
            Оцените финансовый эффект для вашего бизнеса
          </h2>
          <p className="text-xs text-[#8c8ca6] mt-1">
            Двигайте ползунки, чтобы рассчитать прогнозируемый прирост выручки от внедрения EIDOS.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Sliders */}
          <div className="lg:col-span-6 space-y-5">
            <div>
              <div className="flex justify-between text-xs font-mono text-[#8c8ca6] mb-1.5">
                <span>ПОСЕТИТЕЛИ В МЕСЯЦ (ТРАФИК)</span>
                <span className="text-white font-bold">{monthlyVisitors.toLocaleString()} чел</span>
              </div>
              <input
                type="range"
                min={10000}
                max={1000000}
                step={10000}
                value={monthlyVisitors}
                onChange={(e) => setMonthlyVisitors(Number(e.target.value))}
                className="w-full accent-[#00f0ff] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-[#8c8ca6] mb-1.5">
                <span>СРЕДНИЙ ЧЕК ЗАКАЗА (AOV)</span>
                <span className="text-white font-bold">{avgOrderValue.toLocaleString()} ₽</span>
              </div>
              <input
                type="range"
                min={500}
                max={25000}
                step={500}
                value={avgOrderValue}
                onChange={(e) => setAvgOrderValue(Number(e.target.value))}
                className="w-full accent-[#a855f7] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono text-[#8c8ca6] mb-1.5">
                <span>ТЕКУЩАЯ КОНВЕРСИЯ В ПОКУПКУ</span>
                <span className="text-white font-bold">{currentConversion}%</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={5.0}
                step={0.1}
                value={currentConversion}
                onChange={(e) => setCurrentConversion(Number(e.target.value))}
                className="w-full accent-[#3ee89a] cursor-pointer"
              />
            </div>
          </div>

          {/* Calculated Output Card */}
          <div className="lg:col-span-6">
            <div className="p-6 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#1a1a2a]">
                <span className="text-xs font-mono text-[#8c8ca6]">Новая конверсия (+20%)</span>
                <span className="font-mono text-sm font-bold text-[#3ee89a]">
                  {currentConversion}% ➔ {roiMetrics.newConversion}%
                </span>
              </div>

              <div>
                <span className="text-xs font-mono text-[#8c8ca6] block">
                  ДОПОЛНИТЕЛЬНАЯ ВЫРУЧКА В МЕСЯЦ:
                </span>
                <div className="text-3xl font-extrabold font-mono text-[#00f0ff] mt-1">
                  +{Math.round(roiMetrics.monthlyAddedRevenue).toLocaleString()} ₽
                </div>
              </div>

              <div>
                <span className="text-xs font-mono text-[#8c8ca6] block">
                  ДОПОЛНИТЕЛЬНАЯ ВЫРУЧКА В ГОД:
                </span>
                <div className="text-2xl font-bold font-mono text-[#3ee89a] mt-1">
                  +{Math.round(roiMetrics.annualAddedRevenue).toLocaleString()} ₽
                </div>
              </div>

              <div className="pt-2 text-[11px] font-mono text-[#7a7a96]">
                * При стоимости тарифа Business $99/мес окупаемость решения (ROI) превышает 1500%
                уже в первый месяц использования.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
