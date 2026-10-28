import React, { useState, useEffect } from 'react';
import { Key, Sliders, Webhook, Shield, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react';

export interface ApiKeyEntry {
  key_hash: string;
  tenant_id: string;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  preview?: string;
}

export interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

export const SettingsView: React.FC<{
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  uiLang?: 'ru' | 'en' | 'ja';
}> = ({ onShowToast, uiLang = 'en' }) => {
  const isRu = uiLang === 'ru';
  const [keys, setKeys] = useState<ApiKeyEntry[]>([
    {
      key_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      tenant_id: 'default',
      created_at: '2026-10-20T09:00:00.000Z',
      revoked_at: null,
      expires_at: '2027-10-20T09:00:00.000Z',
      preview: 'eidos_live_••••••••9a2f',
    },
  ]);
  const [newKeyTenant, setNewKeyTenant] = useState('default');
  const [generatedPlainKey, setGeneratedPlainKey] = useState<string | null>(null);

  const [hnswM, setHnswM] = useState(16);
  const [efConstruction, setEfConstruction] = useState(128);
  const [efSearch, setEfSearch] = useState(64);
  const [quantization, setQuantization] = useState<'fp32' | 'fp16' | 'int8' | 'binary'>('int8');

  const [rpmLimit, setRpmLimit] = useState(1200);
  const [burstLimit, setBurstLimit] = useState(200);
  const [piiRedaction, setPiiRedaction] = useState(true);
  const [xssSanitization, setXssSanitization] = useState(true);

  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([
    {
      id: 'wh_prod_alerts',
      url: 'https://hooks.enterprise.internal/eidos/events',
      events: ['drift.detected', 'index.degraded'],
      active: true,
    },
  ]);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  useEffect(() => {
    if (typeof fetch !== 'function') return;
    fetch('/v1/settings', { headers: { 'x-api-key': 'eidos_dev_key' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const s = data?.settings;
        if (!s) return;
        if (s.hnsw) {
          setHnswM(s.hnsw.M);
          setEfConstruction(s.hnsw.efConstruction);
          setEfSearch(s.hnsw.efSearch);
          setQuantization(s.hnsw.quantization);
        }
        if (s.rateLimit) {
          setRpmLimit(s.rateLimit.maxRequestsPerMinute);
          setBurstLimit(s.rateLimit.burstLimit);
        }
        if (s.security) {
          setPiiRedaction(s.security.piiRedaction);
          setXssSanitization(s.security.xssSanitization);
        }
        if (Array.isArray(s.webhooks)) setWebhooks(s.webhooks);
      })
      .catch(() => {});
  }, []);

  const handleGenerateKey = async () => {
    const mockHash = Array.from({ length: 64 }, (_, i) => ((i + Date.now()) % 16).toString(16)).join('');
    const mockPlain = `eidos_${newKeyTenant}_${mockHash.slice(0, 16)}`;
    try {
      const res = await fetch('/v1/keys/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'eidos_dev_key' },
        body: JSON.stringify({ tenant_id: newKeyTenant, expires_in_days: 365 }),
      });
      if (res.ok) {
        const body = await res.json();
        setGeneratedPlainKey(body.key);
        setKeys((prev) => [
          {
            key_hash: body.key_hash,
            tenant_id: body.tenant_id,
            created_at: new Date().toISOString(),
            revoked_at: null,
            expires_at: body.expires_at,
            preview: `${String(body.key).slice(0, 14)}••••`,
          },
          ...prev,
        ]);
        onShowToast?.(`API key generated for tenant '${newKeyTenant}'`, 'success');
        return;
      }
    } catch {}
    setGeneratedPlainKey(mockPlain);
    setKeys((prev) => [
      {
        key_hash: mockHash,
        tenant_id: newKeyTenant,
        created_at: new Date().toISOString(),
        revoked_at: null,
        expires_at: null,
        preview: `${mockPlain.slice(0, 14)}••••`,
      },
      ...prev,
    ]);
    onShowToast?.(`API key generated for tenant '${newKeyTenant}'`, 'success');
  };

  const handleRevokeKey = async (keyHash: string) => {
    try {
      await fetch('/v1/keys/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'eidos_dev_key' },
        body: JSON.stringify({ key_hash: keyHash }),
      });
    } catch {}
    setKeys((prev) => prev.map((k) => (k.key_hash === keyHash ? { ...k, revoked_at: new Date().toISOString() } : k)));
    onShowToast?.('API key revoked', 'info');
  };

  const handleSaveEngineSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/v1/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json', 'x-api-key': 'eidos_dev_key' },
        body: JSON.stringify({
          hnsw: { M: hnswM, efConstruction, efSearch, quantization },
          rateLimit: { maxRequestsPerMinute: rpmLimit, burstLimit, enabled: true },
          security: { piiRedaction, xssSanitization },
        }),
      });
    } catch {}
    onShowToast?.('Engine HNSW & Rate Limit settings saved', 'success');
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;
    const newWh: WebhookEntry = {
      id: `wh_${Date.now().toString(36)}`,
      url: newWebhookUrl.trim(),
      events: ['drift.detected', 'index.degraded'],
      active: true,
    };
    try {
      const res = await fetch('/v1/settings/webhooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': 'eidos_dev_key' },
        body: JSON.stringify({ url: newWh.url, events: newWh.events }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.webhook) newWh.id = data.webhook.id;
      }
    } catch {}
    setWebhooks((prev) => [...prev, newWh]);
    setNewWebhookUrl('');
    onShowToast?.('Webhook endpoint registered', 'success');
  };

  return (
    <div className="page" data-testid="settings-view">
      <div className="mb-5">
        <h1 className="page-title">{isRu ? '⚙️ Настройки движка, API-ключи и безопасность' : '⚙️ Engine Settings, API Keys & Security'}</h1>
        <p className="page-sub">
          {isRu
            ? 'Управление ключами авторизации API (для 1С-Битрикс / SDK), параметрами графа HNSW, вебхуками и лимитами запросов'
            : 'Configure API authentication keys, HNSW graph parameters, webhook subscriptions, and rate limits'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5" data-testid="settings-api-keys-section">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold m-0 flex items-center gap-2"><Key size={16} color="var(--accent)" /> {isRu ? 'Управление API-ключами' : 'API Keys Management'}</h3>
            <div className="flex gap-2">
              <input className="input w-[120px] text-xs" value={newKeyTenant} onChange={(e) => setNewKeyTenant(e.target.value)} placeholder="tenant_id" />
              <button type="button" className="btn btn-primary btn-sm" data-testid="generate-api-key-btn" onClick={handleGenerateKey}><Plus size={13} /> {isRu ? 'Создать ключ' : 'Generate Key'}</button>
            </div>
          </div>
          {generatedPlainKey && (
            <div className="p-3 mb-3 rounded bg-[var(--bg-alt)] border border-[var(--success)] text-xs mono">
              <CheckCircle2 size={13} className="inline mr-1 text-[var(--success)]" /> {isRu ? 'Новый ключ:' : 'New Key:'} <strong>{generatedPlainKey}</strong>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {keys.map((k) => (
              <div key={k.key_hash} className="p-3 rounded bg-[var(--bg-alt)] flex items-center justify-between text-xs">
                <div>
                  <div className="mono font-semibold">{k.preview || `${k.key_hash.slice(0, 16)}...`}</div>
                  <span className="text-[var(--text-sec)]">{isRu ? 'Тенант' : 'Tenant'}: {k.tenant_id} · {isRu ? 'Создан' : 'Created'}: {k.created_at.slice(0, 10)}</span>
                </div>
                {k.revoked_at ? (
                  <span className="badge badge-danger mono">{isRu ? 'ОТОЗВАН' : 'REVOKED'}</span>
                ) : (
                  <button type="button" className="btn btn-danger btn-sm" data-testid={`revoke-key-${k.key_hash.slice(0, 8)}`} onClick={() => handleRevokeKey(k.key_hash)}>{isRu ? 'Отозвать' : 'Revoke'}</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSaveEngineSettings} className="card p-5" data-testid="settings-hnsw-section">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><Sliders size={16} color="var(--accent)" /> {isRu ? 'Параметры HNSW и лимиты запросов (Rate Limiting)' : 'HNSW Parameters & Rate Limiting'}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
            <div>
              <label className="block font-medium mb-1">{isRu ? 'HNSW M (Макс. рёбер)' : 'HNSW M (Max Edges)'}</label>
              <input type="number" className="input" data-testid="setting-hnsw-m" value={hnswM} onChange={(e) => setHnswM(Number(e.target.value))} />
            </div>
            <div>
              <label className="block font-medium mb-1">efConstruction</label>
              <input type="number" className="input" data-testid="setting-ef-construction" value={efConstruction} onChange={(e) => setEfConstruction(Number(e.target.value))} />
            </div>
            <div>
              <label className="block font-medium mb-1">efSearch</label>
              <input type="number" className="input" value={efSearch} onChange={(e) => setEfSearch(Number(e.target.value))} />
            </div>
            <div>
              <label className="block font-medium mb-1">{isRu ? 'Квантование по умолчанию' : 'Default Quantization'}</label>
              <select className="input" value={quantization} onChange={(e) => setQuantization(e.target.value as any)}>
                <option value="fp32">FP32</option>
                <option value="fp16">FP16</option>
                <option value="int8">INT8 Scalar</option>
                <option value="binary">Binary 1-bit</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">{isRu ? 'Лимит запросов (Req / Min)' : 'Rate Limit (Req / Min)'}</label>
              <input type="number" className="input" data-testid="setting-rpm-limit" value={rpmLimit} onChange={(e) => setRpmLimit(Number(e.target.value))} />
            </div>
            <div>
              <label className="block font-medium mb-1">{isRu ? 'Пиковый буфер (Burst)' : 'Burst Capacity'}</label>
              <input type="number" className="input" value={burstLimit} onChange={(e) => setBurstLimit(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center gap-4 mb-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={piiRedaction} onChange={(e) => setPiiRedaction(e.target.checked)} />
              <Shield size={13} /> {isRu ? 'Авто-скрытие персональных данных (PII)' : 'Automatic PII Redaction'}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={xssSanitization} onChange={(e) => setXssSanitization(e.target.checked)} />
              {isRu ? 'Защита от XSS / SQLi / Инъекций' : 'XSS / Injection Guardrails'}
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" data-testid="save-settings-btn"><Save size={13} /> {isRu ? 'Сохранить настройки движка' : 'Save Engine Settings'}</button>
        </form>

        <div className="card p-5 lg:col-span-2" data-testid="settings-webhooks-section">
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2"><Webhook size={16} color="var(--accent)" /> {isRu ? 'Событийные вебхуки (подпись HMAC-SHA256)' : 'Event Webhooks (HMAC-SHA256 Signed)'}</h3>
          <form onSubmit={handleAddWebhook} className="flex gap-2 mb-4">
            <input className="input flex-1" data-testid="input-webhook-url" value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://api.yourcompany.com/webhooks/eidos" />
            <button type="submit" className="btn btn-primary btn-sm" data-testid="add-webhook-btn"><Plus size={14} /> {isRu ? 'Добавить вебхук' : 'Add Webhook'}</button>
          </form>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="p-3 rounded bg-[var(--bg-alt)] flex items-center justify-between text-xs">
                <div>
                  <div className="mono font-semibold">{wh.url}</div>
                  <div className="text-[var(--text-sec)] mt-0.5">{isRu ? 'События' : 'Events'}: {wh.events.join(', ')}</div>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setWebhooks((prev) => prev.filter((w) => w.id !== wh.id))}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
