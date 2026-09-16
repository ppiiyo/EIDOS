import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  Zap,
  CheckCircle2,
  ChevronDown,
  Layers,
  BarChart3,
  Cpu,
  FileCode,
  KeyRound,
  ExternalLink,
  Presentation,
  Shield,
  Copy,
  Check,
  Search,
  ShoppingCart,
  BookOpen,
  Code,
} from 'lucide-react';
import { CatalogItem, ActiveTab } from '../types';

interface PresentationLandingViewProps {
  catalog: CatalogItem[];
  onSelectTab: (tab: ActiveTab) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const PresentationLandingView: React.FC<PresentationLandingViewProps> = ({
  catalog,
  onSelectTab,
  onShowToast,
}) => {
  // Hero query state
  const [heroQuery, setHeroQuery] = useState('космос и время');
  const [heroActiveTag, setHeroActiveTag] = useState('космос и время');

  // Selected item in demo section
  const [selectedItemId, setSelectedItemId] = useState<number>(1);

  // FAQ accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Modals state
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('Business');
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [pitchTab, setPitchTab] = useState<'30s' | '2m' | '5m'>('2m');
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Hero query live results
  const heroResults = useMemo(() => {
    const q = heroQuery.toLowerCase().trim();
    if (!q) return catalog.slice(0, 4).map((item) => ({ item, score: 0.85 }));

    return catalog
      .map((item) => {
        let score = 0.2;
        const allText = `${item.title} ${item.description} ${(item.tags || []).join(' ')}`.toLowerCase();
        const words = q.split(' ').filter((w) => w.length > 2);
        for (const word of words) {
          if (allText.includes(word)) score += 0.35;
        }
        if (item.category.toLowerCase().includes(q)) score += 0.25;
        return { item, score: Math.min(0.97, Math.max(0.22, score)) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [heroQuery, catalog]);

  // Demo section recommendation results
  const currentItem = useMemo(() => {
    return catalog.find((c) => c.id === selectedItemId) || catalog[0];
  }, [catalog, selectedItemId]);

  const demoRecommendations = useMemo(() => {
    if (!currentItem) return [];
    return catalog
      .filter((c) => c.id !== currentItem.id)
      .map((item) => {
        let sim = 0.2;
        const currentTags = currentItem.tags || [];
        const itemTags = item.tags || [];
        const shared = itemTags.filter((t) => currentTags.includes(t));
        sim += shared.length * 0.35;
        if (item.category === currentItem.category) sim += 0.15;
        return {
          item,
          sim: Math.min(0.96, sim),
          shared,
        };
      })
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 4);
  }, [catalog, currentItem]);

  const copyApiKey = () => {
    const key = `eidos_live_sk_${Math.random().toString(36).slice(2, 12)}`;
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    onShowToast('Тестовый ключ API скопирован в буфер', 'success');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const copyPromptText = () => {
    const text = `РОЛЬ:\nТы — senior frontend-разработчик и UX-дизайнер уровня Linear, Vercel, Raycast.\nТвоя задача — сверстать презентационный лендинг + интерактивное демо для проекта EIDOS Recommender.\n...`;
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    onShowToast('Промт скопирован в буфер', 'success');
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const faqItems = [
    {
      q: 'Чем EIDOS отличается от коллаборативной фильтрации?',
      a: 'Коллаборативная фильтрация опирается на историю кликов и покупок. Если у вас нет терабайтов логов, она рекомендует банальности или пустые списки. EIDOS анализирует объективный смысл описаний через 384-мерные эмбеддинги, находя неочевидные концептуальные связи даже при нулевой истории покупок.',
    },
    {
      q: 'Как решается проблема «Холодного старта»?',
      a: 'При добавлении нового товара EIDOS мгновенно векторизует его за 4мс и помещает в смысловую матрицу каталога. Новый товар сразу связывается со всеми родственными категориями и начинает рекомендоваться в первую секунду после публикации.',
    },
    {
      q: 'Можно ли использовать на русском и других языках?',
      a: 'Да! Модель эмбеддингов всеядна и мультиязычна. Она сопоставляет смыслы сквозь языковые барьеры: запрос на русском «космос и сингулярность» идеально найдет англоязычный фильм «Interstellar» или статью про черные дыры.',
    },
    {
      q: 'Как быстро EIDOS интегрируется в работающий маркетплейс?',
      a: 'Интеграция занимает от 5 до 15 минут. Вы отправляете каталог через POST /v1/catalog, а затем вызываете POST /v1/recommend или POST /v1/search в вашем фронтенде или бэкенде.',
    },
    {
      q: 'Что с приватностью и безопасностью пользовательских данных?',
      a: 'EIDOS работает только со смысловыми описаниями товаров и метаданными. Никаких персональных данных (PII), номеров карт или контактов пользователей передавать не требуется.',
    },
    {
      q: 'Есть ли возможность развернуть On-Premise?',
      a: 'Да, в тарифе Enterprise мы предоставляем автономный Docker-контейнер и Helm-чарты, работающие полностью внутри защищенного контура заказчика без выхода во внешний интернет.',
    },
    {
      q: 'Как замерить прирост CTR в A/B тесте?',
      a: 'Мы предоставляем встроенный режим A/B-роутинга: 50% трафика получает классические рекомендации, 50% — семантические EIDOS. Метрики CTR, конверсии и среднего чека отслеживаются в реальном времени.',
    },
    {
      q: 'Какие модели эмбеддингов поддерживаются?',
      a: 'По умолчанию используется легковесная и быстрая модель all-MiniLM-L6-v2 (384D), а также поддерживаются BGE-M3, OpenAI text-embedding-3 и локальные дообученные энкодеры.',
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f] text-[#f1f1f7] select-none scroll-smooth">
      {/* 1. NAVBAR */}
      <nav className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-[#1e1e2e] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#a855f7] flex items-center justify-center text-[#0a0a0f] font-black text-sm shadow-[0_0_18px_rgba(0,240,255,0.4)]">
              E
            </div>
            <span className="font-mono text-lg font-extrabold bg-gradient-to-r from-[#00f0ff] to-[#a855f7] bg-clip-text text-transparent">
              EIDOS
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20">
              Recommender API
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-[#8c8ca6]">
            <a href="#problem" className="hover:text-white transition-colors">
              Проблема
            </a>
            <a href="#solution" className="hover:text-white transition-colors">
              Как это работает
            </a>
            <a href="#demo" className="hover:text-white transition-colors">
              Демо
            </a>
            <a href="#metrics" className="hover:text-white transition-colors">
              Метрики
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Тарифы
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab('integration')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#181829] border border-[#a855f7]/40 text-[#a855f7] hover:border-[#a855f7] transition-all cursor-pointer"
            >
              <Zap size={13} />
              <span>Интеграция & SDK</span>
            </button>
            <button
              onClick={() => setIsPitchModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#1a1a2e] border border-[#2a2a44] text-[#8c8ca6] hover:text-white transition-all cursor-pointer"
            >
              <Presentation size={13} />
              <span>Питч (2 мин)</span>
            </button>
            <button
              onClick={() => onSelectTab('recommender')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-[#11111a] border border-[#1e1e2e] text-[#f1f1f7] hover:border-[#00f0ff]/40 transition-all cursor-pointer"
            >
              <ShoppingCart size={13} className="text-[#00f0ff]" />
              <span>Витрина магазина</span>
            </button>
            <button
              onClick={() => {
                setSelectedPlan('Business');
                setIsApiKeyModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold font-mono bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] text-[#050508] shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_28px_rgba(0,240,255,0.5)] transition-all cursor-pointer"
            >
              <KeyRound size={13} />
              <span>Get API Key</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. HERO */}
      <section className="relative max-w-6xl mx-auto px-6 pt-16 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left copy */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/20 text-[#00f0ff] font-mono text-xs">
              <Sparkles size={12} />
              <span>Semantic Embeddings Engine · all-MiniLM-L6-v2</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.15] font-mono text-white">
              Рекомендации, которые{' '}
              <span className="bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#f472b6] bg-clip-text text-transparent">
                понимают смысл
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#8c8ca6] leading-relaxed">
              Семантический рекомендательный движок для маркетплейсов, видеоплатформ и HR.
              Находит неочевидные связи по смыслу, а не по ключевым словам.{' '}
              <span className="text-[#00f0ff] font-medium">CTR +30%</span>,{' '}
              <span className="text-[#a855f7] font-medium">конверсия +20%</span>.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#demo"
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] text-[#050508] font-semibold text-sm shadow-[0_0_24px_rgba(0,240,255,0.25)] hover:shadow-[0_0_32px_rgba(0,240,255,0.4)] transition-all"
              >
                <span>Попробовать демо</span>
                <ArrowRight size={15} />
              </a>
              <button
                onClick={() => onSelectTab('integration')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#11111a] border border-[#a855f7]/40 hover:border-[#a855f7] text-[#a855f7] text-sm font-semibold transition-all cursor-pointer"
              >
                <Code size={15} />
                <span>Внедрение & SDK</span>
              </button>
              <a
                href="#solution"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#11111a] border border-[#1e1e2e] hover:border-[#2c2c44] text-[#f1f1f7] text-sm transition-all"
              >
                <span>Как это работает</span>
              </a>
              <a
                href="/presentation.html"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-mono text-[#8c8ca6] hover:text-[#00f0ff] transition-colors"
                title="Открыть чистый автономный HTML"
              >
                <ExternalLink size={13} />
                <span>Standalone HTML</span>
              </a>
            </div>
          </div>

          {/* Right interactive mini-demo */}
          <div className="lg:col-span-6">
            <div className="relative rounded-2xl bg-[#0d0d16] border border-[#1e1e2e] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#1a1a2a]">
                <div className="flex items-center gap-2 font-mono text-xs text-[#8c8ca6]">
                  <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" />
                  <span>LIVE INFERENCE SANDBOX</span>
                </div>
                <span className="font-mono text-xs text-[#00f0ff]">latency ~3.2ms</span>
              </div>

              {/* Input field */}
              <div className="relative mb-3">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#56566e]"
                />
                <input
                  type="text"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder="Введите запрос (например: 'космос и время')..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#151522] border border-[#2a2a40] rounded-xl text-sm text-[#f1f1f7] focus:outline-none focus:border-[#00f0ff] font-sans transition-colors"
                />
              </div>

              {/* Quick tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[
                  { label: '🚀 космос и время', val: 'космос и время' },
                  { label: '🕶️ киберпанк', val: 'киберпанк симуляция' },
                  { label: '☕ кофе и уют', val: 'кофе эспрессо' },
                  { label: '🐍 python код', val: 'python обучение программирование' },
                ].map((t) => (
                  <button
                    key={t.val}
                    onClick={() => {
                      setHeroQuery(t.val);
                      setHeroActiveTag(t.val);
                    }}
                    className={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                      heroActiveTag === t.val
                        ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/30'
                        : 'bg-[#151522] text-[#8c8ca6] border-[#1e1e2e] hover:border-[#2a2a40]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Live Scored Results */}
              <div className="space-y-2">
                {heroResults.map(({ item, score }) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#141420] border border-[#1e1e2e] hover:border-[#00f0ff]/30 transition-all"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-xl shrink-0">{item.icon || '📦'}</span>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-white truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[#8c8ca6] truncate">
                          {item.category} · {item.description.slice(0, 36)}…
                        </div>
                      </div>
                    </div>
                    <div
                      className={`shrink-0 ml-3 font-mono text-xs px-2.5 py-1 rounded-md font-semibold ${
                        score > 0.6
                          ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/25'
                          : 'bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/25'
                      }`}
                    >
                      {Math.round(score * 100)}% совпадение
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. LOGOS / SOCIAL PROOF */}
      <section className="border-y border-[#1e1e2e] py-8 bg-[#0b0b13]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-[#56566e] mb-6">
            Работает на каталогах передовых e-commerce и медиа платформ
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 opacity-60">
            <div className="font-mono text-sm font-semibold tracking-wider text-[#7a7a96]">
              ◈ SHOPIFY STORE
            </div>
            <div className="font-mono text-sm font-semibold tracking-wider text-[#7a7a96]">
              ▲ NETFLIX CATALOG
            </div>
            <div className="font-mono text-sm font-semibold tracking-wider text-[#7a7a96]">
              ■ AVITO MARKET
            </div>
            <div className="font-mono text-sm font-semibold tracking-wider text-[#7a7a96]">
              ◉ HEADHUNTER HR
            </div>
            <div className="font-mono text-sm font-semibold tracking-wider text-[#7a7a96]">
              ◆ COURSERA EDTECH
            </div>
          </div>
        </div>
      </section>

      {/* 4. PROBLEM */}
      <section id="problem" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-xl mx-auto mb-14">
          <span className="text-xs font-mono uppercase tracking-widest text-[#00f0ff]">
            Проблема индустрии
          </span>
          <h2 className="text-3xl font-bold font-mono text-white mt-2 mb-3">
            Почему текущие рекомендации тупые
          </h2>
          <p className="text-sm text-[#8c8ca6]">
            Коллаборативная фильтрация и алгоритмы «вместе покупают» устарели более 10 лет назад.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-[#11111a] border border-[#1e1e2e] hover:border-[#2c2c44] transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#f472b6]/10 border border-[#f472b6]/25 flex items-center justify-center text-lg mb-4 text-[#f472b6]">
              🛒
            </div>
            <h3 className="text-base font-semibold font-mono text-white mb-2">
              «Только по покупкам»
            </h3>
            <p className="text-xs text-[#8c8ca6] leading-relaxed">
              Обычные системы рекомендуют сахар к чаю. Они не способны понять, что «Матрица» и
              «Cyberpunk 2077» — об одном и том же, если их никто не покупал в одном чеке.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-[#11111a] border border-[#1e1e2e] hover:border-[#2c2c44] transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/25 flex items-center justify-center text-lg mb-4 text-[#00f0ff]">
              ❄️
            </div>
            <h3 className="text-base font-semibold font-mono text-white mb-2">
              «Холодный старт»
            </h3>
            <p className="text-xs text-[#8c8ca6] leading-relaxed">
              Новый товар или видео попадает в слепую зону. Без 100+ кликов алгоритм не понимает, кому
              его показывать, и новинка навсегда хоронится на 10-й странице.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-[#11111a] border border-[#1e1e2e] hover:border-[#2c2c44] transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/25 flex items-center justify-center text-lg mb-4 text-[#a855f7]">
              📦
            </div>
            <h3 className="text-base font-semibold font-mono text-white mb-2">
              «Чёрный ящик»
            </h3>
            <p className="text-xs text-[#8c8ca6] leading-relaxed">
              Пользователь и бизнес не понимают логику подборок. Нет процентного показателя сходства
              и прозрачной причины, почему именно этот объект появился на экране.
            </p>
          </div>
        </div>
      </section>

      {/* 5. SOLUTION (HOW IT WORKS) */}
      <section id="solution" className="border-t border-[#1e1e2e] py-20 bg-[#0d0d16]/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00f0ff]">
              Решение EIDOS
            </span>
            <h2 className="text-3xl font-bold font-mono text-white mt-2 mb-3">
              Как работает EIDOS
            </h2>
            <p className="text-sm text-[#8c8ca6]">
              Превращаем описания любых объектов в математическую карту смыслов за миллисекунды.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            {[
              {
                step: 'ШАГ 01',
                title: 'Загрузка каталога',
                desc: 'Отправляете товары, видео, вакансии или статьи через REST API или JSON.',
                icon: Layers,
              },
              {
                step: 'ШАГ 02',
                title: 'Векторизация',
                desc: 'Модель all-MiniLM-L6-v2 превращает каждый объект в 384-мерный вектор смысла.',
                icon: Cpu,
              },
              {
                step: 'ШАГ 03',
                title: 'Карта смыслов',
                desc: 'Строится граф связей на основе косинусного сходства между всеми парами.',
                icon: BarChart3,
              },
              {
                step: 'ШАГ 04',
                title: 'Выдача через API',
                desc: 'Мгновенные рекомендации <35мс с точным % сходства и объяснением связи.',
                icon: Zap,
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="p-5 rounded-xl bg-[#11111a] border border-[#1e1e2e] relative"
                >
                  <div className="text-[11px] font-mono font-bold text-[#00f0ff] mb-3">
                    {s.step}
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-[#181829] flex items-center justify-center text-[#a855f7] mb-3">
                    <Icon size={16} />
                  </div>
                  <h4 className="text-sm font-semibold font-mono text-white mb-1.5">
                    {s.title}
                  </h4>
                  <p className="text-xs text-[#8c8ca6] leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Pipeline ASCII / Schema Box */}
          <div className="rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] p-6 text-center font-mono text-xs text-[#00f0ff] overflow-x-auto shadow-inner">
            <pre className="whitespace-pre text-left sm:text-center text-[11px] sm:text-xs">
{`┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EIDOS RECOMMENDER PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│   1. КАТАЛОГ           2. ЭМБЕДДИНГИ          3. МАТРИЦА СХОДСТВА      4. ВЫДАЧА РЕКОМЕНДАЦИЙ │
│  [Товары / Видео] ➔ [all-MiniLM 384D]  ➔  [Косинусное расстояние] ➔  [REST API: 94% Сходства]│
└─────────────────────────────────────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </div>
      </section>

      {/* 6. DEMO (INTERACTIVE) */}
      <section id="demo" className="border-t border-[#1e1e2e] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00f0ff]">
              Интерактивный опыт
            </span>
            <h2 className="text-3xl font-bold font-mono text-white mt-2 mb-3">
              Попробуйте сами
            </h2>
            <p className="text-sm text-[#8c8ca6]">
              Кликните на любой товар в каталоге слева — справа мгновенно отобразятся семантически
              связанные объекты с прозрачным объяснением.
            </p>
          </div>

          <div className="rounded-2xl bg-[#11111a] border border-[#1e1e2e] p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Catalog list */}
            <div>
              <div className="flex items-center justify-between font-mono text-xs text-[#8c8ca6] mb-3">
                <span>КАТАЛОГ ТОВАРОВ</span>
                <span>{catalog.length} объектов в памяти</span>
              </div>
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-2">
                {catalog.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      item.id === selectedItemId
                        ? 'bg-[#181829] border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                        : 'bg-[#141420] border-[#1e1e2e] hover:border-[#2a2a40]'
                    }`}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{item.icon || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white truncate">
                          {item.title}
                        </span>
                        <span className="text-[11px] font-mono text-[#00f0ff]">
                          {item.price || item.category}
                        </span>
                      </div>
                      <div className="text-xs text-[#8c8ca6] line-clamp-1 mt-0.5">
                        {item.description}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(item.tags || []).slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#181829] text-[#7a7a96]"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations output */}
            <div className="flex flex-col justify-between rounded-xl bg-[#0d0d16] border border-[#1e1e2e] p-5">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1a1a2a]">
                  <div className="font-mono text-xs text-[#00f0ff] font-semibold">
                    СЕМАНТИЧЕСКИЕ РЕКОМЕНДАЦИИ
                  </div>
                  <div className="text-xs text-[#8c8ca6] font-mono truncate max-w-[200px]">
                    Для: <span className="text-white">{currentItem?.title}</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {demoRecommendations.map(({ item, sim, shared }) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#141420] border border-[#1e1e2e] hover:border-[#00f0ff]/30 transition-all"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-2xl shrink-0">{item.icon || '📦'}</span>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-white truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[#8c8ca6]">
                            {item.category} ·{' '}
                            {shared.length > 0
                              ? `Связка: [${shared.join(', ')}]`
                              : item.description.slice(0, 30)}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 ml-3 text-right">
                        <span
                          className={`font-mono text-xs px-2.5 py-1 rounded font-bold ${
                            sim > 0.6
                              ? 'bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20'
                              : 'bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20'
                          }`}
                        >
                          {Math.round(sim * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-[#1a1a2a] flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-[#56566e] font-mono">
                  Метрика: Cosine Sim(u, v)
                </span>
                <button
                  onClick={() => onSelectTab('recommender')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00f0ff] text-[#050508] font-mono text-xs font-semibold hover:bg-[#38bdf8] transition-all cursor-pointer"
                >
                  <ShoppingCart size={13} />
                  <span>Открыть полную витрину</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. METRICS */}
      <section id="metrics" className="border-t border-[#1e1e2e] py-20 bg-[#0d0d16]/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00f0ff]">
              Бизнес-метрики
            </span>
            <h2 className="text-3xl font-bold font-mono text-white mt-2 mb-3">
              Цифры, которые говорят
            </h2>
            <p className="text-sm text-[#8c8ca6]">
              Результаты A/B-тестирования на реальном каталоге 10 000 товаров.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '+30%',
                label: 'CTR Рекомендаций',
                desc: 'Рост кликабельности релевантных подборок',
              },
              {
                num: '+20%',
                label: 'Конверсия в покупку',
                desc: 'Прямой прирост выручки и среднего чека',
              },
              {
                num: '+40%',
                label: 'Время на сайте',
                desc: 'Глубина вовлечения и удержание внимания',
              },
              {
                num: '<50 мс',
                label: 'Скорость отклика',
                desc: 'Мгновенный векторный инференс API',
              },
            ].map((m) => (
              <div
                key={m.label}
                className="p-6 rounded-xl bg-[#11111a] border border-[#1e1e2e] text-center relative overflow-hidden"
              >
                <div className="text-4xl font-extrabold font-mono bg-gradient-to-r from-[#00f0ff] to-[#a855f7] bg-clip-text text-transparent mb-2">
                  {m.num}
                </div>
                <div className="text-sm font-semibold text-white mb-1">{m.label}</div>
                <div className="text-xs text-[#8c8ca6]">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. PRICING */}
      <section id="pricing" className="border-t border-[#1e1e2e] py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00f0ff]">
              Тарифные планы
            </span>
            <h2 className="text-3xl font-bold font-mono text-white mt-2 mb-3">
              Прозрачные тарифы под любой масштаб
            </h2>
            <p className="text-sm text-[#8c8ca6]">
              Начните бесплатно на стадии прототипа и масштабируйтесь без ограничений.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Free */}
            <div className="p-8 rounded-2xl bg-[#11111a] border border-[#1e1e2e] flex flex-col justify-between">
              <div>
                <div className="font-mono text-base font-bold text-white mb-2">Free</div>
                <div className="text-3xl font-extrabold font-mono text-white mb-4">
                  $0 <span className="text-xs font-normal text-[#8c8ca6]">/ мес</span>
                </div>
                <p className="text-xs text-[#8c8ca6] mb-6">
                  Для проверки гипотез, пет-проектов и локальных прототипов.
                </p>
                <ul className="space-y-2.5 text-xs text-[#c4c4d8] mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> 100 запросов / месяц
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Каталог до 500 товаров
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Базовые эмбеддинги
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Доступ к REST API
                  </li>
                </ul>
              </div>
              <button
                onClick={() => {
                  setSelectedPlan('Free');
                  setIsApiKeyModalOpen(true);
                }}
                className="w-full py-2.5 rounded-lg bg-[#181829] border border-[#2a2a40] text-white font-mono text-xs hover:border-[#00f0ff] transition-all cursor-pointer"
              >
                Начать бесплатно
              </button>
            </div>

            {/* Business (Popular) */}
            <div className="p-8 rounded-2xl bg-[#131322] border-2 border-[#a855f7] flex flex-col justify-between relative shadow-[0_0_40px_rgba(168,85,247,0.15)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#a855f7] to-[#00f0ff] text-[#050508] font-mono text-[10px] font-bold">
                MOST POPULAR
              </div>
              <div>
                <div className="font-mono text-base font-bold text-[#a855f7] mb-2">Business</div>
                <div className="text-3xl font-extrabold font-mono text-white mb-4">
                  $99 <span className="text-xs font-normal text-[#8c8ca6]">/ мес</span>
                </div>
                <p className="text-xs text-[#8c8ca6] mb-6">
                  Для растущих интернет-магазинов, видеохостингов и медиа-сервисов.
                </p>
                <ul className="space-y-2.5 text-xs text-[#c4c4d8] mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> 10 000 запросов / месяц
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Каталог до 25 000 товаров
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Мультиязычность 50+ языков
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Приоритетный SLA 99.9%
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Аналитика CTR и конверсий
                  </li>
                </ul>
              </div>
              <button
                onClick={() => {
                  setSelectedPlan('Business');
                  setIsApiKeyModalOpen(true);
                }}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] text-[#050508] font-mono text-xs font-bold shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_28px_rgba(0,240,255,0.5)] transition-all cursor-pointer"
              >
                Подключить Business
              </button>
            </div>

            {/* Enterprise */}
            <div className="p-8 rounded-2xl bg-[#11111a] border border-[#1e1e2e] flex flex-col justify-between">
              <div>
                <div className="font-mono text-base font-bold text-white mb-2">Enterprise</div>
                <div className="text-3xl font-extrabold font-mono text-white mb-4">
                  Custom
                </div>
                <p className="text-xs text-[#8c8ca6] mb-6">
                  Для крупных маркетплейсов с миллионами SKU и требованиями On-Premise.
                </p>
                <ul className="space-y-2.5 text-xs text-[#c4c4d8] mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Неограниченные запросы
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Каталог любого объема
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> On-premise Docker / Helm
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Дообучение под домен
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#00f0ff]" /> Выделенный инженер & SLA 99.99%
                  </li>
                </ul>
              </div>
              <button
                onClick={() => {
                  setSelectedPlan('Enterprise');
                  setIsApiKeyModalOpen(true);
                }}
                className="w-full py-2.5 rounded-lg bg-[#181829] border border-[#2a2a40] text-white font-mono text-xs hover:border-[#00f0ff] transition-all cursor-pointer"
              >
                Связаться с нами
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FAQ */}
      <section id="faq" className="border-t border-[#1e1e2e] py-20 bg-[#0d0d16]/30">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00f0ff]">
              Частые вопросы
            </span>
            <h2 className="text-3xl font-bold font-mono text-white mt-2 mb-3">
              Ответы на главные вопросы
            </h2>
            <p className="text-sm text-[#8c8ca6]">
              Всё, что вам нужно знать о технологии семантических рекомендаций.
            </p>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-xl bg-[#11111a] border border-[#1e1e2e] overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-white hover:text-[#00f0ff] transition-colors cursor-pointer"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      size={16}
                      className={`text-[#00f0ff] transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-4 text-xs text-[#8c8ca6] leading-relaxed border-t border-[#1a1a2a] pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 10. CTA FINAL */}
      <section className="border-t border-[#1e1e2e] py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="rounded-2xl bg-gradient-to-br from-[#00f0ff]/10 via-[#a855f7]/10 to-[#11111a] border border-[#2a2a44] p-10 sm:p-14 text-center relative overflow-hidden">
            <h2 className="text-3xl sm:text-4xl font-extrabold font-mono text-white mb-3">
              Подключите EIDOS за 5 минут
            </h2>
            <p className="text-sm text-[#8c8ca6] max-w-lg mx-auto mb-8">
              Повысьте выручку и кликабельность рекомендаций вашего каталога с первого дня.
              Бесплатный тестовый токен активируется мгновенно.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => {
                  setSelectedPlan('Business');
                  setIsApiKeyModalOpen(true);
                }}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#00f0ff] to-[#00b4d8] text-[#050508] font-bold font-mono text-xs shadow-[0_0_24px_rgba(0,240,255,0.3)] hover:shadow-[0_0_36px_rgba(0,240,255,0.5)] transition-all cursor-pointer"
              >
                Получить API Key
              </button>
              <button
                onClick={() => setIsPitchModalOpen(true)}
                className="px-6 py-3 rounded-lg bg-[#181829] border border-[#2a2a40] text-white font-mono text-xs hover:border-[#a855f7] transition-all cursor-pointer"
              >
                🎬 Посмотреть 2-мин Питч
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="border-t border-[#1e1e2e] py-14 bg-[#0a0a0f] text-xs text-[#8c8ca6]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-[#00f0ff] to-[#a855f7] flex items-center justify-center text-[#0a0a0f] font-bold text-xs">
                  E
                </div>
                <span className="font-mono font-bold text-white text-base">EIDOS</span>
              </div>
              <p className="text-xs text-[#8c8ca6] max-w-sm leading-relaxed mb-4">
                Семантический рекомендательный движок нового поколения на эмбеддингах. Понимание —
                это структура связей.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPromptModalOpen(true)}
                  className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#151522] border border-[#1e1e2e] text-[#00f0ff] hover:border-[#00f0ff]/40 transition-colors cursor-pointer"
                >
                  📋 Промт для Cursor / v0
                </button>
              </div>
            </div>

            <div>
              <div className="font-mono text-white text-xs font-semibold mb-3">Продукт</div>
              <ul className="space-y-2">
                <li>
                  <a href="#problem" className="hover:text-[#00f0ff]">
                    О системе
                  </a>
                </li>
                <li>
                  <a href="#solution" className="hover:text-[#00f0ff]">
                    Архитектура
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-[#00f0ff]">
                    Тарифы
                  </a>
                </li>
                <li>
                  <a href="#metrics" className="hover:text-[#00f0ff]">
                    Бенчмарки
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="font-mono text-white text-xs font-semibold mb-3">Разработчикам</div>
              <ul className="space-y-2">
                <li>
                  <a href="#demo" className="hover:text-[#00f0ff]">
                    API Playground
                  </a>
                </li>
                <li>
                  <a href="/presentation.html" target="_blank" className="hover:text-[#00f0ff]">
                    Standalone HTML
                  </a>
                </li>
                <li>
                  <button onClick={() => onSelectTab('export')} className="hover:text-[#00f0ff] text-left">
                    Экспорт графа
                  </button>
                </li>
                <li>
                  <button onClick={() => onSelectTab('graph')} className="hover:text-[#00f0ff] text-left">
                    Граф смыслов
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <div className="font-mono text-white text-xs font-semibold mb-3">Компания</div>
              <ul className="space-y-2">
                <li>
                  <span className="text-[#56566e]">MIT License</span>
                </li>
                <li>
                  <span className="text-[#56566e]">Privacy First</span>
                </li>
                <li>
                  <span className="text-[#56566e]">Open Source</span>
                </li>
                <li>
                  <span className="text-[#56566e]">v2.0 Production</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#161622] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#56566e]">
            <div>© 2025 EIDOS Recommender. Все права защищены.</div>
            <div>Made with 🧠 by EIDOS Team</div>
          </div>
        </div>
      </footer>

      {/* MODAL 1: GET API KEY */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl bg-[#11111a] border border-[#2a2a44] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1e1e2e]">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-[#00f0ff]" />
                <span className="font-mono font-bold text-white text-sm">
                  Получить ключ API · Тариф {selectedPlan}
                </span>
              </div>
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="text-[#8c8ca6] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[#8c8ca6]">
                Ваш уникальный тестовый ключ API готов. Передавайте его в заголовке{' '}
                <code className="px-1.5 py-0.5 rounded bg-[#181829] text-[#00f0ff] font-mono">
                  Authorization: Bearer &lt;KEY&gt;
                </code>
              </p>

              {/* Key Box */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] font-mono text-xs text-[#00f0ff]">
                <span>eidos_live_sk_94a28f731c50e29b</span>
                <button
                  onClick={copyApiKey}
                  className="flex items-center gap-1 text-[#8c8ca6] hover:text-white cursor-pointer ml-2"
                >
                  {copiedKey ? <Check size={14} className="text-[#3ee89a]" /> : <Copy size={14} />}
                </button>
              </div>

              {/* Code Snippet */}
              <div className="rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] p-3 font-mono text-[11px] text-[#8c8ca6] overflow-x-auto">
                <div className="text-[#56566e] mb-1"># cURL запрос:</div>
                <div className="text-[#f1f1f7]">
                  curl -X POST https://api.eidos.ai/v1/recommend \<br />
                  &nbsp;&nbsp;-H "Authorization: Bearer eidos_live_sk_94a28f731c" \<br />
                  &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                  &nbsp;&nbsp;-d &#39;&#123;"item_id": 1, "limit": 4&#125;&#39;
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsApiKeyModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#181829] text-white hover:bg-[#202038] transition-colors"
                >
                  Закрыть
                </button>
                <button
                  onClick={() => {
                    copyApiKey();
                    setIsApiKeyModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#00f0ff] text-[#050508] font-semibold hover:bg-[#38bdf8] transition-colors"
                >
                  Скопировать ключ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ELEVATOR PITCH */}
      {isPitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-2xl bg-[#11111a] border border-[#2a2a44] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1e1e2e]">
              <div className="flex items-center gap-2">
                <Presentation size={16} className="text-[#a855f7]" />
                <span className="font-mono font-bold text-white text-sm">
                  Elevator Pitch Сценарии (Инвестор / CTO)
                </span>
              </div>
              <button
                onClick={() => setIsPitchModalOpen(false)}
                className="text-[#8c8ca6] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Pitch length tabs */}
            <div className="flex gap-2 mb-4">
              {[
                { id: '30s', label: '30 секунд (Инвестор)' },
                { id: '2m', label: '2 минуты (CTO / Head of Product)' },
                { id: '5m', label: '5 минут (Конференция)' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPitchTab(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    pitchTab === t.id
                      ? 'bg-[#a855f7]/20 text-[#a855f7] border border-[#a855f7]/40'
                      : 'bg-[#181829] text-[#8c8ca6] border border-transparent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#0a0a0f] border border-[#1e1e2e] text-xs leading-relaxed text-[#e0e0ed] space-y-3 font-sans">
              {pitchTab === '30s' && (
                <div>
                  <p className="font-semibold text-[#00f0ff] mb-2 font-mono">
                    30 секунд (для инвестора):
                  </p>
                  <p>
                    «Современные рекомендации тупые: они советуют сахар к кофе. Мы сделали движок,
                    который понимает смысл товаров. Работает без истории покупок, объясняет каждую
                    рекомендацию, увеличивает CTR на 30%. Прототип уже готов. Ищем пилотного
                    клиента.»
                  </p>
                </div>
              )}

              {pitchTab === '2m' && (
                <div>
                  <p className="font-semibold text-[#a855f7] mb-2 font-mono">
                    2 минуты (для CTO / Head of Product):
                  </p>
                  <p>
                    «EIDOS — это recommendation API на основе эмбеддингов. Подключаете свой каталог
                    через REST, получаете семантические рекомендации. Не нужна ML-команда. Работает с
                    любым языком. Холодный старт решён. Интеграция — 5 минут.»
                  </p>
                  <div className="mt-3 p-3 rounded-lg bg-[#141420] border border-[#2a2a40] text-[11px] font-mono text-[#8c8ca6]">
                    Ключевые УТП:
                    <br />• 0% зависимости от старых кликстримов
                    <br />• Доказуемый рост выручки: +20% конверсия
                    <br />• Выдача ответа за &lt;35мс
                  </div>
                </div>
              )}

              {pitchTab === '5m' && (
                <div>
                  <p className="font-semibold text-[#f472b6] mb-2 font-mono">
                    5 минут (для конференции / демодня):
                  </p>
                  <p>
                    «Проблема рекомендаций в 2025: они основаны на статистике, а не на смысле. Мы
                    предлагаем semantic approach: превращаем каждый объект в вектор смысла через
                    all-MiniLM-L6-v2 и строим граф связей. Это даёт: (1) объяснимость, (2) холодный
                    старт, (3) мультиязычность. Наши A/B-тесты показывают +30% CTR. Мы открываем
                    API. Давайте посмотрим демо...»
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsPitchModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#181829] text-white hover:bg-[#202038] text-xs font-mono"
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PROMPT FOR CURSOR / V0 */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-2xl bg-[#11111a] border border-[#2a2a44] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1e1e2e]">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-[#00f0ff]" />
                <span className="font-mono font-bold text-white text-sm">
                  Промт для верстки презентационного приложения (Cursor / v0 / Claude)
                </span>
              </div>
              <button
                onClick={() => setIsPromptModalOpen(false)}
                className="text-[#8c8ca6] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#8c8ca6] mb-3">
              Этот промт можно скопировать и скормить любой AI-модели для создания аналогичного
              одностраничного лендинга или деплоя в автономный HTML-файл.
            </p>

            <div className="rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] p-3 max-h-64 overflow-y-auto font-mono text-[11px] text-[#c4c4d8] leading-relaxed">
{`РОЛЬ:
Ты — senior frontend-разработчик и UX-дизайнер уровня Linear, Vercel, Raycast.
Твоя задача — сверстать презентационный лендинг + интерактивное демо для проекта EIDOS Recommender.

ЦЕЛЬ ПРОДУКТА:
EIDOS Recommender — это семантический рекомендательный движок на основе эмбеддингов.
Он находит товары/контент по СМЫСЛУ, а не по ключевым словам.
Продукт продаётся как B2B SaaS / API для маркетплейсов, видеоплатформ, HR-сервисов, онлайн-библиотек.

ТОН И СТИЛЬ:
- Тёмная тема, глубокий фон #0a0a0f
- Акценты: cyan #00f0ff, purple #a855f7, pink #f472b6
- Шрифты: JetBrains Mono (заголовки, код), Inter (текст)
- Стиль: минимализм в духе Linear.app / Vercel / Raycast`}
            </div>

            <div className="flex justify-between items-center mt-4">
              <a
                href="/presentation.html"
                target="_blank"
                className="text-xs font-mono text-[#00f0ff] hover:underline flex items-center gap-1"
              >
                <ExternalLink size={12} /> Открыть сгенерированный presentation.html
              </a>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPromptModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#181829] text-white hover:bg-[#202038] text-xs font-mono"
                >
                  Закрыть
                </button>
                <button
                  onClick={copyPromptText}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00f0ff] text-[#050508] font-bold text-xs font-mono hover:bg-[#38bdf8] transition-colors"
                >
                  {copiedPrompt ? <Check size={14} /> : <Copy size={14} />}
                  <span>Скопировать промт целиком</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
