import React from 'react';
import type { Color3 } from '../../../fluid-2d/types';

const c3hex = (c: Color3): string =>
  `#${[c[0], c[1], c[2]].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;

const hex2c3 = (h: string): Color3 => {
  const x = h.replace('#', '');
  return [
    parseInt(x.slice(0, 2), 16) / 255,
    parseInt(x.slice(2, 4), 16) / 255,
    parseInt(x.slice(4, 6), 16) / 255,
  ];
};

export const Slider: React.FC<{
  label: string;
  v: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  accent?: string;
  unit?: string;
}> = ({ label, v, min, max, step = 0.01, onChange, accent = '#00e5cc', unit = '' }) => {
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <div className="ctrl-slider">
      <div className="cs-head">
        <span className="cs-label">{label}</span>
        <span className="cs-val">{v.toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : 2)}{unit}</span>
      </div>
      <div className="cs-track">
        <div className="cs-fill" style={{ width: `${pct}%`, background: accent }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={v}
          onChange={e => onChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
};

export const Num: React.FC<{
  label: string;
  v: number;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, v, step = 0.01, onChange }) => (
  <div className="ctrl-num">
    <span className="cn-label">{label}</span>
    <input
      type="number"
      value={v.toFixed(step >= 1 ? 0 : 2)}
      step={step}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
    />
  </div>
);

export const Toggle: React.FC<{
  options: { l: string; v: any }[];
  value: any;
  onChange: (v: any) => void;
  accent?: string;
}> = ({ options, value, onChange, accent = '#00e5cc' }) => (
  <div className="ctrl-toggle">
    {options.map(o => (
      <button
        key={String(o.v)}
        className={value === o.v ? 'active' : ''}
        style={{ '--ta': accent } as React.CSSProperties}
        onClick={() => onChange(o.v)}
      >
        {o.l}
      </button>
    ))}
  </div>
);

export const Color: React.FC<{ c: Color3; onChange: (c: Color3) => void }> = ({ c, onChange }) => (
  <div className="ctrl-color">
    <input type="color" value={c3hex(c)} onChange={e => onChange(hex2c3(e.target.value))} />
    <span>{c3hex(c).toUpperCase()}</span>
  </div>
);

export const Select: React.FC<{
  value: string;
  options: { l: string; v: string }[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
  <select className="ctrl-select" value={value} onChange={e => onChange(e.target.value)}>
    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
);

export const Chip: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: string;
}> = ({ active, onClick, children, accent = '#00e5cc' }) => (
  <button
    className={`ctrl-chip ${active ? 'active' : ''}`}
    style={{ '--ca': accent } as React.CSSProperties}
    onClick={onClick}
  >
    {children}
  </button>
);

export const Divider: React.FC<{ children: React.ReactNode; accent?: string }> = ({ children, accent = '#00e5cc' }) => (
  <div className="divider" style={{ '--da': accent } as React.CSSProperties}>
    <span>{children}</span>
    <div className="div-line" />
  </div>
);
