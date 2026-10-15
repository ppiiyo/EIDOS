import React, { useState } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  TrendingUp,
  Code2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { CatalogItem } from '../types';

interface PitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: CatalogItem) => void;
  onSearchQuery: (q: string) => void;
}

export const PitchModal: React.FC<PitchModalProps> = ({
  isOpen,
  onClose,
  onSelectItem,
  onSearchQuery,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      stepNumber: 1,
      duration: '15 сек',
      title: '1. Проблема: Поиск по словам слеп',
      tag: 'Боль клиента',
      tagColor: 'text-[#ff6b9d] bg-[#ff6b9d]/10 border-[#ff6b9d]/30',
      pitchText:
        '«Смотрите: покупатель вводит "хочу что-то про космос и время". Обычный маркетплейс ищет совпадение подстрок и выдает игрушечные ракеты или будильники со словом "время". Он не понимает, что пользователь хочет "Интерстеллар"».',
      actionTitle: 'Показать наглядно разницу:',
      actionButtonText: '🔍 Запустить сравнение поиска',
      onAction: () => {
        onSearchQuery('космос и время');
        onClose();
      },
      previewBox: (
        <div className="grid grid-cols-2 gap-3 text-xs mono">
          <div className="p-3 bg-[#111120] border border-[#ff6b9d]/30 rounded-lg">
            <div className="text-[#ff6b9d] font-bold mb-1 flex items-center gap-1">
              <AlertTriangle size={12} /> Обычный поиск (по словам):
            </div>
            <div className="text-[#8a8aa3]">«космос и время» →</div>
            <div className="text-[#ff6b9d] line-through mt-1">Игрушечная ракета ❌</div>
            <div className="text-[#ff6b9d] line-through">Настенные часы "Космос" ❌</div>
            <div className="text-[10px] text-[#8a8aa3] mt-2">0% понимания контекста</div>
          </div>
          <div className="p-3 bg-[#111120] border border-[#00f0ff]/30 rounded-lg">
            <div className="text-[#00f0ff] font-bold mb-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> EIDOS AI (по смыслу):
            </div>
            <div className="text-[#8a8aa3]">«космос и время» →</div>
            <div className="text-[#3ee89a] font-semibold mt-1">Интерстеллар (96%) ✓</div>
            <div className="text-[#3ee89a] font-semibold">Дюна (91%) ✓</div>
            <div className="text-[10px] text-[#00f0ff] mt-2">Глубокая семантика</div>
          </div>
        </div>
      ),
    },
    {
      stepNumber: 2,
      duration: '30 сек',
      title: '2. Решение: Движок EIDOS понимает смысл',
      tag: 'Технология',
      tagColor: 'text-[#00f0ff] bg-[#00f0ff]/10 border-[#00f0ff]/30',
      pitchText:
        '«А теперь наш движок. Вводим "хочу что-то про космос и время". Мгновенно получаем "Интерстеллар", "Дюна", "Матрица". Потому что EIDOS понимает смысл, семантическую близость и ассоциации аудитории, а не просто совпадение букв».',
      actionTitle: 'Проверить в живом каталоге:',
      actionButtonText: '🚀 Ввести "космос и время"',
      onAction: () => {
        onSearchQuery('космос и время');
        onClose();
      },
      previewBox: (
        <div className="p-3 bg-[#111120] border border-[#1e1e35] rounded-lg text-xs">
          <div className="text-[#8a8aa3] mb-1 mono text-[11px]">Архитектура E5 Multilingual:</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-[#00f0ff]/10 text-[#00f0ff] rounded mono">query: "космос и время"</span>
            <span className="text-[#b478ff]">→ 64D Эмбеддинг →</span>
            <span className="px-2 py-1 bg-[#3ee89a]/10 text-[#3ee89a] rounded mono">Cosine Similarity 0.96</span>
          </div>
        </div>
      ),
    },
    {
      stepNumber: 3,
      duration: '30 сек',
      title: '3. Магия: Рекомендации и объяснение связей',
      tag: 'Вау-эффект',
      tagColor: 'text-[#b478ff] bg-[#b478ff]/10 border-[#b478ff]/30',
      pitchText:
        '«Смотрите: кликаем на "Интерстеллар" и видим: "Похожее: Начало, Дюна, Матрица". При этом мы объясняем клиенту ПОЧЕМУ: "Оба произведения исследуют релятивистское время, червоточины и границы познания". Это создает доверие и непрерывное удержание».',
      actionTitle: 'Кликнуть на Интерстеллар:',
      actionButtonText: '✨ Открыть рекомендации Интерстеллар',
      onAction: () => {
        onSelectItem({
          id: 7,
          title: 'Фильм "Интерстеллар"',
          description: 'Научно-фантастический шедевр Кристофера Нолана о релятивистском времени, черных дырах и любви сквозь космос',
          category: 'Фильмы',
        });
        onClose();
      },
      previewBox: (
        <div className="p-3 bg-[#111120] border border-[#b478ff]/30 rounded-lg text-xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[#e8e8f0] font-semibold">🌌 Фильм "Интерстеллар"</span>
            <span className="text-[#fbbf24] mono text-[11px]">→ Рекомендации:</span>
          </div>
          <div className="text-[11px] text-[#8a8aa3] pl-2 border-l-2 border-[#b478ff]">
            "Оба произведения исследуют релятивистское время, грандиозный масштаб вселенной и борьбу человека с неизведанным."
          </div>
        </div>
      ),
    },
    {
      stepNumber: 4,
      duration: '30 сек',
      title: '4. Ценность: Конкретные бизнес-метрики',
      tag: 'Деньги и ROI',
      tagColor: 'text-[#3ee89a] bg-[#3ee89a]/10 border-[#3ee89a]/30',
      pitchText:
        '«Мы не продаем абстрактные эмбеддинги. Мы продаем рост продаж. Внедрение семантического движка EIDOS увеличивает CTR рекомендаций на 30%, конверсию в покупку на 20%, а среднее время клиента на платформе — на 40%».',
      actionTitle: 'Посмотреть метрики:',
      actionButtonText: '📈 Перейти в калькулятор ROI',
      onAction: () => {
        onClose();
      },
      previewBox: (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 bg-[#111120] border border-[#3ee89a]/30 rounded-lg">
            <div className="text-lg font-black text-[#3ee89a] mono">+30%</div>
            <div className="text-[10px] text-[#8a8aa3] uppercase tracking-wider">CTR блоков</div>
          </div>
          <div className="p-2.5 bg-[#111120] border border-[#00f0ff]/30 rounded-lg">
            <div className="text-lg font-black text-[#00f0ff] mono">+20%</div>
            <div className="text-[10px] text-[#8a8aa3] uppercase tracking-wider">Конверсия</div>
          </div>
          <div className="p-2.5 bg-[#111120] border border-[#b478ff]/30 rounded-lg">
            <div className="text-lg font-black text-[#b478ff] mono">+40%</div>
            <div className="text-[10px] text-[#8a8aa3] uppercase tracking-wider">Время на сайте</div>
          </div>
        </div>
      ),
    },
    {
      stepNumber: 5,
      duration: '15 сек',
      title: '5. Призыв: Интеграция за 5 минут',
      tag: 'Закрытие сделки',
      tagColor: 'text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/30',
      pitchText:
        '«Хотите, чтобы ваш маркетплейс, онлайн-кинотеатр или библиотека стали умнее уже сегодня? Подключите наш готовый REST API за 5 минут или используйте SDK. Первый месяц бесплатно».',
      actionTitle: 'Проверить интеграцию:',
      actionButtonText: '⚡ Открыть API Console',
      onAction: () => {
        onClose();
      },
      previewBox: (
        <div className="p-3 bg-[#111120] border border-[#fbbf24]/30 rounded-lg text-xs mono text-[#fbbf24]">
          <code>POST /api/v1/recommend &#123; "item": "Cyberpunk 2077", "limit": 5 &#125; → 200 OK (3.8ms)</code>
        </div>
      ),
    },
  ];

  const current = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e0e18] border border-[#1e1e35] rounded-2xl max-w-[680px] w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col gap-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e1e35] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00f0ff] to-[#b478ff] flex items-center justify-center text-black font-bold text-sm shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              🎬
            </div>
            <div>
              <div className="font-extrabold text-sm text-[#e8e8f0] mono">
                Интерактивный сценарий питча инвестору
              </div>
              <div className="text-[11px] text-[#8a8aa3]">
                2-минутная демонстрация ценности продукта EIDOS
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8a8aa3] hover:text-[#e8e8f0] hover:bg-[#141424] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step progress pills */}
        <div className="grid grid-cols-5 gap-1.5">
          {steps.map((s, idx) => (
            <button
              key={s.stepNumber}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === currentStep
                  ? 'bg-gradient-to-r from-[#00f0ff] to-[#b478ff]'
                  : idx < currentStep
                  ? 'bg-[#3ee89a]/70'
                  : 'bg-[#1e1e35]'
              }`}
              title={`Шаг ${s.stepNumber}: ${s.duration}`}
            />
          ))}
        </div>

        {/* Step Header */}
        <div className="flex items-center justify-between">
          <span className={`text-[11px] mono uppercase font-bold px-2.5 py-1 rounded-full border ${current.tagColor}`}>
            {current.tag} · {current.duration}
          </span>
          <span className="text-xs mono text-[#8a8aa3]">
            Шаг {current.stepNumber} из {steps.length}
          </span>
        </div>

        {/* Title & Speech */}
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-bold text-[#e8e8f0]">{current.title}</h3>
          <div className="p-4 rounded-xl bg-[#141424] border border-[#1e1e35] text-sm text-[#e8e8f0] leading-relaxed italic relative">
            <span className="text-[#00f0ff] text-xl font-serif mr-1">“</span>
            {current.pitchText.replace(/^«|»$/g, '')}
            <span className="text-[#00f0ff] text-xl font-serif ml-1">”</span>
          </div>
        </div>

        {/* Dynamic preview box for step */}
        {current.previewBox}

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1e1e35]">
          <button
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[#1e1e35] text-xs text-[#8a8aa3] hover:text-[#e8e8f0] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft size={14} /> Назад
          </button>

          <button
            onClick={current.onAction}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#00f0ff] to-[#b478ff] text-black font-bold text-xs mono shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:opacity-90 transition-all cursor-pointer"
          >
            <span>{current.actionButtonText}</span>
          </button>

          <button
            onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
            disabled={currentStep === steps.length - 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[#1e1e35] text-xs text-[#8a8aa3] hover:text-[#e8e8f0] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            Далее <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
