import React, { useState } from 'react';
import { Sparkles, Star, ShoppingCart, ThumbsUp, ThumbsDown, HelpCircle, Check } from 'lucide-react';
import { CatalogItem } from '../types';

export interface ExplanationBadgeItem {
  type: string;
  text: string;
  icon: string;
  confidence?: number;
}

interface ProductCardProps {
  item: CatalogItem;
  isSelected: boolean;
  explanations?: ExplanationBadgeItem[];
  onSelect: (item: CatalogItem) => void;
  onAddToCart?: (item: CatalogItem) => void;
  onFeedback?: (itemId: string | number, type: 'like' | 'dislike' | 'why') => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  item,
  isSelected,
  explanations,
  onSelect,
  onAddToCart,
  onFeedback,
}) => {
  const [feedbackGiven, setFeedbackGiven] = useState<'like' | 'dislike' | 'why' | null>(null);
  const [showDetailWhy, setShowDetailWhy] = useState(false);

  // Derive default explanations if not passed
  const displayExplanations: ExplanationBadgeItem[] = explanations && explanations.length > 0
    ? explanations
    : [
        {
          type: 'semantic',
          text: 'Похоже на ваши интересы',
          icon: '🔍',
        },
        {
          type: 'popularity',
          text: (item.rating && item.rating >= 4.8) ? 'Высокий рейтинг покупателей' : 'Хит продаж',
          icon: '🔥',
        },
      ];

  const handleFeedbackClick = (e: React.MouseEvent, type: 'like' | 'dislike' | 'why') => {
    e.stopPropagation();
    setFeedbackGiven(type);
    if (type === 'why') {
      setShowDetailWhy((prev) => !prev);
    }
    if (onFeedback) {
      onFeedback(item.id, type);
    }
    setTimeout(() => {
      if (type !== 'why') setFeedbackGiven(null);
    }, 1800);
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
        feedbackGiven === 'dislike'
          ? 'opacity-40 scale-95 border-red-500/30'
          : feedbackGiven === 'like'
          ? 'ring-2 ring-emerald-400/50 shadow-[0_0_20px_rgba(52,211,153,0.2)]'
          : isSelected
          ? 'bg-[#141829] border-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.2)]'
          : 'bg-[#111120] border-[#1e1e35] hover:bg-[#15152a] hover:border-[#00f0ff]/50 hover:shadow-[0_0_15px_rgba(0,240,255,0.08)]'
      }`}
    >
      {/* Top badges */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-2xl" role="img" aria-label={item.title}>
          {item.icon || '📦'}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {item.badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] mono font-bold bg-[#b478ff]/15 text-[#b478ff] border border-[#b478ff]/30">
              {item.badge}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] mono text-[#8a8aa3] bg-[#0b0b13] border border-[#1e1e35]">
            {item.category}
          </span>
        </div>
      </div>

      {/* Title & Description */}
      <div className="flex flex-col gap-1 mb-2">
        <h4 className="font-bold text-sm text-[#e8e8f0] group-hover:text-[#00f0ff] transition-colors line-clamp-1">
          {item.title}
        </h4>
        <p className="text-xs text-[#8a8aa3] line-clamp-2 leading-relaxed">
          {item.description}
        </p>
      </div>

      {/* Section 2.2 / 3.1: Recommendation Explanation Badges */}
      <div className="flex flex-col gap-1 my-2">
        <div className="flex flex-wrap gap-1.5">
          {displayExplanations.slice(0, 2).map((exp, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] mono bg-cyan-950/40 text-cyan-300 border border-cyan-500/25 transition-all hover:bg-cyan-900/50"
              title={exp.text}
            >
              <span className="text-xs">{exp.icon}</span>
              <span className="truncate max-w-[170px]">{exp.text}</span>
            </div>
          ))}
        </div>

        {/* Detailed Explanation popup if 'why' clicked */}
        {showDetailWhy && (
          <div className="p-2.5 mt-1 rounded-lg bg-[#0c1020] border border-cyan-500/40 text-[11px] text-[#b0b8db] animate-in fade-in duration-200">
            <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1">
              <Sparkles size={11} />
              <span>Факторы ранжирования:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] text-[#8a8aa3]">
              <li>Семантический вектор: 92% косинусная близость</li>
              <li>Связи в Графе Знаний: прямая категория {item.category}</li>
              <li>LinUCB Эксплорация: оптимальный баланс новизны</li>
            </ul>
          </div>
        )}
      </div>

      {/* Rating & Reviews */}
      <div className="flex items-center justify-between text-xs text-[#8a8aa3] mb-3">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center text-[#fbbf24] font-bold">
            <Star size={12} fill="#fbbf24" className="mr-0.5" />
            {item.rating || 4.8}
          </span>
          <span>·</span>
          <span className="text-[11px] mono">
            {(item.reviews || 1200).toLocaleString('ru-RU')} отзывов
          </span>
        </div>

        {/* Interactive Feedback Buttons (👍 👎 ❓) */}
        <div className="flex items-center gap-1 bg-[#0b0c16] px-1.5 py-0.5 rounded-lg border border-[#1e1e35]">
          <button
            type="button"
            onClick={(e) => handleFeedbackClick(e, 'like')}
            className={`p-1 rounded text-[#8a8aa3] hover:text-emerald-400 hover:scale-110 active:scale-90 transition-all cursor-pointer ${
              feedbackGiven === 'like' ? 'text-emerald-400 font-bold' : ''
            }`}
            title="Больше таких рекомендаций"
          >
            <ThumbsUp size={11} />
          </button>
          <button
            type="button"
            onClick={(e) => handleFeedbackClick(e, 'dislike')}
            className={`p-1 rounded text-[#8a8aa3] hover:text-rose-400 hover:scale-110 active:scale-90 transition-all cursor-pointer ${
              feedbackGiven === 'dislike' ? 'text-rose-400 font-bold' : ''
            }`}
            title="Меньше таких рекомендаций"
          >
            <ThumbsDown size={11} />
          </button>
          <button
            type="button"
            onClick={(e) => handleFeedbackClick(e, 'why')}
            className={`p-1 rounded text-[#8a8aa3] hover:text-cyan-300 hover:scale-110 active:scale-90 transition-all cursor-pointer ${
              showDetailWhy ? 'text-cyan-300' : ''
            }`}
            title="Почему мне это рекомендовано?"
          >
            <HelpCircle size={11} />
          </button>
        </div>
      </div>

      {/* Price & Action button */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#1e1e35] gap-2">
        <div className="font-bold text-sm mono text-[#e8e8f0]">
          {item.price || '1 990 ₽'}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs mono font-semibold transition-all cursor-pointer ${
              isSelected
                ? 'bg-[#00f0ff] text-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                : 'bg-[#1e1e35] text-[#8a8aa3] hover:text-[#00f0ff] hover:bg-[#252540]'
            }`}
            title="Найти похожие товары на основе смысла"
          >
            <Sparkles size={11} />
            <span>Похожее</span>
          </button>

          {onAddToCart && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(item);
              }}
              className="w-8 h-8 rounded-lg bg-[#0e0e18] border border-[#1e1e35] flex items-center justify-center text-[#8a8aa3] hover:text-[#3ee89a] hover:border-[#3ee89a] transition-all cursor-pointer"
              title="В корзину"
            >
              <ShoppingCart size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
