import React from 'react';
import { Sparkles, Star, ShoppingCart, Check } from 'lucide-react';
import { CatalogItem } from '../types';

interface ProductCardProps {
  item: CatalogItem;
  isSelected: boolean;
  onSelect: (item: CatalogItem) => void;
  onAddToCart?: (item: CatalogItem) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  item,
  isSelected,
  onSelect,
  onAddToCart,
}) => {
  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'bg-[#141829] border-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.2)]'
          : 'bg-[#111120] border-[#1e1e35] hover:bg-[#15152a] hover:border-[#00f0ff]/50 hover:shadow-[0_0_15px_rgba(0,240,255,0.08)]'
      }`}
    >
      {/* Top badges */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-2xl" role="img" aria-label={item.title}>
          {item.icon || '📦'}
        </span>
        <div className="flex items-center gap-1.5">
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
      <div className="flex flex-col gap-1 mb-3">
        <h4 className="font-bold text-sm text-[#e8e8f0] group-hover:text-[#00f0ff] transition-colors line-clamp-1">
          {item.title}
        </h4>
        <p className="text-xs text-[#8a8aa3] line-clamp-2 leading-relaxed">
          {item.description}
        </p>
      </div>

      {/* Rating & Reviews */}
      <div className="flex items-center gap-1.5 text-xs text-[#8a8aa3] mb-3">
        <span className="flex items-center text-[#fbbf24] font-bold">
          <Star size={12} fill="#fbbf24" className="mr-0.5" />
          {item.rating || 4.8}
        </span>
        <span>·</span>
        <span className="text-[11px] mono">
          {(item.reviews || 1200).toLocaleString('ru-RU')} отзывов
        </span>
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
