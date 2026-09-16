import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  ShoppingBag,
  Clock,
  MousePointerClick,
  X,
  Sparkles,
} from 'lucide-react';

interface RoiCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPitch: () => void;
}

export const RoiCalculatorModal: React.FC<RoiCalculatorModalProps> = ({
  isOpen,
  onClose,
  onOpenPitch,
}) => {
  const [traffic, setTraffic] = useState<number>(100000);
  const [conversionRate, setConversionRate] = useState<number>(1.8);
  const [avgOrderValue, setAvgOrderValue] = useState<number>(3200);

  if (!isOpen) return null;

  // Baseline calculations
  const baselineOrders = Math.round((traffic * conversionRate) / 100);
  const baselineRevenue = baselineOrders * avgOrderValue;

  // EIDOS Uplift metrics from user prompt:
  // CTR +30%, Conversion +20%, Time on site +40%
  const newConversionRate = +(conversionRate * 1.2).toFixed(2);
  const newOrders = Math.round((traffic * newConversionRate) / 100);
  const newRevenue = newOrders * avgOrderValue;

  const monthlyLift = newRevenue - baselineRevenue;
  const yearlyLift = monthlyLift * 12;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e0e18] border border-[#1e1e35] rounded-2xl max-w-[720px] w-full p-6 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e1e35] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3ee89a] to-[#00f0ff] flex items-center justify-center text-black font-bold text-sm shadow-[0_0_15px_rgba(62,232,154,0.4)]">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="font-extrabold text-sm text-[#e8e8f0] mono">
                Калькулятор бизнес-эффекта и ROI
              </div>
              <div className="text-[11px] text-[#8a8aa3]">
                «Мы не продаем графы. Мы продаем точные рекомендации и рост прибыли».
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

        {/* Input sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-[#141424] border border-[#1e1e35] rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-[#8a8aa3]">
              <span className="flex items-center gap-1">
                <Users size={13} className="text-[#00f0ff]" /> Трафик (посетителей/мес):
              </span>
            </div>
            <div className="text-base font-bold mono text-[#e8e8f0]">
              {traffic.toLocaleString('ru-RU')}
            </div>
            <input
              type="range"
              min={10000}
              max={1000000}
              step={10000}
              value={traffic}
              onChange={(e) => setTraffic(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-[#0e0e18] rounded appearance-none cursor-pointer accent-[#00f0ff]"
            />
          </div>

          <div className="p-3 bg-[#141424] border border-[#1e1e35] rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-[#8a8aa3]">
              <span className="flex items-center gap-1">
                <ShoppingBag size={13} className="text-[#3ee89a]" /> Конверсия (CR):
              </span>
            </div>
            <div className="text-base font-bold mono text-[#3ee89a]">
              {conversionRate.toFixed(1)}%
            </div>
            <input
              type="range"
              min={0.5}
              max={5.0}
              step={0.1}
              value={conversionRate}
              onChange={(e) => setConversionRate(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#0e0e18] rounded appearance-none cursor-pointer accent-[#3ee89a]"
            />
          </div>

          <div className="p-3 bg-[#141424] border border-[#1e1e35] rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-[#8a8aa3]">
              <span className="flex items-center gap-1">
                <DollarSign size={13} className="text-[#fbbf24]" /> Средний чек (AOV):
              </span>
            </div>
            <div className="text-base font-bold mono text-[#fbbf24]">
              {avgOrderValue.toLocaleString('ru-RU')} ₽
            </div>
            <input
              type="range"
              min={500}
              max={25000}
              step={500}
              value={avgOrderValue}
              onChange={(e) => setAvgOrderValue(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-[#0e0e18] rounded appearance-none cursor-pointer accent-[#fbbf24]"
            />
          </div>
        </div>

        {/* 3 Pillars of EIDOS Metric Growth */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-[#141424] border border-[#3ee89a]/30 rounded-xl flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-full bg-[#3ee89a]/10 flex items-center justify-center text-[#3ee89a] mb-1">
              <MousePointerClick size={16} />
            </div>
            <div className="text-xl font-black mono text-[#3ee89a]">+30%</div>
            <div className="text-xs font-semibold text-[#e8e8f0]">CTR блоков</div>
            <div className="text-[10px] text-[#8a8aa3] mt-0.5">кликабельность товарных подборок</div>
          </div>

          <div className="p-3 bg-[#141424] border border-[#00f0ff]/30 rounded-xl flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-full bg-[#00f0ff]/10 flex items-center justify-center text-[#00f0ff] mb-1">
              <TrendingUp size={16} />
            </div>
            <div className="text-xl font-black mono text-[#00f0ff]">+20%</div>
            <div className="text-xs font-semibold text-[#e8e8f0]">Конверсия (CR)</div>
            <div className="text-[10px] text-[#8a8aa3] mt-0.5">с {conversionRate}% до {newConversionRate}%</div>
          </div>

          <div className="p-3 bg-[#141424] border border-[#b478ff]/30 rounded-xl flex flex-col items-center text-center">
            <div className="w-8 h-8 rounded-full bg-[#b478ff]/10 flex items-center justify-center text-[#b478ff] mb-1">
              <Clock size={16} />
            </div>
            <div className="text-xl font-black mono text-[#b478ff]">+40%</div>
            <div className="text-xs font-semibold text-[#e8e8f0]">Время на сайте</div>
            <div className="text-[10px] text-[#8a8aa3] mt-0.5">глубокое вовлечение в каталог</div>
          </div>
        </div>

        {/* Big Profit Lift Banner */}
        <div className="p-5 rounded-xl bg-gradient-to-r from-[#00f0ff]/10 via-[#3ee89a]/10 to-[#b478ff]/10 border border-[#3ee89a]/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs mono uppercase tracking-wider text-[#3ee89a] font-bold">
              Дополнительная чистая выручка от внедрения EIDOS:
            </div>
            <div className="text-2xl sm:text-3xl font-black mono text-[#e8e8f0] mt-1">
              +{monthlyLift.toLocaleString('ru-RU')} ₽ <span className="text-sm font-normal text-[#8a8aa3]">/ месяц</span>
            </div>
            <div className="text-xs text-[#8a8aa3] mt-0.5">
              Или <strong className="text-[#3ee89a] mono">+{yearlyLift.toLocaleString('ru-RU')} ₽</strong> в год при тех же расходах на маркетинг
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenPitch();
            }}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#3ee89a] to-[#00f0ff] text-black font-bold text-xs mono shadow-[0_0_20px_rgba(62,232,154,0.4)] hover:opacity-95 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            <span>Запустить питч (2 мин)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
