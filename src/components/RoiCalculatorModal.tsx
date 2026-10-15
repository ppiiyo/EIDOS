import React, { useState } from 'react';
import { X, Calculator, DollarSign, TrendingUp, Sparkles } from 'lucide-react';

interface RoiCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPitch?: () => void;
}

export const RoiCalculatorModal: React.FC<RoiCalculatorModalProps> = ({
  isOpen,
  onClose,
  onOpenPitch,
}) => {
  const [monthlyVisitors, setMonthlyVisitors] = useState<number>(100000);
  const [avgOrderValue, setAvgOrderValue] = useState<number>(3500);
  const [baselineConv, setBaselineConv] = useState<number>(2.0); // 2%
  const [expectedUplift, setExpectedUplift] = useState<number>(18); // +18% from vector recs

  if (!isOpen) return null;

  const currentMonthlyOrders = (monthlyVisitors * baselineConv) / 100;
  const currentMonthlyRevenue = currentMonthlyOrders * avgOrderValue;

  const newConv = baselineConv * (1 + expectedUplift / 100);
  const newMonthlyOrders = (monthlyVisitors * newConv) / 100;
  const newMonthlyRevenue = newMonthlyOrders * avgOrderValue;

  const monthlyUpliftRevenue = newMonthlyRevenue - currentMonthlyRevenue;
  const annualUpliftRevenue = monthlyUpliftRevenue * 12;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 580,
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calculator size={20} color="var(--accent)" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>
              RecSys ROI & Value Model
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sec)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
              Monthly Active Users (MAU)
            </label>
            <input
              type="number"
              className="input"
              value={monthlyVisitors}
              onChange={(e) => setMonthlyVisitors(Math.max(100, Number(e.target.value)))}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
              Average Order Value (₽)
            </label>
            <input
              type="number"
              className="input"
              value={avgOrderValue}
              onChange={(e) => setAvgOrderValue(Math.max(10, Number(e.target.value)))}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
              Current Conversion Rate (%)
            </label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={baselineConv}
              onChange={(e) => setBaselineConv(Math.max(0.1, Number(e.target.value)))}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 4 }}>
              Vector Recs Uplift (%)
            </label>
            <input
              type="number"
              step="1"
              className="input"
              value={expectedUplift}
              onChange={(e) => setExpectedUplift(Math.max(1, Number(e.target.value)))}
            />
          </div>
        </div>

        <div
          style={{
            background: 'var(--success-bg)',
            border: '1px solid #A7F3D0',
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.8125rem', color: '#065F46' }}>Estimated Monthly Uplift:</span>
            <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.125rem' }}>
              +{Math.round(monthlyUpliftRevenue).toLocaleString()} ₽
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: '#065F46' }}>Projected Annual Incremental Value:</span>
            <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.125rem' }}>
              +{Math.round(annualUpliftRevenue).toLocaleString()} ₽
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {onOpenPitch && (
            <button
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onOpenPitch();
              }}
            >
              <TrendingUp size={14} />
              View Architecture Pitch
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
