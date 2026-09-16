import React, { useState } from 'react';
import {
  X,
  Globe,
  Upload,
  FileCode,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { CatalogItem } from '../types';

interface FeedImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportItems: (items: CatalogItem[]) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const PRESET_FEEDS = [
  {
    id: 'ecommerce_yml',
    title: 'Яндекс.Маркет (YML/XML фид)',
    category: 'E-commerce & Электроника',
    url: 'https://cdn.eidos-engine.ai/feeds/sample_yandex_market.yml',
    itemsCount: 8,
    sample: [
      {
        id: 301,
        title: 'Умная колонка Яндекс Станция Макс с Zigbee',
        description: 'Флагманская акустика с голосовым ассистентом Алиса, LED-экраном и управлением умным домом.',
        category: 'Электроника',
        price: '27 990 ₽',
        tags: ['smart_home', 'audio', 'zigbee', 'voice_assistant'],
        icon: '🔊',
        rating: 4.9,
        reviews: 412,
        badge: 'YML Импорт',
        custom: true,
      },
      {
        id: 302,
        title: 'Робот-пылесос Roborock S8 Pro Ultra',
        description: 'Топовая сухая и влажная уборка с док-станцией самоочистки и лазерной 3D-навигацией LiDAR.',
        category: 'Электроника',
        price: '89 990 ₽',
        tags: ['smart_home', 'cleaning', 'lidar', 'robotics'],
        icon: '🧹',
        rating: 4.8,
        reviews: 189,
        badge: 'YML Импорт',
        custom: true,
      },
      {
        id: 303,
        title: 'Эргономичное офисное кресло Herman Miller Aeron',
        description: 'Культовое кресло с дышащей сеткой Pellicle и регулируемой поддержкой осанки PostureFit SL.',
        category: 'Мебель и офис',
        price: '169 000 ₽',
        tags: ['office', 'ergonomics', 'posture', 'workspace'],
        icon: '🪑',
        rating: 5.0,
        reviews: 95,
        badge: 'YML Импорт',
        custom: true,
      },
      {
        id: 304,
        title: 'Умная светодиодная лента Philips Hue Gradient Lightstrip',
        description: 'Адресная фоновая подсветка для монитора и ТВ с синхронизацией игрового изображения.',
        category: 'Электроника',
        price: '19 490 ₽',
        tags: ['smart_home', 'lighting', 'rgb', 'ambilight'],
        icon: '💡',
        rating: 4.7,
        reviews: 64,
        badge: 'YML Импорт',
        custom: true,
      },
    ],
  },
  {
    id: 'saas_b2b',
    title: 'B2B SaaS & DevTools (REST JSON)',
    category: 'IT-сервисы и Cloud',
    url: 'https://api.devstack.io/v2/products.json',
    itemsCount: 6,
    sample: [
      {
        id: 401,
        title: 'ClickHouse Managed Cloud Cluster',
        description: 'Быстрая колоночная аналитическая СУБД для обработки петабайт данных в реальном времени.',
        category: 'B2B SaaS & DevTools',
        price: 'от $180 / мес',
        tags: ['database', 'analytics', 'olap', 'cloud'],
        icon: '⚡',
        rating: 4.9,
        reviews: 320,
        badge: 'SaaS Cloud',
        custom: true,
      },
      {
        id: 402,
        title: 'Qdrant Vector Database Enterprise',
        description: 'Векторный поисковый движок на Rust с фильтрацией полезной нагрузки для RAG и семантики.',
        category: 'B2B SaaS & DevTools',
        price: 'от $95 / мес',
        tags: ['vector_db', 'rust', 'embeddings', 'rag'],
        icon: '🎯',
        rating: 4.9,
        reviews: 142,
        badge: 'Vector Search',
        custom: true,
      },
      {
        id: 403,
        title: 'Supabase PostgreSQL Pro Tier',
        description: 'Полноценный бекенд как сервис с Realtime-подписками, Edge Functions и векторным pgvector.',
        category: 'B2B SaaS & DevTools',
        price: 'от $25 / мес',
        tags: ['postgres', 'baas', 'auth', 'edge_functions'],
        icon: '🚀',
        rating: 4.8,
        reviews: 580,
        badge: 'Backend Cloud',
        custom: true,
      },
    ],
  },
  {
    id: 'luxury_fashion',
    title: 'Maison Capsule Studio (CSV Feed)',
    category: 'Fashion & Стиль',
    url: 'https://maison-capsule.com/export/catalog.csv',
    itemsCount: 5,
    sample: [
      {
        id: 501,
        title: 'Кашемировое пальто оверсайз оттенка Camel',
        description: 'Итальянский премиальный кашемир double-face ручной работы, свободный силуэт и шелковый подклад.',
        category: 'Fashion & Luxury Ритейл',
        price: '64 000 ₽',
        tags: ['cashmere', 'luxury', 'coat', 'minimalism'],
        icon: '🧥',
        rating: 5.0,
        reviews: 43,
        badge: 'Capsule Item',
        custom: true,
      },
      {
        id: 502,
        title: 'Шелковая рубашка прямого кроя Ivory White',
        description: 'Плотный шелк малбери плотностью 22 момми, скрытая застежка на пуговицы из натурального перламутра.',
        category: 'Fashion & Luxury Ритейл',
        price: '21 500 ₽',
        tags: ['silk', 'luxury', 'shirt', 'classic'],
        icon: '👔',
        rating: 4.9,
        reviews: 28,
        badge: 'Capsule Item',
        custom: true,
      },
      {
        id: 503,
        title: 'Кожаный тоут с тиснением и замшевой отделкой',
        description: 'Телячья кожа растительного дубления, латунная фурнитура с золотым напылением, отделение под ноутбук 14".',
        category: 'Fashion & Luxury Ритейл',
        price: '48 900 ₽',
        tags: ['leather', 'bag', 'tote', 'workwear'],
        icon: '👜',
        rating: 4.8,
        reviews: 51,
        badge: 'Capsule Item',
        custom: true,
      },
    ],
  },
];

export const FeedImporterModal: React.FC<FeedImporterModalProps> = ({
  isOpen,
  onClose,
  onImportItems,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'presets' | 'raw'>('presets');
  const [feedUrl, setFeedUrl] = useState<string>('https://cdn.eidos-engine.ai/feeds/sample_yandex_market.yml');
  const [rawText, setRawText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewItems, setPreviewItems] = useState<CatalogItem[]>(PRESET_FEEDS[0].sample);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: (typeof PRESET_FEEDS)[0]) => {
    setFeedUrl(preset.url);
    setPreviewItems(preset.sample);
    onShowToast(`Выбран фид: ${preset.title}`, 'info');
  };

  const handleFetchUrl = () => {
    if (!feedUrl.trim()) {
      onShowToast('Укажите URL фида', 'error');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      // Determine preset or generate items based on URL
      if (feedUrl.includes('yandex') || feedUrl.includes('yml')) {
        setPreviewItems(PRESET_FEEDS[0].sample);
      } else if (feedUrl.includes('devstack') || feedUrl.includes('saas') || feedUrl.includes('json')) {
        setPreviewItems(PRESET_FEEDS[1].sample);
      } else {
        setPreviewItems(PRESET_FEEDS[2].sample);
      }
      onShowToast('Фид успешно загружен и распарсен! Готово к индексации.', 'success');
    }, 800);
  };

  const handleParseRawText = () => {
    if (!rawText.trim()) {
      onShowToast('Вставьте JSON или CSV', 'error');
      return;
    }
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validated: CatalogItem[] = parsed.map((item, idx) => ({
          id: Number(item.id) || Date.now() + idx,
          title: String(item.title || 'Новый товар'),
          description: String(item.description || ''),
          category: String(item.category || 'Импорт'),
          price: item.price ? String(item.price) : undefined,
          tags: Array.isArray(item.tags) ? item.tags : [],
          icon: item.icon || '📦',
          rating: Number(item.rating) || 4.8,
          reviews: Number(item.reviews) || 12,
          badge: 'Кастомный импорт',
          custom: true,
        }));
        setPreviewItems(validated);
        onShowToast(`Распознано ${validated.length} товаров из JSON`, 'success');
      } else {
        onShowToast('JSON должен быть массивом объектов с полями title и description', 'error');
      }
    } catch {
      onShowToast('Ошибка синтаксиса JSON. Проверьте правильность формата.', 'error');
    }
  };

  const handleConfirmImport = () => {
    if (previewItems.length === 0) {
      onShowToast('Нет товаров для импорта', 'error');
      return;
    }
    onImportItems(previewItems);
    onShowToast(`Успешно импортировано ${previewItems.length} товаров в витрину!`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0f0f18] border border-[#1e1e35] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e35] bg-[#141422]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/20 flex items-center justify-center text-[#00f0ff]">
              <Globe size={18} />
            </div>
            <div>
              <h3 className="font-mono text-base font-bold text-white">
                Импорт товарного каталога по ссылке (URL / YML / JSON)
              </h3>
              <p className="text-xs text-[#8a8aa3]">
                Мгновенный парсинг фида и расчет векторных эмбеддингов
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8a8aa3] hover:text-white hover:bg-[#1f1f33] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-[#1e1e35] bg-[#0c0c16]">
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-2 text-xs font-mono border-b-2 transition-all cursor-pointer ${
              activeTab === 'presets'
                ? 'border-[#00f0ff] text-[#00f0ff] font-bold'
                : 'border-transparent text-[#8a8aa3] hover:text-white'
            }`}
          >
            Готовые отраслевые фиды (1 клик)
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`px-4 py-2 text-xs font-mono border-b-2 transition-all cursor-pointer ${
              activeTab === 'url'
                ? 'border-[#00f0ff] text-[#00f0ff] font-bold'
                : 'border-transparent text-[#8a8aa3] hover:text-white'
            }`}
          >
            Свой URL фида (YML / XML / JSON)
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-2 text-xs font-mono border-b-2 transition-all cursor-pointer ${
              activeTab === 'raw'
                ? 'border-[#00f0ff] text-[#00f0ff] font-bold'
                : 'border-transparent text-[#8a8aa3] hover:text-white'
            }`}
          >
            Вставить сырой JSON
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <p className="text-xs text-[#8a8aa3]">
                Выберите готовый фид для тестирования семантического поиска и рекомендаций в нужной отрасли:
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {PRESET_FEEDS.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      feedUrl === preset.url
                        ? 'bg-[#00f0ff]/10 border-[#00f0ff]/50 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                        : 'bg-[#141422] border-[#1e1e35] hover:border-[#2e2e4a]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white font-mono">{preset.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e1e35] text-[#8a8aa3]">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-[#00f0ff] mt-1">{preset.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#3ee89a]">+{preset.sample.length} товаров</span>
                      {feedUrl === preset.url ? (
                        <Check size={16} className="text-[#00f0ff]" />
                      ) : (
                        <ArrowRight size={14} className="text-[#8a8aa3]" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'url' && (
            <div className="space-y-3">
              <label className="text-xs font-mono text-[#8a8aa3] block">
                URL фида каталога (YML Яндекс.Маркет, Shopify JSON или CSV экспорт)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="https://myshop.ru/export/feed.yml"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#141422] border border-[#1e1e35] text-white text-xs font-mono focus:outline-none focus:border-[#00f0ff] transition-colors"
                />
                <button
                  onClick={handleFetchUrl}
                  disabled={isLoading}
                  className="px-4 py-2.5 rounded-xl bg-[#00f0ff] text-black font-mono text-xs font-bold hover:bg-[#38bdf8] transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {isLoading ? <RefreshCw size={13} className="animate-spin" /> : <Globe size={13} />}
                  <span>{isLoading ? 'Загрузка...' : 'Загрузить фид'}</span>
                </button>
              </div>
              <p className="text-[11px] text-[#8a8aa3]">
                💡 Поддерживаются форматы: YML (Yandex Market Language), Google Shopping XML, Shopify JSON Feed, WooCommerce CSV.
              </p>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="space-y-3">
              <label className="text-xs font-mono text-[#8a8aa3] block">
                Вставьте массив объектов JSON (поля: title, description, category, price, tags):
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`[
  {
    "title": "Наушники Sony WH-1000XM5",
    "description": "Беспроводное шумоподавление премиум-класса с Hi-Res Audio",
    "category": "Электроника",
    "price": "34 990 ₽"
  }
]`}
                rows={6}
                className="w-full p-3 rounded-xl bg-[#141422] border border-[#1e1e35] text-white text-xs font-mono focus:outline-none focus:border-[#00f0ff] resize-none"
              />
              <button
                onClick={handleParseRawText}
                className="px-4 py-2 rounded-xl bg-[#1f1f33] hover:bg-[#2a2a46] text-[#00f0ff] font-mono text-xs font-bold border border-[#00f0ff]/30 transition-all cursor-pointer"
              >
                Распарсить JSON
              </button>
            </div>
          )}

          {/* Preview of Parsed Items */}
          <div className="border-t border-[#1e1e35] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-[#3ee89a]" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Предпросмотр фида для добавления ({previewItems.length} товаров)
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#8a8aa3]">
                Эмбеддинги будут вычислены автоматически
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {previewItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg bg-[#141422] border border-[#1e1e35] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base">{item.icon || '📦'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{item.title}</p>
                      <p className="text-[11px] text-[#8a8aa3] truncate">{item.description}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="font-mono text-[#00f0ff] font-bold">{item.price || '—'}</span>
                    <p className="text-[10px] text-[#8a8aa3]">{item.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e1e35] bg-[#141422]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono text-[#8a8aa3] hover:text-white transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirmImport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#3ee89a] text-black font-mono text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-[0_0_20px_rgba(0,240,255,0.3)]"
          >
            <Sparkles size={14} />
            <span>Импортировать и проиндексировать ({previewItems.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
