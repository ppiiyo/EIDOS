import React, { useState, useEffect } from 'react';
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

export const ABTestView: React.FC = () => {
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
      const r = analyzeExperiment(targetId);
      setResults(r);
    }
  };

  useEffect(refresh, [selected]);

  const handleCreate = () => {
    setErrorMessage(null);
    if (!form.name.trim()) {
      setErrorMessage('Please enter an experiment name.');
      return;
    }
    try {
      const exp = createExperiment({
        name: form.name.trim(),
        description: form.description.trim() || 'Comparing ranking configurations',
        variantNames: [form.controlName, form.variantName],
        trafficSplit: [form.split / 100, 1 - form.split / 100],
        metric: form.metric,
      });
      setShowForm(false);
      setSelected(exp.id);
      setForm((f) => ({ ...f, name: '', description: '' }));
      refresh();
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to create experiment');
    }
  };

  const handleSimulate = (expId: string) => {
    for (let i = 0; i < 200; i++) {
      const uid = `sim_user_${Date.now()}_${i}`;
      const variant = assignVariant(expId, uid);
      const baseProb = variant.includes('Variant') ? 0.085 : 0.048;
      const converted = Math.random() < baseProb;
      recordOutcome(expId, uid, converted, converted ? 49.99 : 0);
    }
    refresh();
  };

  const sel = experiments.find((e) => e.id === selected);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Statistical A/B Experiment Engine</h1>
          <p className="page-sub">
            Deterministic FNV-1a user bucketing with two-tailed Z-test significance evaluation
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> New Experiment
        </button>
      </div>

      {errorMessage && (
        <div
          className="card"
          style={{
            padding: '10px 14px',
            marginBottom: 16,
            borderColor: 'var(--error)',
            color: 'var(--error)',
            fontSize: '0.8125rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Experiment Name
              </label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Hybrid RRF vs Pure Dense Search"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Primary Metric
              </label>
              <select
                className="input"
                value={form.metric}
                onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as any }))}
              >
                <option value="conversion">Conversion rate</option>
                <option value="revenue">Revenue per user</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Control Traffic Split (%)
              </label>
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
              <label style={{ fontSize: '0.8125rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Hypothesis Description
              </label>
              <input
                className="input"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What ranking parameter are you testing?"
              />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCreate}>
              Create Experiment
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {experiments.map((exp) => (
            <button
              key={exp.id}
              type="button"
              onClick={() => setSelected(exp.id)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 8,
                border: selected === exp.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: selected === exp.id ? 'var(--accent-bg)' : 'var(--surface)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{exp.name}</div>
              <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
                {exp.variants.map((v) => v.users).reduce((a, b) => a + b, 0)} users · {exp.status}
              </div>
            </button>
          ))}
          {experiments.length === 0 && (
            <div className="card" style={{ padding: 16, fontSize: '0.8125rem', color: 'var(--text-sec)' }}>
              No experiments created yet. Click "New Experiment" to start testing ranking variants.
            </div>
          )}
        </div>

        {sel && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)' }}>{sel.name}</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)' }}>{sel.description}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSimulate(sel.id)}>
                  <Play size={13} /> Simulate 200 Sessions
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
                    <Square size={13} /> Complete
                  </button>
                )}
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Users</th>
                  <th>Conversions</th>
                  <th>Rate</th>
                  <th>Relative Uplift</th>
                  <th>p-value</th>
                  <th>Statistical Significance</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.variantName}>
                    <td style={{ fontWeight: 600 }}>{r.variantName}</td>
                    <td className="mono">{r.users.toLocaleString()}</td>
                    <td className="mono">{r.conversions.toLocaleString()}</td>
                    <td className="mono">{(r.rate * 100).toFixed(2)}%</td>
                    <td className="mono">
                      {r.uplift === 0 ? (
                        'Baseline'
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: r.uplift > 0 ? 'var(--success)' : 'var(--error)',
                            fontWeight: 600,
                          }}
                        >
                          {r.uplift > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                          {r.uplift > 0 ? '+' : ''}
                          {r.uplift.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: '0.8125rem' }}>
                      {r.pValue < 0.001 ? '< 0.001' : r.pValue.toFixed(4)}
                    </td>
                    <td className="mono" style={{ fontSize: '0.75rem', fontWeight: 600, color: r.significant ? 'var(--success)' : 'var(--text-sec)' }}>
                      {r.significant ? '95% Significant (p < 0.05)' : 'Awaiting sample size'}
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
