import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Cog,
  ImagePlus,
  PackageOpen,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { labels, type Channel } from '../lib/types';
import { useStore, usePhotoUrls } from '../lib/store';

/* ------------------------------------------------------------------ marca */
export function Logo({ size = 40 }: { size?: number }) {
  // Porca sextavada com "P" vazado: a marca Pixote.
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="nut" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd666" />
          <stop offset=".55" stopColor="#ffb400" />
          <stop offset="1" stopColor="#c77700" />
        </linearGradient>
      </defs>
      <path
        d="M24 2.5 42.6 13.25v21.5L24 45.5 5.4 34.75v-21.5Z"
        fill="url(#nut)"
        stroke="#7a4a00"
        strokeWidth="1.2"
      />
      <path d="M24 7 38.7 15.5v17L24 41 9.3 32.5v-17Z" fill="none" stroke="#fff3" />
      <path
        d="M18 34V14h8.2c4.3 0 7.3 2.6 7.3 6.4s-3 6.4-7.3 6.4H22.6V34Z M22.6 18.2v4.5h3.3c1.6 0 2.7-.9 2.7-2.25s-1.1-2.25-2.7-2.25Z"
        fill="#1a1200"
        fillRule="evenodd"
      />
    </svg>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? 'compact' : ''}`}>
      <Logo size={compact ? 34 : 42} />
      <span className="brand-text">
        <strong>PIXOTE</strong>
        <small>CRM · AUTO PEÇAS & OFICINA</small>
      </span>
    </span>
  );
}
/** Manchas de óleo e sujeira de oficina, fixas atrás da interface. */
export function Grime({ variant = 'app' }: { variant?: 'app' | 'auth' }) {
  return (
    <div className={`grime grime-${variant}`} aria-hidden="true">
      <span className="oil oil-1" />
      <span className="oil oil-2" />
      <span className="oil oil-3" />
      <span className="oil oil-4" />
      <span className="drip drip-1" />
      <span className="drip drip-2" />
      <span className="drip drip-3" />
    </div>
  );
}
/** Inclinação 3D que acompanha o ponteiro, com reflexo metálico. */
export function useTilt<T extends HTMLElement>(strength = 6) {
  const ref = useRef<T>(null);
  const onPointerMove = (e: ReactPointerEvent<T>) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * strength}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * strength}deg`);
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
  };
  const onPointerLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return { ref, onPointerMove, onPointerLeave };
}
export function Plate({
  children,
  className = '',
  tilt = false,
  style,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
  style?: CSSProperties;
  as?: 'section' | 'article' | 'div' | 'aside';
}) {
  const t = useTilt<HTMLElement>(tilt ? 5 : 0);
  return (
    <Tag
      ref={t.ref as never}
      className={`plate ${tilt ? 'tilt' : ''} ${className}`}
      style={style}
      onPointerMove={tilt ? t.onPointerMove : undefined}
      onPointerLeave={tilt ? t.onPointerLeave : undefined}
    >
      <i className="screws" aria-hidden="true" />
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ texto */
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">
          <span className="hazard-chip" aria-hidden="true" />
          {eyebrow || 'PIXOTE CRM'}
        </p>
        <h1>{title}</h1>
        <p className="subtle">{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function Badge({ value, children }: { value: string; children?: ReactNode }) {
  return (
    <span className={`badge badge-${value}`}>
      <i className="led" aria-hidden="true" />
      {children || labels[value] || value}
    </span>
  );
}
export function Empty({
  title = 'Nenhum registro encontrado',
  detail = 'Comece pelo botão de cadastro ou ajuste os filtros.',
  icon,
}: {
  title?: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon || <PackageOpen size={30} />}</span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = 'Buscar registros...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" aria-label="Limpar busca" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      )}
    </label>
  );
}
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  label: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="button ghost" onClick={onClick}>
      <ArrowDownToLine size={16} /> Exportar CSV
    </button>
  );
}
export function Pagination<T>({
  rows,
  children,
  size = 10,
  empty,
}: {
  rows: T[];
  children: (page: T[]) => ReactNode;
  size?: number;
  empty?: ReactNode;
}) {
  const [page, setPage] = useState(0);
  const count = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, count - 1);
  if (!rows.length) return <>{empty || <Empty />}</>;
  return (
    <>
      {children(rows.slice(current * size, current * size + size))}
      {count > 1 || rows.length > 5 ? (
        <div className="pagination">
          <span>
            {rows.length} registros · página {current + 1} de {count}
          </span>
          <div>
            <button
              aria-label="Página anterior"
              disabled={!current}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              aria-label="Próxima página"
              disabled={current + 1 >= count}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ diálogos */
export function Modal({
  title,
  description,
  children,
  close,
  onSubmit,
  submit = 'Salvar registro',
  wide = false,
  size,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  close: () => void;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  submit?: string;
  wide?: boolean;
  size?: 'xl';
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [error, setError] = useState('');
  const { busy } = useStore();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={`${wide ? 'wide' : ''} ${size || ''}`}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="modal-head">
        <span className="hazard-bar" aria-hidden="true" />
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p className="subtle">{description}</p>}
        </div>
        <button className="icon-button" aria-label="Fechar" disabled={busy} onClick={close}>
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            await onSubmit?.(e);
            if (onSubmit) close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <fieldset disabled={busy}>
          <div className="modal-body">
            {children}
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
          </div>
          <div className="modal-foot">
            {footer}
            <span className="grow" />
            <button type="button" className="button ghost" onClick={close}>
              {onSubmit ? 'Cancelar' : 'Fechar'}
            </button>
            {onSubmit && (
              <button className="button primary" type="submit">
                {busy ? 'Registrando...' : submit}
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
export function Confirm({
  title,
  detail,
  close,
  run,
  danger = false,
}: {
  title: string;
  detail: string;
  close: () => void;
  run: () => Promise<void>;
  danger?: boolean;
}) {
  return (
    <Modal title={title} close={close} onSubmit={run} submit="Confirmar">
      <p className={danger ? 'confirm-danger' : ''}>{detail}</p>
    </Modal>
  );
}
export function Drawer({
  title,
  subtitle,
  children,
  close,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  close: () => void;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="drawer-inner">
        <div className="drawer-head">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <div className="subtle">{subtitle}</div>}
          </div>
          <button className="icon-button" aria-label="Fechar painel" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {actions && <div className="drawer-actions">{actions}</div>}
        <div className="drawer-body">{children}</div>
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------------ números */
export function useCountUp(value: number, duration = 700) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    if (origin === value || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(origin + (value - origin) * eased));
      if (k < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, duration]);
  return shown;
}
export function Count({ value, format }: { value: number; format: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}
export function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous && !current) return <span className="delta flat">—</span>;
  if (!previous) return <span className="delta up">novo</span>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const cls = Math.abs(pct) < 0.5 ? 'flat' : pct > 0 ? 'up' : 'down';
  return (
    <span className={`delta ${cls}`} title="Comparado ao período anterior equivalente">
      {cls === 'up' ? '▲' : cls === 'down' ? '▼' : '■'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/* ------------------------------------------------------------------ canais */
const channelAsset: Record<Channel, string> = {
  mercado_livre: '/channels/mercado-livre.svg',
  shopee: '/channels/shopee.svg',
  balcao: '/channels/balcao.svg',
};
export function ChannelLogo({ channel, size = 28 }: { channel: Channel; size?: number }) {
  return (
    <img
      className={`channel-logo channel-${channel}`}
      src={channelAsset[channel] || channelAsset.balcao}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
export function ChannelPill({ channel }: { channel: Channel }) {
  return (
    <span className={`channel-pill channel-${channel}`}>
      <ChannelLogo channel={channel} size={20} />
      {labels[channel] || channel}
    </span>
  );
}

/** Placa no padrão Mercosul. */
export function LicensePlate({ plate, small = false }: { plate: string; small?: boolean }) {
  if (!plate) return null;
  return (
    <span className={`license-plate ${small ? 'small' : ''}`}>
      <span className="lp-band">BRASIL</span>
      <span className="lp-text">{plate.toUpperCase()}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ fotos */
export function Photo({
  path,
  alt,
  className = '',
}: {
  path?: string;
  alt: string;
  className?: string;
}) {
  const urls = usePhotoUrls(path ? [path] : []);
  const url = path ? urls[path] : '';
  return url ? (
    <img className={`photo ${className}`} src={url} alt={alt} loading="lazy" />
  ) : (
    <span className={`photo photo-empty ${className}`} role="img" aria-label={alt}>
      <Cog size={22} aria-hidden="true" />
    </span>
  );
}
export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const urls = usePhotoUrls(photos);
  const [active, setActive] = useState(0);
  if (!photos.length)
    return (
      <div className="gallery gallery-empty">
        <ImagePlus size={28} />
        <span>Sem fotos cadastradas</span>
      </div>
    );
  const current = photos[Math.min(active, photos.length - 1)];
  return (
    <div className="gallery">
      <div className="gallery-main">
        {urls[current] ? <img src={urls[current]} alt={alt} /> : <span className="photo-empty" />}
      </div>
      {photos.length > 1 && (
        <div className="gallery-thumbs">
          {photos.map((p, i) => (
            <button
              key={p}
              type="button"
              className={i === active ? 'active' : ''}
              aria-label={`Foto ${i + 1}`}
              onClick={() => setActive(i)}
            >
              {urls[p] && <img src={urls[p]} alt="" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function PhotoUploader({
  value,
  onChange,
  folder,
  max,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  folder: 'scraps' | 'parts';
  max: number;
}) {
  const { uploadPhoto } = useStore();
  const urls = usePhotoUrls(value);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const list = Array.from(files).slice(0, max - value.length);
    setPending(list.length);
    const added: string[] = [];
    for (const file of list) {
      try {
        added.push(await uploadPhoto(file, folder));
      } catch (e) {
        setError((e as Error).message);
      }
      setPending((n) => n - 1);
    }
    onChange([...value, ...added]);
  };
  return (
    <div className="uploader">
      <div className="uploader-grid">
        {value.map((p, i) => (
          <figure key={p}>
            {urls[p] ? (
              <img src={urls[p]} alt={`Foto ${i + 1}`} />
            ) : (
              <span className="photo-empty" />
            )}
            {i === 0 && <figcaption>Capa</figcaption>}
            <button
              type="button"
              aria-label={`Remover foto ${i + 1}`}
              onClick={() => onChange(value.filter((x) => x !== p))}
            >
              <Trash2 size={14} />
            </button>
          </figure>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <figure key={`p${i}`} className="uploading">
            <span className="spinner" />
          </figure>
        ))}
        {value.length + pending < max && (
          <button
            type="button"
            className="uploader-add"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void add(e.dataTransfer.files);
            }}
          >
            <ImagePlus size={22} />
            <span>Adicionar fotos</span>
            <small>
              {value.length}/{max} · arraste ou toque
            </small>
          </button>
        )}
      </div>
      <input
        ref={input}
        hidden
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = '';
        }}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ formulários */
export function useRequestId() {
  const ref = useRef<{ body: string; id: string } | null>(null);
  return (payload: unknown) => {
    const body = JSON.stringify(payload);
    if (!ref.current || body !== ref.current.body) ref.current = { body, id: crypto.randomUUID() };
    return ref.current.id;
  };
}
export const textValue = (f: FormData, key: string) => String(f.get(key) || '').trim();
export const amountValue = (f: FormData, key: string) => Math.round(Number(f.get(key) || 0) * 100);
export const intOrNull = (f: FormData, key: string) => {
  const v = textValue(f, key);
  return v === '' ? null : Math.round(Number(v));
};
