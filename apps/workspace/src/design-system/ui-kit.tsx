import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}) => {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-900',
    secondary: 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-300',
    ghost: 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600',
  };
  return (
    <button
      type="button"
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', id, ...rest }) => {
  const inputEl = (
    <input
      id={id}
      className={`w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors duration-150 ${className}`.trim()}
      {...rest}
    />
  );
  if (!label) return inputEl;
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-slate-700">{label}</span>
      {inputEl}
    </label>
  );
};

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  inputTestId?: string;
  submitTestId?: string;
  ariaLabel?: string;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Например: наушники для бега',
  submitLabel = 'Найти',
  disabled = false,
  loading = false,
  inputTestId = 'admin-live-search-input',
  submitTestId = 'admin-live-search-submit',
  ariaLabel = 'Поисковый запрос',
}) => {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex items-center gap-2"
      role="search"
    >
      <div className="relative flex-1">
        <input
          type="search"
          data-testid={inputTestId}
          aria-label={ariaLabel}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/15 transition-colors duration-150"
        />
      </div>
      <Button
        type="submit"
        data-testid={submitTestId}
        disabled={disabled || loading}
        variant="primary"
        size="md"
        className="py-2.5 px-5"
      >
        {submitLabel}
      </Button>
    </form>
  );
};

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  active = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      type="button"
      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50 cursor-pointer ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 border-slate-200 hover:text-slate-900'
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
};

export type Tone = 'neutral' | 'success' | 'warning' | 'danger';

export const Badge: React.FC<{
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}> = ({ tone = 'neutral', children, className = '', testId }) => {
  const tones: Record<Tone, string> = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
  };
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${tones[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
};

export const StatusDot: React.FC<{
  status: 'ok' | 'warn' | 'error';
  label?: React.ReactNode;
  className?: string;
  testId?: string;
}> = ({ status, label, className = '', testId }) => {
  const dotColors = {
    ok: 'bg-emerald-600',
    warn: 'bg-amber-500',
    error: 'bg-rose-600',
  };
  const textColors = {
    ok: 'text-slate-700',
    warn: 'text-amber-900',
    error: 'text-rose-800',
  };
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-1.5 text-xs font-medium tabular-nums ${textColors[status]} ${className}`.trim()}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[status]}`} aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
};

export const ScoreBar: React.FC<{
  percent: number;
  showLabel?: boolean;
  className?: string;
}> = ({ percent, showLabel = true, className = '' }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const fillClass =
    clamped >= 70 ? 'bg-emerald-600' : clamped >= 45 ? 'bg-slate-700' : 'bg-amber-500';
  return (
    <div className={`inline-flex items-center gap-2 tabular-nums ${className}`.trim()}>
      <div
        className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0"
        aria-hidden="true"
      >
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${clamped}%` }} />
      </div>
      {showLabel && (
        <span className="font-mono text-xs font-semibold text-slate-900 w-9 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  testId?: string;
}> = ({ children, className = '', elevated = false, testId }) => {
  return (
    <div
      data-testid={testId}
      className={`bg-white border border-slate-200 rounded-[10px] ${
        elevated ? 'shadow-xs' : ''
      } ${className}`.trim()}
    >
      {children}
    </div>
  );
};

export const Banner: React.FC<{
  tone?: Tone;
  children: React.ReactNode;
  action?: React.ReactNode;
  code?: string;
  testId?: string;
  className?: string;
}> = ({ tone = 'neutral', children, action, code, testId, className = '' }) => {
  const tones: Record<Tone, string> = {
    neutral: 'bg-slate-100 border-slate-200 text-slate-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-950',
    danger: 'bg-rose-50 border-rose-200 text-rose-900',
  };
  return (
    <div
      data-testid={testId}
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`px-4 py-3 border rounded-lg text-xs flex flex-wrap items-center justify-between gap-3 ${tones[tone]} ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span>{children}</span>
        {code && (
          <code className="px-1.5 py-0.5 text-[11px] font-mono bg-white/70 border border-current/15 rounded">
            {code}
          </code>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  testId?: string;
}> = ({ title, description, action, testId }) => {
  return (
    <div
      data-testid={testId}
      className="py-10 px-6 text-center max-w-md mx-auto space-y-2.5"
    >
      <div
        className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mx-auto text-sm font-mono"
        aria-hidden="true"
      >
        0
      </div>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {description && <p className="text-xs text-slate-600 leading-relaxed">{description}</p>}
      {action && <div className="pt-1.5 flex justify-center">{action}</div>}
    </div>
  );
};

export const Skeleton: React.FC<{
  rows?: number;
  testId?: string;
}> = ({ rows = 6, testId = 'search-loading-skeleton' }) => {
  return (
    <div data-testid={testId} className="divide-y divide-slate-100" aria-busy="true">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="py-3 px-4 flex items-center justify-between gap-4 animate-pulse">
          <div className="w-5 h-3.5 bg-slate-200 rounded" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-slate-200 rounded w-3/5" />
            <div className="h-2.5 bg-slate-100 rounded w-2/5" />
          </div>
          <div className="w-24 h-3.5 bg-slate-100 rounded hidden sm:block" />
          <div className="w-16 h-3.5 bg-slate-200 rounded" />
          <div className="w-20 h-3.5 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
};

export const KeyValue: React.FC<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}> = ({ label, value, mono = true }) => (
  <div className="p-2.5 border border-slate-200 rounded-md bg-slate-50/60">
    <div className="text-[11px] text-slate-600">{label}</div>
    <div
      className={`text-sm font-semibold text-slate-900 mt-0.5 ${
        mono ? 'font-mono tabular-nums' : ''
      }`}
    >
      {value}
    </div>
  </div>
);

export const Table: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className="overflow-x-auto">
    <table className={`w-full text-left border-collapse text-sm ${className}`.trim()}>
      {children}
    </table>
  </div>
);

export const Tabs: React.FC<{
  options: Array<{ id: string; label: string }>;
  activeId: string;
  onChange: (id: string) => void;
}> = ({ options, activeId, onChange }) => (
  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg" role="tablist">
    {options.map((opt) => {
      const active = opt.id === activeId;
      return (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.id)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            active
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);
