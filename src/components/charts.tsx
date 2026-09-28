import { useId, useMemo, useState } from 'react';
import { compactMoney, money } from '../lib/types';

export type FlowPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
  projected?: boolean;
};

/** Barras de entradas/saídas por período com a linha do saldo acumulado por cima. */
export function FlowChart({ data, height = 260 }: { data: FlowPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/:/g, '');
  const w = 720;
  const h = height;
  const pad = { t: 18, r: 92, b: 30, l: 8 };
  const inner = { w: w - pad.l - pad.r, h: h - pad.t - pad.b };
  const maxBar = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const balances = data.map((d) => d.balance);
  const bMin = Math.min(0, ...balances);
  const bMax = Math.max(1, ...balances);
  const step = inner.w / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(18, step * 0.32));
  const y = (v: number) => pad.t + inner.h - (v / maxBar) * inner.h * 0.92;
  const by = (v: number) => pad.t + inner.h - ((v - bMin) / (bMax - bMin || 1)) * inner.h * 0.9;
  const cx = (i: number) => pad.l + step * i + step / 2;
  const line = data
    .map((d, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${by(d.balance).toFixed(1)}`)
    .join(' ');
  const firstProjected = data.findIndex((d) => d.projected);
  const area = data.length
    ? `${line} L${cx(data.length - 1)},${pad.t + inner.h} L${cx(0)},${pad.t + inner.h} Z`
    : '';
  const labelEvery = Math.ceil(data.length / 10);
  const active = hover !== null ? data[hover] : null;
  return (
    <div className="flow-chart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Fluxo de caixa: entradas, saídas e saldo acumulado"
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`in${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--green)" />
            <stop offset="1" stopColor="var(--green)" stopOpacity=".35" />
          </linearGradient>
          <linearGradient id={`out${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--red)" />
            <stop offset="1" stopColor="var(--red)" stopOpacity=".35" />
          </linearGradient>
          <linearGradient id={`area${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--amber)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--amber)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((k) => (
          <line
            key={k}
            className="grid"
            x1={pad.l}
            x2={w - pad.r}
            y1={pad.t + inner.h * k}
            y2={pad.t + inner.h * k}
          />
        ))}
        {[bMax, (bMax + bMin) / 2, bMin].map((v, i) => (
          <text key={i} className="axis" x={w - pad.r + 8} y={by(v) + 4}>
            {compactMoney(Math.round(v))}
          </text>
        ))}
        {firstProjected > 0 && (
          <rect
            className="projected-zone"
            x={cx(firstProjected) - step / 2}
            y={pad.t}
            width={w - pad.r - (cx(firstProjected) - step / 2)}
            height={inner.h}
          />
        )}
        {data.map((d, i) => (
          <g
            key={d.key}
            className={`flow-col ${hover === i ? 'hover' : ''} ${d.projected ? 'projected' : ''}`}
            onPointerEnter={() => setHover(i)}
          >
            <rect
              className="hit"
              x={cx(i) - step / 2}
              y={pad.t}
              width={step}
              height={inner.h + pad.b}
            />
            <rect
              className="bar-in"
              x={cx(i) - barW - 1}
              width={barW}
              y={y(d.income)}
              height={pad.t + inner.h - y(d.income)}
              rx={2}
              fill={`url(#in${id})`}
              style={{ animationDelay: `${i * 18}ms` }}
            />
            <rect
              className="bar-out"
              x={cx(i) + 1}
              width={barW}
              y={y(d.expense)}
              height={pad.t + inner.h - y(d.expense)}
              rx={2}
              fill={`url(#out${id})`}
              style={{ animationDelay: `${i * 18 + 60}ms` }}
            />
            {i % labelEvery === 0 && (
              <text className="axis" x={cx(i)} y={h - 8} textAnchor="middle">
                {d.label}
              </text>
            )}
          </g>
        ))}
        <path d={area} fill={`url(#area${id})`} className="balance-area" />
        <path d={line} className="balance-line" pathLength={1} />
        {active && hover !== null && (
          <g className="cursor">
            <line x1={cx(hover)} x2={cx(hover)} y1={pad.t} y2={pad.t + inner.h} />
            <circle cx={cx(hover)} cy={by(active.balance)} r={5} />
          </g>
        )}
      </svg>
      {active && hover !== null && (
        <div className="chart-tip" style={{ left: `${(cx(hover) / w) * 100}%` }}>
          <strong>
            {active.label}
            {active.projected ? ' · previsto' : ''}
          </strong>
          <span className="in">Entradas {money(active.income)}</span>
          <span className="out">Saídas {money(active.expense)}</span>
          <span>Saldo {money(active.balance)}</span>
        </div>
      )}
    </div>
  );
}

