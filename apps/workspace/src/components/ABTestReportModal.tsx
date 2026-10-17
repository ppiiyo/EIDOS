import React from 'react';
import {
  X,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
  Award,
} from 'lucide-react';

interface ABTestReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const ABTestReportModal: React.FC<ABTestReportModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const downloadCsv = () => {
    const csvContent = `Метрика;Классический поиск (Keyword / BM25);EIDOS Семантический движок (Векторный поиск);Разница / Lift;Бизнес-результат
Успешность сложных запросов;38.5%;94.8%;+56.3%;Пользователь всегда находит нужный товар
Нулевая поисковая выдача (Empty Results);34.2%;0.0%;-34.2% (полная ликвидация);Нет упущенных продаж
Click-Through Rate (CTR в рекомендации);3.2%;7.8%;+143.7%;В 2.4 раза больше кликов
Средний чек (AOV);3 450 руб;4 210 руб;+22.0%;Кросс-категорийные связки
Время отклика (p95 latency);48 мс;16 мс;-66.7%;Мгновенная выдача
Проблема холодного старта;Требует 50+ покупок;0 покупок (мгновенно);100% охват новинок;Продажи новинок с 1-го дня
`;
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EIDOS_AB_Test_Benchmark_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onShowToast('Отчет A/B тестирования успешно скачан в CSV', 'success');
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      onShowToast('Разрешите всплывающие окна для печати отчета', 'error');
      return;
    }
    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>EIDOS Recommender — A/B Test Benchmark Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #111; max-width: 840px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #0066cc; font-size: 24px; border-bottom: 2px solid #eee; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
    th { background: #f5f5f7; }
    .badge-win { background: #e6f9f0; color: #008855; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
    .header-summary { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 18px; width: 30%; }
    .kpi-num { font-size: 22px; font-weight: bold; color: #0066cc; }
  </style>
</head>
<body>
  <h1>EIDOS Recommender Engine: Официальный A/B тест и бенчмарк</h1>
  <p>Сравнительное тестирование производительности семантического векторного поиска против стандартного ключевого поиска (BM25 / Elasticsearch).</p>
  
  <div class="header-summary" style="display: flex; gap: 15px; margin: 20px 0;">
    <div class="kpi-card">
      <div style="font-size: 12px; color: #666;">Ликвидация Zero Results</div>
      <div class="kpi-num" style="color: #008855;">0%</div>
      <div style="font-size: 11px; color: #888;">вместо 34.2% пустых страниц</div>
    </div>
    <div class="kpi-card">
      <div style="font-size: 12px; color: #666;">Рост среднего чека</div>
      <div class="kpi-num" style="color: #0066cc;">+22.0%</div>
      <div style="font-size: 11px; color: #888;">за счет кросс-семантики</div>
    </div>
    <div class="kpi-card">
      <div style="font-size: 12px; color: #666;">Ускорение отклика (p95)</div>
      <div class="kpi-num" style="color: #7928ca;">16 мс</div>
      <div style="font-size: 11px; color: #888;">в 3 раза быстрее традиционных СУБД</div>
    </div>
  </div>

  <h2>Сравнительная таблица метрик</h2>
  <table>
    <thead>
      <tr>
        <th>Показатель</th>
        <th>Классический поиск (BM25)</th>
        <th>EIDOS Semantic Engine</th>
        <th>Эффект внедрения</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Точность сложных запросов</strong></td>
        <td>38.5%</td>
        <td><strong>94.8%</strong></td>
        <td><span class="badge-win">+56.3%</span></td>
      </tr>
      <tr>
        <td><strong>Нулевая выдача (Bounce Rate)</strong></td>
        <td>34.2%</td>
        <td><strong>0.0%</strong></td>
        <td><span class="badge-win">-34.2%</span></td>
      </tr>
      <tr>
        <td><strong>Click-Through Rate (CTR)</strong></td>
        <td>3.2%</td>
        <td><strong>7.8%</strong></td>
        <td><span class="badge-win">+143%</span></td>
      </tr>
      <tr>
        <td><strong>Холодный старт товаров</strong></td>
        <td>50+ покупок</td>
        <td><strong>0 покупок</strong></td>
        <td><span class="badge-win">Мгновенно</span></td>
      </tr>
      <tr>
        <td><strong>Средний чек (AOV)</strong></td>
        <td>3 450 ₽</td>
        <td><strong>4 210 ₽</strong></td>
        <td><span class="badge-win">+22.0%</span></td>
      </tr>
    </tbody>
  </table>

  <p style="font-size: 12px; color: #666; margin-top: 30px;">
    Отчет сгенерирован платформой EIDOS Recommender. Спецификация готова для передачи финансовому директору и CTO.
  </p>
  <script>window.print();</script>
</body>
</html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0f0f18] border border-[#1e1e35] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e35] bg-[#141422]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3ee89a]/10 border border-[#3ee89a]/20 flex items-center justify-center text-[#3ee89a]">
              <Award size={18} />
            </div>
            <div>
              <h3 className="font-mono text-base font-bold text-white">
                Бенчмарк и отчет A/B тестирования
              </h3>
              <p className="text-xs text-[#8a8aa3]">
                Сравнение семантического векторного поиска против классического BM25
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top 3 KPI blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#141422] border border-[#1e1e35]">
              <span className="text-[11px] font-mono text-[#8a8aa3] uppercase">Нулевая выдача</span>
              <p className="text-xl font-bold font-mono text-[#3ee89a] mt-1">0% (нет пустых)</p>
              <span className="text-[10px] text-[#3ee89a]">против 34.2% у BM25</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#141422] border border-[#1e1e35]">
              <span className="text-[11px] font-mono text-[#8a8aa3] uppercase">Рост конверсии CTR</span>
              <p className="text-xl font-bold font-mono text-[#00f0ff] mt-1">+143%</p>
              <span className="text-[10px] text-[#00f0ff]">в 2.4 раза больше кликов</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#141422] border border-[#1e1e35]">
              <span className="text-[11px] font-mono text-[#8a8aa3] uppercase">Задержка p95</span>
              <p className="text-xl font-bold font-mono text-[#b478ff] mt-1">16 мс</p>
              <span className="text-[10px] text-[#b478ff]">в 3 раза быстрее SQL/BM25</span>
            </div>
          </div>

          {/* Comparison table */}
          <div className="rounded-xl border border-[#1e1e35] overflow-hidden">
            <table className="w-full text-xs font-mono">
              <thead className="bg-[#141422] text-[#8a8aa3] border-b border-[#1e1e35]">
                <tr>
                  <th className="py-2.5 px-3 text-left">Метрика</th>
                  <th className="py-2.5 px-3 text-left">Текстовый (BM25)</th>
                  <th className="py-2.5 px-3 text-left text-[#00f0ff]">EIDOS Semantic</th>
                  <th className="py-2.5 px-3 text-right">Разница</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e35] bg-[#0c0c16]">
                <tr>
                  <td className="py-2.5 px-3 text-white">Релевантность сложных запросов</td>
                  <td className="py-2.5 px-3 text-[#8a8aa3]">38.5%</td>
                  <td className="py-2.5 px-3 text-[#3ee89a] font-bold">94.8%</td>
                  <td className="py-2.5 px-3 text-right text-[#3ee89a]">+56.3%</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-white">Пустые страницы результатов</td>
                  <td className="py-2.5 px-3 text-[#ff6b9d]">34.2%</td>
                  <td className="py-2.5 px-3 text-[#3ee89a] font-bold">0.0%</td>
                  <td className="py-2.5 px-3 text-right text-[#3ee89a]">-34.2%</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-white">Холодный старт новых товаров</td>
                  <td className="py-2.5 px-3 text-[#8a8aa3]">50+ покупок</td>
                  <td className="py-2.5 px-3 text-[#00f0ff] font-bold">0 покупок</td>
                  <td className="py-2.5 px-3 text-right text-[#00f0ff]">1-й день</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-white">Средний чек (AOV)</td>
                  <td className="py-2.5 px-3 text-[#8a8aa3]">3 450 ₽</td>
                  <td className="py-2.5 px-3 text-[#3ee89a] font-bold">4 210 ₽</td>
                  <td className="py-2.5 px-3 text-right text-[#3ee89a]">+22.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e1e35] bg-[#141422]">
          <button
            onClick={printReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1f1f33] hover:bg-[#2a2a46] text-[#00f0ff] font-mono text-xs font-bold border border-[#00f0ff]/30 transition-all cursor-pointer"
          >
            <Printer size={14} />
            <span>Печать / Сохранить в PDF</span>
          </button>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#3ee89a] text-black font-mono text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.2)]"
          >
            <Download size={14} />
            <span>Скачать отчет в CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
