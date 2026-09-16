import React from 'react';
import { Project, Edge, Cluster, GraphMetrics, Insight } from '../types';
import { FileJson, FileText, Table, Image, Copy, Printer } from 'lucide-react';

interface ExportViewProps {
  project: Project;
  matrix: Float32Array[] | null;
  edges: Edge[];
  clusters: Cluster[];
  metrics: GraphMetrics | null;
  insights: Insight[];
  onShowToast: (msg: string, type: 'info' | 'success' | 'error') => void;
}

export const ExportView: React.FC<ExportViewProps> = ({
  project,
  matrix,
  edges,
  clusters,
  metrics,
  insights,
  onShowToast,
}) => {
  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`Файл сохранён: ${filename}`, 'success');
  };

  const getTimestamp = () => {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  };

  const handleExportJSON = () => {
    if (!metrics) {
      onShowToast('Сначала запустите анализ', 'error');
      return;
    }
    const data = {
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        concepts: project.concepts.map((c) => c.name),
      },
      metrics: {
        entropy: metrics.entropy,
        normalizedEntropy: metrics.normalizedEntropy,
        density: metrics.density,
        avgSim: metrics.avgSim,
        maxSim: metrics.maxSim,
        minSim: metrics.minSim,
        diameter: metrics.diameter,
        clustering: metrics.clustering,
      },
      clusters: clusters.map((c) => ({
        id: c.id,
        name: c.name,
        concepts: c.concepts,
        cohesion: c.cohesion,
      })),
      edges: edges.map((e) => ({
        from: e.from,
        to: e.to,
        similarity: parseFloat(e.sim.toFixed(4)),
      })),
      insights: insights.map((i) => ({
        type: i.type,
        title: i.title,
        text: i.text,
        concepts: i.concepts,
        metric: i.metric,
        metricLabel: i.metricLabel,
      })),
      similarityMatrix: matrix ? matrix.map((row) => Array.from(row)) : [],
    };

    downloadFile(
      `eidos-${project.name.toLowerCase().replace(/\s+/g, '_')}-${getTimestamp()}.json`,
      JSON.stringify(data, null, 2),
      'application/json'
    );
  };

  const handleExportMarkdown = () => {
    if (!metrics) {
      onShowToast('Сначала запустите анализ', 'error');
      return;
    }
    const L: string[] = [];
    L.push(`# EIDOS — ${project.name}`);
    L.push(`*Семантический отчет и картирование смыслового поля · ${new Date().toLocaleString('ru-RU')}*\n`);

    L.push(`## 1. Системные метрики графа\n`);
    L.push(`| Параметр | Значение | Описание |`);
    L.push(`|:---|:---|:---|`);
    L.push(`| **Концептов (N)** | ${project.concepts.length} | Количество узлов в смысловом поле |`);
    L.push(`| **Активных связей (E)** | ${edges.length} | Пары с сходством выше порога |`);
    L.push(`| **Плотность (ρ)** | ${(metrics.density * 100).toFixed(1)}% | Доля реализованных ассоциативных связей |`);
    L.push(`| **Энтропия (H)** | ${metrics.entropy.toFixed(2)} (${(metrics.normalizedEntropy * 100).toFixed(0)}%) | Мера смысловой вариативности и сложности |`);
    L.push(`| **Среднее сходство (μ)** | ${(metrics.avgSim * 100).toFixed(1)}% | Общая семантическая когерентность поля |`);
    L.push(`| **Диаметр (D)** | ${metrics.diameter} | Длина максимального кратчайшего пути |`);
    L.push(`| **Кластеризация (CC)** | ${(metrics.clustering * 100).toFixed(1)}% | Коэффициент локальной связности |`);
    L.push(`| **Кластеров (K)** | ${clusters.length} | Количество автономных семантических групп |\n`);

    L.push(`## 2. Топ семантических пар\n`);
    edges.slice(0, 15).forEach((e, idx) => {
      L.push(`${idx + 1}. **${e.from}** ↔ **${e.to}** — *${(e.sim * 100).toFixed(1)}%*`);
    });

    L.push(`\n## 3. Выделенные кластеры\n`);
    clusters.forEach((c) => {
      L.push(`### ${c.name} (когезия: ${(c.cohesion * 100).toFixed(0)}%)`);
      L.push(`Концепты: ${c.concepts.map((x) => `\`${x}\``).join(', ')}\n`);
    });

    L.push(`## 4. Сгенерированные инсайты и гипотезы\n`);
    insights.forEach((ins) => {
      L.push(`#### [${ins.type.toUpperCase()}] ${ins.title}`);
      L.push(`${ins.text}`);
      L.push(`*Метрика (${ins.metricLabel}): ${ins.metric < 1 ? (ins.metric * 100).toFixed(0) + '%' : ins.metric.toFixed(2)}*\n`);
    });

    L.push(`---\n*Сформировано на платформе EIDOS Semantic Ideation*`);

    downloadFile(
      `eidos-${project.name.toLowerCase().replace(/\s+/g, '_')}-${getTimestamp()}.md`,
      L.join('\n'),
      'text/markdown'
    );
  };

  const handleExportCSV = () => {
    if (edges.length === 0) {
      onShowToast('Нет связей для экспорта', 'error');
      return;
    }
    const rows = [['Source', 'Target', 'Similarity', 'Percent']];
    for (const e of edges) {
      rows.push([e.from, e.to, e.sim.toFixed(4), `${(e.sim * 100).toFixed(1)}%`]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    downloadFile(
      `eidos-edges-${getTimestamp()}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    );
  };

  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      onShowToast('Холст графа не найден', 'error');
      return;
    }
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `eidos-graph-${getTimestamp()}.png`;
    a.click();
    onShowToast('Снимок графа сохранен', 'success');
  };

  const handleCopyInsights = () => {
    if (insights.length === 0) {
      onShowToast('Нет инсайтов для копирования', 'error');
      return;
    }
    const txt = insights
      .map(
        (i) =>
          `• [${i.type.toUpperCase()}] ${i.title}\n  ${i.text}\n  (${i.metricLabel}: ${
            i.metric < 1 ? (i.metric * 100).toFixed(0) + '%' : i.metric.toFixed(2)
          })`
      )
      .join('\n\n');

    navigator.clipboard.writeText(txt).then(() => {
      onShowToast('Инсайты скопированы в буфер обмена', 'success');
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 overflow-y-auto h-full space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[#e8e8f0] mb-1">
          Экспорт и синхронизация
        </h3>
        <p className="text-xs text-[#8a8aa3]">
          Сохраните аналитические расчеты, семантический граф или инсайты в удобном формате.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* JSON */}
        <button
          onClick={handleExportJSON}
          className="p-5 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/50 border border-[#1e1e35] hover:border-[#00e5ff] hover:shadow-[0_0_20px_rgba(0,229,255,0.15)] transition-all text-left flex flex-col gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-[#00e5ff]/10 text-[#00e5ff] flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileJson size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#e8e8f0] group-hover:text-[#00e5ff] transition-colors">
              JSON Data
            </h4>
            <p className="text-xs text-[#8a8aa3] mt-1 leading-relaxed">
              Полный структурированный массив: концепты, матрица схожести, кластеры, топологические метрики и инсайты.
            </p>
          </div>
        </button>

        {/* Markdown */}
        <button
          onClick={handleExportMarkdown}
          className="p-5 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/50 border border-[#1e1e35] hover:border-[#b478ff] hover:shadow-[0_0_20px_rgba(180,120,255,0.15)] transition-all text-left flex flex-col gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-[#b478ff]/10 text-[#b478ff] flex items-center justify-center group-hover:scale-105 transition-transform">
            <FileText size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#e8e8f0] group-hover:text-[#b478ff] transition-colors">
              Markdown Отчет
            </h4>
            <p className="text-xs text-[#8a8aa3] mt-1 leading-relaxed">
              Форматированный документ с таблицами, метриками и выводами. Идеален для Obsidian, Notion или GitHub.
            </p>
          </div>
        </button>

        {/* CSV */}
        <button
          onClick={handleExportCSV}
          className="p-5 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/50 border border-[#1e1e35] hover:border-[#3ee89a] hover:shadow-[0_0_20px_rgba(62,232,154,0.15)] transition-all text-left flex flex-col gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-[#3ee89a]/10 text-[#3ee89a] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Table size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#e8e8f0] group-hover:text-[#3ee89a] transition-colors">
              CSV Таблица связей
            </h4>
            <p className="text-xs text-[#8a8aa3] mt-1 leading-relaxed">
              Список всех ассоциированных пар узлов с коэффициентами похожести для Excel, Google Таблиц или Gephi.
            </p>
          </div>
        </button>

        {/* PNG Snapshot */}
        <button
          onClick={handleExportPNG}
          className="p-5 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/50 border border-[#1e1e35] hover:border-[#ffbe3d] hover:shadow-[0_0_20px_rgba(255,190,61,0.15)] transition-all text-left flex flex-col gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-[#ffbe3d]/10 text-[#ffbe3d] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Image size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#e8e8f0] group-hover:text-[#ffbe3d] transition-colors">
              PNG Снимок графа
            </h4>
            <p className="text-xs text-[#8a8aa3] mt-1 leading-relaxed">
              Экспорт изображения текущего состояния семантической карты высокого разрешения для презентаций.
            </p>
          </div>
        </button>

        {/* Copy to Clipboard */}
        <button
          onClick={handleCopyInsights}
          className="p-5 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/50 border border-[#1e1e35] hover:border-[#ff6b9d] hover:shadow-[0_0_20px_rgba(255,107,157,0.15)] transition-all text-left flex flex-col gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-[#ff6b9d]/10 text-[#ff6b9d] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Copy size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#e8e8f0] group-hover:text-[#ff6b9d] transition-colors">
              Копировать инсайты
            </h4>
            <p className="text-xs text-[#8a8aa3] mt-1 leading-relaxed">
              Текстовая выжимка всех инсайтов прямо в буфер обмена для быстрой отправки коллегам или в чат.
            </p>
          </div>
        </button>

        {/* Print / PDF */}
        <button
          onClick={handlePrint}
          className="p-5 rounded-xl bg-gradient-to-br from-[#15152a]/70 to-[#111120]/50 border border-[#1e1e35] hover:border-[#5aa9ff] hover:shadow-[0_0_20px_rgba(90,169,255,0.15)] transition-all text-left flex flex-col gap-2 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-lg bg-[#5aa9ff]/10 text-[#5aa9ff] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Printer size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#e8e8f0] group-hover:text-[#5aa9ff] transition-colors">
              Печать / Сохранить в PDF
            </h4>
            <p className="text-xs text-[#8a8aa3] mt-1 leading-relaxed">
              Вызов диалога системной печати браузера для мгновенного сохранения отчета в PDF.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
};
