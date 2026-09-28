import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Eraser } from 'lucide-react';

/**
 * Renderiza um documento A4 fora da aplicação e abre o diálogo de impressão do navegador,
 * onde o usuário escolhe a impressora ou "Salvar como PDF".
 */
export function PrintPortal({
  children,
  onDone,
  title,
}: {
  children: ReactNode;
  onDone: () => void;
  title: string;
}) {
  const [host] = useState(() => {
    const el = document.createElement('div');
    el.id = 'print-root';
    return el;
  });
  useEffect(() => {
    document.body.appendChild(host);
    document.body.classList.add('printing');
    const previous = document.title;
    document.title = title;
    const done = () => onDone();
    window.addEventListener('afterprint', done);
    // Aguarda fontes e imagens antes de chamar a impressão.
    const t = setTimeout(async () => {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(host.querySelectorAll('img')).map((img) =>
          img.complete ? null : new Promise((r) => img.addEventListener('load', r, { once: true })),
        ),
      );
      window.print();
    }, 120);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('printing');
      document.title = previous;
      host.remove();
    };
  }, []);
  return createPortal(children, host);
}

export function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  /** Ajusta a resolução ao tamanho visível (o diálogo pode abrir depois da montagem). */
  const context = () => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(c.offsetWidth * ratio);
    const h = Math.round(c.offsetHeight * ratio);
    const ctx = c.getContext('2d')!;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0b1b3f';
    }
    return ctx;
  };
  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const exportPng = () => {
    // Reduz a resolução para manter a assinatura leve no banco.
    const c = canvas.current!;
    if (!c.width || !c.height) return;
    const out = document.createElement('canvas');
    out.width = 600;
    out.height = Math.round((600 * c.height) / c.width);
    out.getContext('2d')!.drawImage(c, 0, 0, out.width, out.height);
    onChange(out.toDataURL('image/png'));
  };
  return (
    <div className="signature-pad">
      <canvas
        ref={canvas}
        aria-label="Área para assinatura com o dedo, caneta ou mouse"
        onPointerDown={(e) => {
          drawing.current = true;
          canvas.current!.setPointerCapture(e.pointerId);
          const ctx = context();
          ctx.lineWidth = 2.4;
          const [x, y] = point(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.1, y + 0.1);
          ctx.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvas.current!.getContext('2d')!;
          const [x, y] = point(e);
          ctx.lineWidth = 1.6 + Math.min(1.6, (e.pressure || 0.5) * 2);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          setEmpty(false);
          exportPng();
        }}
      />
      <span className="signature-line">Assine acima da linha</span>
      {!empty && (
        <button
          type="button"
          className="button ghost small"
          onClick={() => {
            const c = canvas.current!;
            c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
            setEmpty(true);
            onChange('');
          }}
        >
          <Eraser size={14} /> Limpar
        </button>
      )}
    </div>
  );
}
