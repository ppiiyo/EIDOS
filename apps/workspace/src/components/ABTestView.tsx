import React, { useState, useEffect } from 'react';
import { Plus, Play, Square, TrendingUp, TrendingDown } from 'lucide-react';
import {
  createExperiment, listExperiments, assignVariant,
  recordOutcome, analyzeExperiment, completeExperiment,
  Experiment, ExperimentResult,
} from '../lib/ab-testing/engine';

export const ABTestView: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<ExperimentResult[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', metric: 'conversion' as const,
    controlName: 'Control', variantName: 'Variant A', split: 50,
  });

  const refresh = () => {
    const exps = listExperiments();
    setExperiments(exps);
    if (selected) {
      const r = analyzeExperiment(selected);
      setResults(r);
    }
  };

  useEffect(refresh, [selected]);

  const handleCreate = () => {
    try {
      const exp = createExperiment({
        name: form.name,
        description: form.description,
        variantNames: [form.controlName, form.variantName],
        trafficSplit: [form.split / 100, 1 - form.split / 100],
        metric: form.metric,
      });
      setShowForm(false);
      setSelected(exp.id);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSimulate = (expId: string) => {
    // Симуляция 200 пользователей для демонстрации
    for (let i = 0; i < 200; i++) {
      const uid = `sim_user_${Date.now()}_${i}`;
      assignVariant(expId, uid);
      const converted = Math.random() < 0.05;
      recordOutcome(expId, uid, converted, converted ? 49.99 : 0);
    }
    refresh();
  };

  const sel = experiments.find(e => e.id === selected);

  return (
    <div className="page">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">A/B Testing</h1>
          <p className="page-sub">Statistical experiment engine with z-test significance</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={15}/> New Experiment
        </button>
      </div>

      {/* Форма создания */}
      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{fontSize:'0.8125rem',fontWeight:500,display:'block',marginBottom:4}}>
                Experiment name
              </label>
              <input className="input" value={form.name}
                onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                placeholder="e.g. New recommendation layout"/>
            </div>
            <div>
              <label style={{fontSize:'0.8125rem',fontWeight:500,display:'block',marginBottom:4}}>
                Primary metric
              </label>
              <select className="input" value={form.metric}
                onChange={e=>setForm(f=>({...f,metric:e.target.value as any}))}>
                <option value="conversion">Conversion rate</option>
                <option value="revenue">Revenue per user</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:'0.8125rem',fontWeight:500,display:'block',marginBottom:4}}>
                Traffic split (%)
              </label>
              <input className="input" type="number" min={10} max={90} value={form.split}
                onChange={e=>setForm(f=>({...f,split:Number(e.target.value)}))}/>
            </div>
            <div>
              <label style={{fontSize:'0.8125rem',fontWeight:500,display:'block',marginBottom:4}}>
                Description
              </label>
              <input className="input" value={form.description}
                onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                placeholder="What are you testing?"/>
            </div>
          </div>
          <div style={{marginTop:16, display:'flex', gap:8}}>
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>Create</button>
            <button className="btn btn-secondary btn-sm" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Список экспериментов */}
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {experiments.map(exp => (
            <button key={exp.id} onClick={()=>setSelected(exp.id)}
              style={{
                textAlign:'left', padding:'12px 14px', borderRadius:8,
                border: selected===exp.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: selected===exp.id ? 'var(--accent-bg)' : '#fff',
                cursor:'pointer',
              }}>
              <div style={{fontWeight:600, fontSize:'0.875rem'}}>{exp.name}</div>
              <div style={{fontSize:'0.75rem', color:'var(--text-sec)', marginTop:2}}>
                {exp.variants.map(v=>v.users).reduce((a,b)=>a+b,0)} users ·{' '}
                <span className={`badge ${exp.status==='running'?'badge-success':'badge-neutral'}`}>
                  {exp.status}
                </span>
              </div>
            </button>
          ))}
          {experiments.length===0 && (
            <p style={{fontSize:'0.8125rem', color:'var(--text-mut)', padding:8}}>
              No experiments yet
            </p>
          )}
        </div>

        {/* Результаты выбранного */}
        {sel && (
          <div className="card" style={{ padding:20 }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <h2 style={{fontWeight:600, fontSize:'1rem'}}>{sel.name}</h2>
                <p style={{fontSize:'0.8125rem', color:'var(--text-sec)'}}>{sel.description}</p>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-secondary btn-sm" onClick={()=>handleSimulate(sel.id)}>
                  <Play size={13}/> Simulate 200 users
                </button>
                {sel.status==='running' && (
                  <button className="btn btn-danger btn-sm"
                    onClick={()=>{completeExperiment(sel.id);refresh();}}>
                    <Square size={13}/> Complete
                  </button>
                )}
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Variant</th><th>Users</th><th>Conversions</th>
                  <th>Rate</th><th>Uplift</th><th>p-value</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.variantName}>
                    <td style={{fontWeight:500}}>{r.variantName}</td>
                    <td>{r.users}</td>
                    <td>{r.conversions}</td>
                    <td>{(r.rate*100).toFixed(2)}%</td>
                    <td>
                      {r.uplift === 0 ? '—' : (
                        <span style={{display:'flex',alignItems:'center',gap:4,
                          color: r.uplift>0?'var(--success)':'var(--error)'}}>
                          {r.uplift>0?<TrendingUp size={13}/>:<TrendingDown size={13}/>}
                          {r.uplift>0?'+':''}{r.uplift.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td style={{fontFamily:'var(--font-mono)', fontSize:'0.8125rem'}}>
                      {r.pValue < 0.001 ? '<0.001' : r.pValue.toFixed(4)}
                    </td>
                    <td>
                      <span className={`badge ${r.significant?'badge-success':'badge-neutral'}`}>
                        {r.significant ? 'Significant' : 'Not significant'}
                      </span>
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