export type Slice = { label: string; value: number; color: string };
export function Donut({ data, center, sub }: { data: Slice[]; center: string; sub: string }) {
  const total = data.reduce((n, d) => n + d.value, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="donut">
      <svg
        viewBox="0 0 180 180"
        role="img"
        aria-label={`${sub}: ${data.map((d) => `${d.label} ${money(d.value)}`).join(', ')}`}
      >
        <circle cx="90" cy="90" r={r} className="donut-track" />
        {total > 0 &&
          data.map((d, i) => {
            const len = (d.value / total) * c;
            const el = (
              <circle
                key={d.label}
                cx="90"
                cy="90"
                r={r}
                stroke={d.color}
                strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
                strokeDashoffset={-offset}
                className={`donut-slice ${hover === i ? 'hover' : ''}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="donut-center">
        <strong>{hover !== null ? compactMoney(data[hover].value) : center}</strong>
        <span>{hover !== null ? data[hover].label : sub}</span>
      </div>
    </div>
  );
}

export function Gauge({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(1.2, value / goal) : 0;
  const angle = -120 + Math.min(1, pct) * 240;
  const arc = (from: number, to: number, r: number) => {
    const p = (a: number) => {
      const rad = ((a - 90) * Math.PI) / 180;
      return `${100 + r * Math.cos(rad)},${100 + r * Math.sin(rad)}`;
    };
    return `M${p(from)} A${r},${r} 0 ${to - from > 180 ? 1 : 0} 1 ${p(to)}`;
  };
  return (
    <div className="gauge">
      <svg
        viewBox="0 0 200 150"
        role="img"
        aria-label={`Meta atingida em ${(pct * 100).toFixed(0)}%`}
      >
        <path d={arc(-120, 120, 78)} className="gauge-track" />
        <path
          d={arc(-120, 120, 78)}
          className="gauge-fill"
          pathLength={1}
          style={{ strokeDasharray: `${Math.min(1, pct)} 1` }}
        />
        {Array.from({ length: 13 }, (_, i) => {
          const a = ((-120 + i * 20 - 90) * Math.PI) / 180;
          return (
            <line
              key={i}
              className="gauge-tick"
              x1={100 + 62 * Math.cos(a)}
              y1={100 + 62 * Math.sin(a)}
              x2={100 + (i % 3 ? 67 : 70) * Math.cos(a)}
              y2={100 + (i % 3 ? 67 : 70) * Math.sin(a)}
            />
          );
        })}
        <g className="gauge-needle" style={{ transform: `rotate(${angle}deg)` }}>
          <path d="M100,100 L97,98 L100,40 L103,98 Z" />
        </g>
        <circle cx="100" cy="100" r="8" className="gauge-hub" />
      </svg>
      <div className="gauge-value">
        <strong>{goal ? `${(pct * 100).toFixed(0)}%` : '—'}</strong>
        <span>
          {goal ? `da meta de ${compactMoney(goal)}` : 'Defina uma meta em Configurações'}
        </span>
      </div>
    </div>
  );
}

export function Sparkline({ values, className = '' }: { values: number[]; className?: string }) {
  const path = useMemo(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    return values
      .map(
        (v, i) =>
          `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 100).toFixed(1)},${(28 - ((v - min) / (max - min || 1)) * 24).toFixed(1)}`,
      )
      .join(' ');
  }, [values.join(',')]);
  return (
    <svg
      className={`sparkline ${className}`}
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function HBars({ data, format = money }: { data: Slice[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbars">
      {data.map((d, i) => (
        <div className="hbar" key={d.label}>
          <span className="hbar-label">{d.label}</span>
          <span className="hbar-track">
            <span
              className="hbar-fill"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color,
                animationDelay: `${i * 70}ms`,
              }}
            />
          </span>
          <strong>{format(d.value)}</strong>
        </div>
      ))}
    </div>
  );
}
