import React, { useState, useEffect } from "react";
import { Plus, Play, Square, TrendingUp, TrendingDown } from 'lucide-react';
import {
  createExperiment,
  listExperiments,
  assignVariant,
  recordOutcome,
  analyzeExperiment,
  completeExperiment,
  Experiment,
  ExperimentResult,
} from '../lib/ab-testing/engine';

export const ABTestView: React.FC<{ uiLang?: 'ru' | 'en' | 'ja' }> = ({ uiLang = 'en' }) => {
  const isRu = uiLang === 'ru';
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<ExperimentResult[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    metric: 'conversion' as const,
    controlName: 'Control (Pure Dense)',
    variantName: 'Variant A (Hybrid RRF + MMR)',
    split: 50,
  });

  const refresh = () => {
    const exps = listExperiments();
    setExperiments(exps);
    if (!selected && exps.length > 0) {
      setSelected(exps[0].id);
    }
    const targetId = selected || exps[0]?.id;
    if (targetId) {
      setResults(analyzeExperiment(targetId));
    }
  };

  useEffect(refresh, [selected]);

  const handleCreate = () => {
    setErrorMessage(null);
    if (!form.name.trim()) {
      setErrorMessage(isRu ? 'Пожалуйста, укажите название эксперимента.' : 'Please enter an experiment name.');
      return;
    }
    try {
      const exp = createExperiment({
        name: form.name.trim(),
        description: form.description.trim() || (isRu ? 'Сравнение параметров ранжирования' : 'Comparing ranking configurations'),
        variantNames: [form.controlName, form.variantName],
        trafficSplit: [form.split / 100, 1 - form.split / 100],
        metric: form.metric,
      });
      setShowForm(false);
      setSelected(exp.id);
      setForm((f) => ({ ...f, name: '', description: '' }));
      refresh();
    } catch (e: any) {
      setErrorMessage(e.message || (isRu ? 'Не удалось создать эксперимент' : 'Failed to create experiment'));
    }
  };

  const handleSimulate = (expId: string) => {
    let seed = 20261020 + expId.length;
    const nextRand = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 200; i++) {
      const uid = `sim_user_${expId}_${i}`;
      const variant = assignVariant(expId, uid);
      const baseProb = variant.includes('Variant') ? 0.085 : 0.048;
      const converted = nextRand() < baseProb;
      recordOutcome(expId, uid, converted, converted ? 49.99 : 0);
    }
    refresh();
  };

  const sel = experiments.find((e) => e.id === selected);

  return (
    <div className="page">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="page-title">
            {isRu ? '🧪 Статистический движок A/B-экспериментов' : 'Statistical A/B Experiment Engine'}
          </h1>
          <p className="page-sub">
            {isRu
              ? 'Детерминированное FNV-1a распределение пользователей по группам и двусторонний Z-тест статистической значимости'
              : 'Deterministic FNV-1a user bucketing with two-tailed Z-test significance evaluation'}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> {isRu ? 'Новый эксперимент' : 'New Experiment'}
        </button>
      </div>

      {errorMessage && (
        <div className="card px-3.5 py-2.5 mb-4 border-[var(--error)] text-[var(--error)] text-[0.8125rem]">
          {errorMessage}
        </div>
      )}

      {showForm && (
        <div className="card p-5 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[0.8125rem] font-medium block mb-1">{isRu ? 'Название эксперимента' : 'Experiment Name'}</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Hybrid RRF vs Pure Dense Search"
              />
            </div>
            <div>
              <label className="text-[0.8125rem] font-medium block mb-1">{isRu ? 'Целевая метрика' : 'Primary Metric'}</label>
              <select
                className="input"
                value={form.metric}
                onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as any }))}
              >
                <option value="conversion">{isRu ? 'Конверсия в покупку (CR)' : 'Conversion rate'}</option>
                <option value="revenue">{isRu ? 'Выручка на пользователя (ARPU)' : 'Revenue per user'}</option>
              </select>
            </div>
            <div>
              <label className="text-[0.8125rem] font-medium block mb-1">{isRu ? 'Доля трафика Control (%)' : 'Control Traffic Split (%)'}</label>
              <input
                className="input"
                type="number"
                min={10}
                max={90}
                value={form.split}
                onChange={(e) => setForm((f) => ({ ...f, split: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-[0.8125rem] font-medium block mb-1">{isRu ? 'Описание гипотезы' : 'Hypothesis Description'}</label>
              <input
                className="input"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={isRu ? 'Какой параметр ранжирования тестируем?' : 'What ranking parameter are you testing?'}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCreate}>
              {isRu ? 'Создать эксперимент' : 'Create Experiment'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
              {isRu ? 'Отмена' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="flex flex-col gap-2">
          {experiments.map((exp) => (
            <button
              key={exp.id}
              type="button"
              onClick={() => setSelected(exp.id)}
              className={`text-left px-3.5 py-3 rounded-lg border text-[var(--text)] cursor-pointer ${
                selected === exp.id
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
            >
              <div className="font-semibold text-sm">{exp.name}</div>
              <div className="mono text-xs text-[var(--text-sec)] mt-1">
                {exp.variants.map((v) => v.users).reduce((a, b) => a + b, 0)} {isRu ? 'польз.' : 'users'} · {exp.status}
              </div>
            </button>
          ))}
          {experiments.length === 0 && (
            <div className="card p-4 text-[0.8125rem] text-[var(--text-sec)]">
              {isRu ? 'Эксперименты ещё не созданы. Нажмите «Новый эксперимент».' : 'No experiments created yet. Click "New Experiment" to start testing ranking variants.'}
            </div>
          )}
        </div>

        {sel && (
          <div className="card p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-semibold text-base text-[var(--text)]">{sel.name}</h2>
                <p className="text-[0.8125rem] text-[var(--text-sec)]">{sel.description}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSimulate(sel.id)}>
                  <Play size={13} /> {isRu ? 'Симулировать 200 сессий' : 'Simulate 200 Sessions'}
                </button>
                {sel.status === 'running' && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      completeExperiment(sel.id);
                      refresh();
                    }}
                  >
                    <Square size={13} /> {isRu ? 'Завершить' : 'Complete'}
                  </button>
                )}
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>{isRu ? 'Вариант' : 'Variant'}</th>
                  <th>{isRu ? 'Пользователи' : 'Users'}</th>
                  <th>{isRu ? 'Конверсии' : 'Conversions'}</th>
                  <th>{isRu ? 'CR (%)' : 'Rate'}</th>
                  <th>{isRu ? 'Прирост (Uplift)' : 'Relative Uplift'}</th>
                  <th>p-value</th>
                  <th>{isRu ? 'Стат. значимость' : 'Statistical Significance'}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.variantName}>
                    <td className="font-semibold">{r.variantName}</td>
                    <td className="mono">{r.users.toLocaleString()}</td>
                    <td className="mono">{r.conversions.toLocaleString()}</td>
                    <td className="mono">{(r.rate * 100).toFixed(2)}%</td>
                    <td className="mono">
                      {r.uplift === 0 ? (
                        isRu ? 'Базовый (Control)' : 'Baseline'
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            r.uplift > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
                          }`}
                        >
                          {r.uplift > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          {r.uplift > 0 ? '+' : ''}
                          {r.uplift.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="mono text-[0.8125rem]">
                      {r.pValue < 0.001 ? '< 0.001' : r.pValue.toFixed(4)}
                    </td>
                    <td
                      className={`mono text-xs font-semibold ${
                        r.significant ? 'text-[var(--success)]' : 'text-[var(--text-sec)]'
                      }`}
                    >
                      {r.significant
                        ? isRu
                          ? 'Значимо 95% (p < 0.05)'
                          : '95% Significant (p < 0.05)'
                        : isRu
                        ? 'Набор выборки'
                        : 'Awaiting sample size'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
