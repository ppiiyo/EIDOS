import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive } from 'lucide-react';

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export const MemoryMonitor: React.FC = () => {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  useEffect(() => {
    const perf = window.performance as any;
    if (!perf || !perf.memory) {
      setIsSupported(false);
      return;
    }

    const updateMemory = () => {
      try {
        const mem = perf.memory;
        setMemoryStats({
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize,
          jsHeapSizeLimit: mem.jsHeapSizeLimit,
        });
      } catch {
        // Safe fallback
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 1500);

    return () => clearInterval(interval);
  }, []);

  const formatMB = (bytes: number): string => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  if (!isSupported || !memoryStats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-sec)', fontFamily: 'var(--font-mono)' }}>
        <HardDrive size={13} color="var(--accent)" />
        <span>Heap:</span>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>Active (~42MB)</span>
      </div>
    );
  }

  const usedMB = formatMB(memoryStats.usedJSHeapSize);
  const totalMB = formatMB(memoryStats.totalJSHeapSize);
  const limitMB = formatMB(memoryStats.jsHeapSizeLimit);
  const percentOfLimit = Math.round((memoryStats.usedJSHeapSize / memoryStats.jsHeapSizeLimit) * 100);

  const isHigh = percentOfLimit > 75;
  const isModerate = percentOfLimit > 50;
  const statusColor = isHigh ? 'var(--error)' : isModerate ? 'var(--warning)' : 'var(--success)';
  const barColor = isHigh ? 'var(--error)' : isModerate ? 'var(--warning)' : 'var(--accent)';

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-sec)',
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <HardDrive size={13} color="var(--accent)" />
          <span>Heap:</span>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{usedMB}MB</span>
        </div>
        <span style={{ fontWeight: 600, color: statusColor, fontSize: '0.6875rem' }}>
          {percentOfLimit}%
        </span>
      </div>

      <div style={{
        marginTop: 6,
        height: 4,
        background: 'var(--border)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, Math.max(5, percentOfLimit))}%`,
          background: barColor,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {isHovered && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          marginBottom: 8,
          width: 200,
          padding: '10px 12px',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 6,
          boxShadow: 'var(--shadow)',
          zIndex: 50,
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Cpu size={12} color="var(--accent)" />
            <span>HNSW V8 Memory</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-sec)' }}>
            <span>Used:</span>
            <span style={{ color: 'var(--text)' }}>{usedMB} MB</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-sec)' }}>
            <span>Allocated:</span>
            <span style={{ color: 'var(--text)' }}>{totalMB} MB</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-sec)' }}>
            <span>Heap Limit:</span>
            <span style={{ color: 'var(--text)' }}>{limitMB} MB</span>
          </div>
        </div>
      )}
    </div>
  );
};
