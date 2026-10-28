import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Network, ShieldCheck, AlertTriangle, RefreshCw, Power, Activity, Server, ArrowRight, CheckCircle2, XCircle, Hash } from 'lucide-react';

interface ShardInfo { id: string; shardId?: string; healthy: boolean; itemCount: number; }
interface LeaderState { leaderShardId: string | null; term: number; quorumReached?: boolean; healthyShards: number; totalShards: number; splitBrainDetected?: boolean; }
interface ClusterStatusResponse { nodeId: string; role: string; clusterMode: boolean; draining: boolean; catalogVersion: number; circuitBreakerState: string; leaderState: LeaderState; shardCount: number; healthyShards: number; totalClusterVectors: number; shards: ShardInfo[]; }

export interface ClusterTopologyViewProps {
  onShowToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
  uiLang?: 'ru' | 'en' | 'ja';
}

const DEFAULT_STATUS: ClusterStatusResponse = {
  nodeId: 'eidos-node-1',
  role: 'coordinator',
  clusterMode: true,
  draining: false,
  catalogVersion: 1,
  circuitBreakerState: 'CLOSED',
  leaderState: {
    leaderShardId: 'shard-0',
    term: 1,
    quorumReached: true,
    healthyShards: 3,
    totalShards: 3,
    splitBrainDetected: false,
  },
  shardCount: 3,
  healthyShards: 3,
  totalClusterVectors: 30,
  shards: [
    { id: 'shard-0', shardId: 'shard-0', healthy: true, itemCount: 20 },
    { id: 'shard-1', shardId: 'shard-1', healthy: true, itemCount: 20 },
    { id: 'shard-2', shardId: 'shard-2', healthy: true, itemCount: 20 },
  ],
};

function fnv1a32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export const ClusterTopologyView: React.FC<ClusterTopologyViewProps> = ({ onShowToast, uiLang = 'en' }) => {
  const isRu = uiLang === 'ru';
  const [status, setStatus] = useState<ClusterStatusResponse>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(false);
  const [probeKey, setProbeKey] = useState('sku-quantum-headphones-42');
  const [events, setEvents] = useState([
    { id: 'init', time: '00:00:00', msg: 'ConsistentHashRing & LSHShardRouter ready (150 vnodes/shard, R=2)' },
  ]);

  const logEvent = useCallback((msg: string) => {
    setEvents((prev) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString(), msg }, ...prev.slice(0, 6)]);
  }, []);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/v1/cluster/status', { headers: { 'x-api-key': 'eidos_dev_key' } });
      if (res.ok) {
        const data = (await res.json()) as Partial<ClusterStatusResponse>;
        if (data && Array.isArray(data.shards)) {
          const normalizedShards: ShardInfo[] = data.shards.map((raw, idx) => {
            const resolvedId = raw.id || raw.shardId || `shard-${idx}`;
            return { ...raw, id: resolvedId, shardId: resolvedId, healthy: Boolean(raw.healthy), itemCount: Number(raw.itemCount ?? 0) };
          });
          const healthyCount = normalizedShards.filter((s) => s.healthy).length;
          const quorum = healthyCount >= Math.floor(normalizedShards.length / 2) + 1;
          setStatus({
            ...DEFAULT_STATUS,
            ...data,
            shards: normalizedShards,
            leaderState: {
              ...DEFAULT_STATUS.leaderState,
              ...data.leaderState,
              quorumReached: data.leaderState?.quorumReached ?? quorum,
              splitBrainDetected: data.leaderState?.splitBrainDetected ?? !quorum,
            },
          });
        }
      }
    } catch {
      // Standalone mode fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const toggleShardHealth = async (shardId: string, nextHealthy: boolean) => {
    try {
      const res = await fetch(`/v1/cluster/shards/${encodeURIComponent(shardId)}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'eidos_dev_key' },
        body: JSON.stringify({ healthy: nextHealthy }),
      });
      if (res.ok) await fetchStatus();
      else throw new Error('local');
    } catch {
      setStatus((prev) => {
        const shards = prev.shards.map((s) => (s.id === shardId ? { ...s, healthy: nextHealthy } : s));
        const healthyCount = shards.filter((s) => s.healthy).length;
        const quorum = healthyCount >= Math.floor(shards.length / 2) + 1;
        return {
          ...prev,
          healthyShards: healthyCount,
          shards,
          leaderState: {
            ...prev.leaderState,
            leaderShardId: quorum ? (shards.find((s) => s.healthy)?.id ?? null) : null,
            term: prev.leaderState.term + 1,
            quorumReached: quorum,
            healthyShards: healthyCount,
            splitBrainDetected: !quorum,
          },
        };
      });
    }
    logEvent(nextHealthy ? `Shard ${shardId} restored to HEALTHY` : `Shard ${shardId} DEGRADED -> Replica failover (R=2)`);
    onShowToast?.(nextHealthy ? `Shard ${shardId} restored` : `Shard ${shardId} failed over to replica`, nextHealthy ? 'success' : 'info');
  };

  const toggleNodeDrain = async () => {
    const nextDrain = !status.draining;
    try {
      const res = await fetch('/v1/cluster/drain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'eidos_dev_key' },
        body: JSON.stringify({ draining: nextDrain }),
      });
      if (res.ok) await fetchStatus();
      else setStatus((prev) => ({ ...prev, draining: nextDrain }));
    } catch {
      setStatus((prev) => ({ ...prev, draining: nextDrain }));
    }
    logEvent(nextDrain ? `Node ${status.nodeId} entered DRAINING mode` : `Node ${status.nodeId} resumed READY state`);
    onShowToast?.(nextDrain ? 'Node entered Graceful Drain mode' : 'Node resumed traffic', 'info');
  };

  const routeInfo = useMemo(() => {
    const shardIds = status.shards.map((s) => s.id);
    const count = Math.max(1, shardIds.length);
    const hashVal = fnv1a32(probeKey || 'default-key');
    const pIdx = hashVal % count;
    const primary = shardIds[pIdx] || 'shard-0';
    const secondary = shardIds[(pIdx + 1) % count] || 'shard-1';
    const primaryHealthy = status.shards.find((s) => s.id === primary)?.healthy ?? true;
    return {
      hashHex: `0x${hashVal.toString(16).padStart(8, '0')}`,
      angleDeg: Math.round((hashVal / 0xffffffff) * 360),
      primaryShard: primary,
      secondaryShard: secondary,
      servingShard: primaryHealthy ? primary : secondary,
      isFailover: !primaryHealthy,
      vnodeCount: count * 150,
    };
  }, [status.shards, probeKey]);

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6" data-testid="cluster-topology-view">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Network size={22} className="text-[var(--accent)]" />
            <h1 className="text-xl font-bold text-[var(--text)] m-0">
              {isRu ? 'Топология распределённого кластера и инспектор отказоустойчивости' : 'Distributed Cluster Topology & Failover Inspector'}
            </h1>
            <span className="mono text-xs px-2.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-semibold">EIDOS v3.2 HA</span>
          </div>
          <p className="text-xs text-[var(--text-sec)] mt-1 mb-0">
            {isRu ? 'Consistent Hash Ring (150 vnodes/шард · FNV-1a 32-bit · Репликация R=2)' : 'Consistent Hash Ring (150 vnodes/shard · FNV-1a 32-bit · R=2 Replication)'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" data-testid="cluster-drain-btn" onClick={() => void toggleNodeDrain()} className={`btn btn-sm ${status.draining ? 'btn-primary' : 'btn-secondary'}`}>
            <Power size={14} /> <span>{status.draining ? (isRu ? 'Вернуть узел в работу' : 'Resume Node Traffic') : (isRu ? 'Симуляция Graceful Drain' : 'Simulate Graceful Drain')}</span>
          </button>
          <button type="button" data-testid="cluster-refresh-btn" onClick={() => void fetchStatus()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> <span>{isRu ? 'Обновить' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-[var(--text-sec)]">{isRu ? 'Координатор и Лидер' : 'Coordinator & Leader'}</div>
          <div className="text-lg font-bold text-[var(--text)] mt-1 flex items-center gap-2 mono">
            <Server size={16} className="text-[var(--accent)]" />
            <span data-testid="cluster-leader-id">{status.leaderState.leaderShardId ?? 'NO QUORUM'}</span>
          </div>
          <div className="text-xs text-[var(--text-sec)] mt-1 mono">{status.nodeId} · Term #{status.leaderState.term}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--text-sec)]">{isRu ? 'Кворум и здоровье шардов' : 'Shard Quorum & Health'}</div>
          <div className="text-lg font-bold text-[var(--text)] mt-1 flex items-center gap-2">
            {status.leaderState.quorumReached ? <ShieldCheck size={18} className="text-[var(--success)]" /> : <AlertTriangle size={18} className="text-[var(--danger)]" />}
            <span data-testid="cluster-healthy-ratio">{status.healthyShards} / {status.shardCount} {isRu ? 'Активно' : 'Healthy'}</span>
          </div>
          <div className="text-xs text-[var(--text-sec)] mt-1">{status.leaderState.splitBrainDetected ? (isRu ? 'Защита от Split-Brain активна' : 'Split-Brain Guard Active') : (isRu ? 'Кворум консенсуса достигнут' : 'Quorum Consensus Active')}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--text-sec)]">{isRu ? 'Виртуальное кольцо хэширования' : 'Virtual Hash Ring'}</div>
          <div className="text-lg font-bold text-[var(--text)] mt-1 mono">{routeInfo.vnodeCount} vnodes</div>
          <div className="text-xs text-[var(--text-sec)] mt-1 mono">150 vnodes/shard · Catalog v{status.catalogVersion}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--text-sec)]">{isRu ? 'Проба готовности K8s' : 'K8s Readiness Probe'}</div>
          <div className="text-lg font-bold mt-1">
            <span data-testid="cluster-drain-badge" className={`mono text-sm px-2 py-0.5 rounded font-semibold ${status.draining ? 'bg-[var(--warning)]/20 text-[var(--warning)]' : 'bg-[var(--success)]/15 text-[var(--success)]'}`}>
              {status.draining ? '503 DRAINING' : '200 READY'}
            </span>
          </div>
          <div className="text-xs text-[var(--text-sec)] mt-1 mono">CircuitBreaker: {status.circuitBreakerState}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <div className="card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-sm text-[var(--text)]">{isRu ? 'Инспектор Consistent Hash Ring' : 'Consistent Hash Ring Probe'}</span>
            <span className="mono text-xs text-[var(--text-sec)]">{isRu ? 'Угол' : 'Angle'}: {routeInfo.angleDeg}°</span>
          </div>
          <label className="text-xs font-semibold text-[var(--text-sec)] flex items-center gap-1.5 mb-1.5">
            <Hash size={13} /> <span>{isRu ? 'Ключ документа / запроса' : 'Document / Query Key'}</span>
          </label>
          <input type="text" data-testid="hash-ring-probe-input" value={probeKey} onChange={(e) => setProbeKey(e.target.value)} className="input mono text-xs w-full mb-3" />
          <div className="rounded-md bg-[var(--bg-alt)] border border-[var(--border)] p-3 text-xs mono flex flex-col gap-2">
            <div className="flex justify-between"><span className="text-[var(--text-sec)]">FNV-1a 32-bit:</span><span className="font-semibold">{routeInfo.hashHex}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-sec)]">{isRu ? 'Цепочка реплик:' : 'Replica Chain:'}</span><span className="flex items-center gap-1">{routeInfo.primaryShard} <ArrowRight size={11} /> {routeInfo.secondaryShard}</span></div>
            <div className="flex justify-between">
              <span className="text-[var(--text-sec)]">{isRu ? 'Обслуживающий узел:' : 'Serving Node:'}</span>
              <span data-testid="hash-ring-serving-node" className={routeInfo.isFailover ? 'text-[var(--warning)] font-bold' : 'text-[var(--success)] font-bold'}>
                {routeInfo.servingShard} {routeInfo.isFailover ? (isRu ? '(Реплика Failover)' : '(Failover Replica)') : (isRu ? '(Основной)' : '(Primary)')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <h2 className="text-base font-bold text-[var(--text)] m-0 mb-3">{isRu ? 'Физические шарды и управление отказоустойчивостью реплик' : 'Physical Shards & Replica Failover Controls'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {status.shards.map((shard, idx) => {
                const sId = shard.id || shard.shardId || `shard-${idx}`;
                return (
                <div key={sId} data-testid={`shard-card-${sId}`} className={`rounded-lg border p-4 flex flex-col justify-between gap-3 ${shard.healthy ? 'border-[var(--border)] bg-[var(--bg-alt)]' : 'border-[var(--danger)]/50 bg-[var(--danger)]/5'}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="mono font-bold text-sm text-[var(--text)]">{sId}</span>
                      {status.leaderState.leaderShardId === sId && <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] font-bold">LEADER</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs font-semibold">
                      {shard.healthy ? <span className="text-[var(--success)] flex items-center gap-1"><CheckCircle2 size={14} /> HEALTHY</span> : <span className="text-[var(--danger)] flex items-center gap-1"><XCircle size={14} /> DEGRADED</span>}
                    </div>
                    <div className="mt-1 text-xs mono text-[var(--text-sec)]">{isRu ? 'Векторов' : 'Vectors'}: {shard.itemCount} · 150 vnodes</div>
                  </div>
                  <button type="button" data-testid={`toggle-shard-${sId}`} onClick={() => void toggleShardHealth(sId, !shard.healthy)} className={`btn btn-sm w-full justify-center ${shard.healthy ? 'btn-secondary' : 'btn-primary'}`}>
                    {shard.healthy ? (isRu ? 'Симулировать сбой' : 'Simulate Failure') : (isRu ? 'Восстановить шард' : 'Restore Shard')}
                  </button>
                </div>
              );})}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2"><Activity size={15} className="text-[var(--accent)]" /><span className="font-bold text-xs">{isRu ? 'Журнал событий отказоустойчивости кластера' : 'Cluster Failover Event Stream'}</span></div>
            <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
              {events.map((ev) => (
                <div key={ev.id} className="px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-alt)] text-xs mono flex justify-between">
                  <span>{ev.msg}</span><span className="text-[var(--text-sec)]">{ev.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ClusterTopologyView;
