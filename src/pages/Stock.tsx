import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowRightLeft,
  Boxes,
  History,
  LayoutGrid,
  List,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  Warehouse,
} from 'lucide-react';
import { removePhotos, useStore } from '../lib/store';
import {
  dateLabel,
  exportCsv,
  includes,
  labels,
  money,
  partCategories,
  type Box,
  type Part,
  type StockLocation,
  type Tone,
} from '../lib/types';
import { stockValue } from '../lib/metrics';
import {
  Badge,
  Confirm,
  Drawer,
  Empty,
  ExportButton,
  Field,
  Heading,
  Modal,
  Pagination,
  Photo,
  PhotoGallery,
  PhotoUploader,
  Plate,
  SearchBox,
  Segmented,
  amountValue,
  textValue,
  useRequestId,
} from '../components/ui';
import { PrintPortal } from '../components/print';

const tones: Tone[] = ['amber', 'orange', 'blue', 'green', 'red', 'steel'];
const toneLabel: Record<Tone, string> = {
  amber: 'Âmbar',
  orange: 'Laranja',
  blue: 'Azul',
  green: 'Verde',
  red: 'Vermelho',
  steel: 'Aço',
};

export function Stock({ focus }: { focus?: string }) {
  const { state } = useStore();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [openBox, setOpenBox] = useState<string>();
  const [editPart, setEditPart] = useState<Part | null | undefined>();
  const [newPartBox, setNewPartBox] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState<StockLocation | null | undefined>();
  const [editBox, setEditBox] = useState<Partial<Box> | undefined>();
  const [loose, setLoose] = useState(false);
  const stats = stockValue(state);
  const activeParts = state.parts.filter((p) => !p.archived);
  const locations = state.locations.filter((l) => !l.archived);
  const boxes = state.boxes.filter((b) => !b.archived);
  const filterActive = Boolean(q.trim() || category || onlyLow);
  const matches = useMemo(
    () =>
      activeParts.filter((p) => {
        const box = state.boxes.find((b) => b.id === p.box_id);
        return (
          includes(q, p.name, p.code, p.oem, p.fits, p.category, box?.code, box?.label) &&
          (!category || p.category === category) &&
          (!onlyLow || p.quantity <= p.minimum)
        );
      }),
    [state, q, category, onlyLow],
  );
  const matchBoxes = new Set(matches.map((p) => p.box_id));
  useEffect(() => {
    // Busca global: abre a caixa da peça escolhida.
    const part = state.parts.find((p) => p.id === focus);
    if (part?.box_id) setOpenBox(part.box_id);
    else if (part) {
      setView('list');
      setQ(part.code);
    }
  }, [focus]);
  const unboxed = activeParts.filter((p) => !p.box_id);
  return (
    <>
      <Heading
        eyebrow="ARMAZÉM"
        title="Cada peça na caixa certa."
        description="Prateleiras, caixas e peças num mapa visual. Busque e veja onde a peça está."
      >
        <ExportButton
          onClick={() =>
            exportCsv('estoque-pixote.csv', [
              [
                'Código',
                'Peça',
                'OEM',
                'Categoria',
                'Local',
                'Nível',
                'Caixa',
                'Quantidade',
                'Mínimo',
                'Custo (R$)',
                'Preço (R$)',
              ],
              ...matches.map((p) => {
                const box = state.boxes.find((b) => b.id === p.box_id);
                const loc = state.locations.find((l) => l.id === box?.location_id);
                return [
                  p.code,
                  p.name,
                  p.oem,
                  p.category,
                  loc?.name || '',
                  box?.level || '',
                  box?.code || '',
                  p.quantity,
                  p.minimum,
                  (p.cost / 100).toFixed(2),
                  (p.price / 100).toFixed(2),
                ];
              }),
            ])
          }
        />
        <button className="button ghost" onClick={() => setEditLocation(null)}>
          <Warehouse size={17} /> Novo local
        </button>
        <button
          className="button primary"
          onClick={() => {
            setNewPartBox(null);
            setEditPart(null);
          }}
        >
          <Plus size={17} /> Nova peça
        </button>
      </Heading>

      <div className="stat-strip">
        <span>
          <strong>{activeParts.length}</strong> peças
        </span>
        <span>
          <strong>{stats.units}</strong> unidades
        </span>
        <span>
          <strong>{boxes.length}</strong> caixas em <strong>{locations.length}</strong> locais
        </span>
        <span>
          custo <strong>{money(stats.cost)}</strong>
        </span>
        <span>
          venda <strong>{money(stats.price)}</strong>
        </span>
        <span className={stats.low.length ? 'alert' : ''}>
          <strong>{stats.low.length}</strong> no mínimo
        </span>
      </div>

      <div className="toolbar stock-toolbar">
        <Segmented
          label="Visualização do estoque"
          value={view}
          onChange={setView}
          options={[
            {
              value: 'map',
              label: (
                <>
                  <LayoutGrid size={15} /> Mapa
                </>
              ),
            },
            {
              value: 'list',
              label: (
                <>
                  <List size={15} /> Lista
                </>
              ),
            },
          ]}
        />
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Buscar peça, código, OEM, aplicação ou caixa..."
        />
        <select
          aria-label="Filtrar categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {partCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />{' '}
          Só estoque baixo
        </label>
      </div>
      {filterActive && (
        <p className="filter-note">
          {matches.length} peça(s) encontrada(s)
          {view === 'map' && matches.length > 0 && ' · caixas com resultado estão acesas no mapa'}
        </p>
      )}

      {view === 'map' ? (
        locations.length ? (
          <div className="warehouse">
            {locations.map((loc) => (
              <Rack
                key={loc.id}
                location={loc}
                boxes={boxes.filter((b) => b.location_id === loc.id)}
                highlight={filterActive ? matchBoxes : null}
                onBox={(b) => setOpenBox(b.id)}
                onEdit={() => setEditLocation(loc)}
                onAddBox={(level) => setEditBox({ location_id: loc.id, level })}
              />
            ))}
            <Plate className={`loose-tray ${filterActive && !matchBoxes.has(null) ? 'dim' : ''}`}>
              <div className="rack-head">
                <span className="rack-code">?</span>
                <div className="grow">
                  <strong>Sem caixa</strong>
                  <small>{unboxed.length} peça(s) aguardando endereço</small>
                </div>
              </div>
              {unboxed.length ? (
                <button className="button ghost small" onClick={() => setLoose(true)}>
                  <ArrowRightLeft size={14} /> Endereçar peças
                </button>
              ) : (
                <p className="subtle small-note">Todas as peças estão endereçadas.</p>
              )}
            </Plate>
          </div>
        ) : (
          <Plate>
            <Empty
              icon={<Warehouse size={28} />}
              title="Monte seu armazém"
              detail="Cadastre prateleiras, gaveteiros ou áreas. Depois crie as caixas em cada nível e guarde as peças nelas."
            />
            <div className="center">
              <button className="button primary" onClick={() => setEditLocation(null)}>
                <Plus size={16} /> Criar primeiro local
              </button>
            </div>
          </Plate>
        )
      ) : (
        <PartsTable rows={matches} onEdit={setEditPart} onBox={(id) => setOpenBox(id)} />
      )}

      {openBox && (
        <BoxDrawer
          box={state.boxes.find((b) => b.id === openBox)!}
          highlight={filterActive ? new Set(matches.map((p) => p.id)) : null}
          close={() => setOpenBox(undefined)}
          onEditBox={(b) => setEditBox(b)}
          onEditPart={setEditPart}
          onNewPart={(boxId) => {
            setNewPartBox(boxId);
            setEditPart(null);
          }}
        />
      )}
      {loose && (
        <Drawer
          title="Peças sem caixa"
          subtitle="Escolha onde cada peça será guardada."
          close={() => setLoose(false)}
        >
          <div className="part-rows">
            {unboxed.map((p) => (
              <PartRow key={p.id} part={p} onEdit={() => setEditPart(p)} />
            ))}
            {!unboxed.length && <Empty title="Tudo endereçado" detail="Nenhuma peça sem caixa." />}
          </div>
        </Drawer>
      )}
      {editPart !== undefined && (
        <PartForm part={editPart} defaultBox={newPartBox} close={() => setEditPart(undefined)} />
      )}
      {editLocation !== undefined && (
        <LocationForm location={editLocation} close={() => setEditLocation(undefined)} />
      )}
      {editBox && <BoxForm box={editBox} close={() => setEditBox(undefined)} />}
    </>
  );
}

function Rack({
  location,
  boxes,
  highlight,
  onBox,
  onEdit,
  onAddBox,
}: {
  location: StockLocation;
  boxes: Box[];
  highlight: Set<string | null> | null;
  onBox: (b: Box) => void;
  onEdit: () => void;
  onAddBox: (level: number) => void;
}) {
  const { state } = useStore();
  const levels = Array.from({ length: location.levels }, (_, i) => location.levels - i);
  const partsIn = (b: Box) => state.parts.filter((p) => p.box_id === b.id && !p.archived);
  const units = boxes.reduce((n, b) => n + partsIn(b).reduce((a, p) => a + p.quantity, 0), 0);
  return (
    <article className={`rack tone-${location.color} kind-${location.kind}`}>
      <div className="rack-head">
        <span className="rack-code">{location.code}</span>
        <div className="grow">
          <strong>{location.name}</strong>
          <small>
            {labels[location.kind]} · {boxes.length} caixa(s) · {units} un.
          </small>
        </div>
        <button
          className="icon-button"
          aria-label={`Editar ${location.name}`}
          title="Editar local"
          onClick={onEdit}
        >
          <Pencil size={15} />
        </button>
      </div>
      <div className="rack-frame">
        {levels.map((level) => {
          const here = boxes.filter((b) => b.level === level);
          return (
            <div className="rack-level" key={level}>
              <span className="level-tag">N{level}</span>
              <div className="bins">
                {here.map((b) => {
                  const parts = partsIn(b);
                  const qty = parts.reduce((n, p) => n + p.quantity, 0);
                  const low = parts.some((p) => p.quantity <= p.minimum);
                  const lit = highlight ? highlight.has(b.id) : false;
                  return (
                    <button
                      key={b.id}
                      className={`bin ${low ? 'low' : ''} ${lit ? 'lit' : ''} ${highlight && !lit ? 'dim' : ''} ${qty ? '' : 'empty'}`}
                      onClick={() => onBox(b)}
                      aria-label={`Caixa ${b.code}${b.label ? ', ' + b.label : ''}: ${parts.length} peça(s), ${qty} unidade(s)`}
                    >
                      <span className="bin-lid" aria-hidden="true" />
                      <span className="bin-stuff" aria-hidden="true">
                        {parts.slice(0, 4).map((p) => (
                          <i key={p.id} />
                        ))}
                      </span>
                      <span className="bin-front">
                        <span className="bin-label">
                          <b>{b.code}</b>
                          <small>{b.label || '—'}</small>
                        </span>
                      </span>
                      <span className="bin-count">{qty}</span>
                      {low && <span className="bin-alert" title="Peça no estoque mínimo" />}
                    </button>
                  );
                })}
                <button
                  className="bin-add"
                  onClick={() => onAddBox(level)}
                  aria-label={`Adicionar caixa no nível ${level} de ${location.name}`}
                  title="Adicionar caixa neste nível"
                >
                  <Plus size={16} />
                </button>
              </div>
              <i className="beam" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </article>
  );
}

function BoxDrawer({
  box,
  highlight,
  close,
  onEditBox,
  onEditPart,
  onNewPart,
}: {
  box: Box;
  highlight: Set<string> | null;
  close: () => void;
  onEditBox: (b: Box) => void;
  onEditPart: (p: Part) => void;
  onNewPart: (boxId: string) => void;
}) {
  const { state } = useStore();
  const [printing, setPrinting] = useState(false);
  if (!box) return null;
  const loc = state.locations.find((l) => l.id === box.location_id);
  const parts = state.parts.filter((p) => p.box_id === box.id && !p.archived);
  return (
    <Drawer
      title={
        <>
          <span className={`box-chip tone-${loc?.color}`}>{box.code}</span> {box.label || 'Caixa'}
        </>
      }
      subtitle={`${loc?.name} · nível ${box.level} · ${parts.length} peça(s) · ${parts.reduce((n, p) => n + p.quantity, 0)} un.`}
      close={close}
      actions={
        <>
          <button className="button primary small" onClick={() => onNewPart(box.id)}>
            <PackagePlus size={15} /> Peça nesta caixa
          </button>
          <button className="button ghost small" onClick={() => onEditBox(box)}>
            <Pencil size={14} /> Editar caixa
          </button>
          <button className="button ghost small" onClick={() => setPrinting(true)}>
            <Printer size={14} /> Etiqueta
          </button>
        </>
      }
    >
      {parts.length ? (
        <div className="part-rows">
          {parts.map((p) => (
            <PartRow key={p.id} part={p} lit={highlight?.has(p.id)} onEdit={() => onEditPart(p)} />
          ))}
        </div>
      ) : (
        <Empty
          title="Caixa vazia"
          detail="Adicione uma peça ou mova peças de outra caixa para cá."
          icon={<Boxes size={28} />}
        />
      )}
      {printing && (
        <PrintPortal title={`Etiqueta ${box.code}`} onDone={() => setPrinting(false)}>
          <div className="print-label">
            <div className="label-top">
              <span>{state.settings.name}</span>
              <span>{loc?.name}</span>
            </div>
            <div className="label-code">{box.code}</div>
            <div className="label-sub">
              {box.label} · nível {box.level}
            </div>
            <ul>
              {parts.map((p) => (
                <li key={p.id}>
                  <b>{p.code}</b> {p.name}
                </li>
              ))}
            </ul>
          </div>
        </PrintPortal>
      )}
    </Drawer>
  );
}

function PartRow({ part, lit, onEdit }: { part: Part; lit?: boolean; onEdit: () => void }) {
  const { state, execute, busy } = useStore();
  const [moving, setMoving] = useState(false);
  const [history, setHistory] = useState(false);
  const [archive, setArchive] = useState(false);
  const [error, setError] = useState('');
  const scrap = state.scraps.find((s) => s.id === part.scrap_id);
  const run = async (action: string, payload: Record<string, unknown>) => {
    setError('');
    try {
      await execute(action, payload);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <article
      className={`part-row ${lit ? 'lit' : ''} ${part.quantity <= part.minimum ? 'low' : ''}`}
    >
      <div className="part-thumb">
        <Photo path={part.photos[0]} alt={part.name} />
      </div>
      <div className="part-main">
        <button className="cell-link" onClick={onEdit}>
          {part.name}
        </button>
        <small>
          <span className="mono">{part.code}</span>
          {part.oem && <> · OEM {part.oem}</>} · {part.condition}
          {scrap && <> · {scrap.code}</>}
        </small>
        {part.fits && <small className="fits">Aplicação: {part.fits}</small>}
        <div className="part-price">
          {money(part.price)} <small>custo {money(part.cost)}</small>
        </div>
      </div>
      <div className="qty-control" aria-label={`Quantidade de ${part.name}`}>
        <button
          aria-label={`Retirar 1 unidade de ${part.name}`}
          disabled={busy || part.quantity < 1}
          onClick={() =>
            run('stock.adjust', { id: part.id, delta: -1, reason: 'Retirada rápida no armazém' })
          }
        >
          <Minus size={14} />
        </button>
        <strong className={part.quantity <= part.minimum ? 'negative' : ''}>{part.quantity}</strong>
        <button
          aria-label={`Adicionar 1 unidade de ${part.name}`}
          disabled={busy}
          onClick={() =>
            run('stock.adjust', { id: part.id, delta: 1, reason: 'Entrada rápida no armazém' })
          }
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="part-actions">
        <button
          title="Mover para outra caixa"
          aria-label={`Mover ${part.name}`}
          onClick={() => setMoving(!moving)}
        >
          <ArrowRightLeft size={15} />
        </button>
        <button
          title="Histórico"
          aria-label={`Histórico de ${part.name}`}
          onClick={() => setHistory(true)}
        >
          <History size={15} />
        </button>
        <button title="Editar" aria-label={`Editar ${part.name}`} onClick={onEdit}>
          <Pencil size={15} />
        </button>
        <button
          title="Arquivar"
          aria-label={`Arquivar ${part.name}`}
          onClick={() => setArchive(true)}
        >
          <Archive size={15} />
        </button>
      </div>
      {moving && (
        <div className="move-row">
          <BoxSelect
            value={part.box_id || ''}
            onChange={async (v) => {
              await run('part.move', { id: part.id, box_id: v || null });
              setMoving(false);
            }}
          />
        </div>
      )}
      {error && (
        <p className="error move-row" role="alert">
          {error}
        </p>
      )}
      {history && (
        <Modal
          title={part.name}
          description={`${part.code} · histórico de movimentações`}
          close={() => setHistory(false)}
        >
          <div className="list timeline">
            {state.moves
              .filter((m) => m.part_id === part.id)
              .map((m) => (
                <div className="list-row" key={m.id}>
                  <span className={`list-icon ${m.delta > 0 ? 'income' : 'expense'}`}>
                    {m.delta > 0 ? '+' : '−'}
                  </span>
                  <span className="grow">
                    <strong>{m.reason}</strong>
                    <small>{dateLabel(m.created_at)}</small>
                  </span>
                  <strong className={m.delta > 0 ? 'positive' : 'negative'}>
                    {m.delta > 0 ? '+' : ''}
                    {m.delta} un.
                  </strong>
                </div>
              ))}
          </div>
        </Modal>
      )}
      {archive && (
        <Confirm
          title="Arquivar peça?"
          detail="O histórico é preservado. Peças arquivadas somem do armazém e não entram em novas vendas ou OS."
          close={() => setArchive(false)}
          run={() => execute('part.save', { ...part, archived: true })}
        />
      )}
    </article>
  );
}

export function BoxSelect({
  value,
  onChange,
  name,
}: {
  value?: string;
  onChange?: (v: string) => void;
  name?: string;
}) {
  const { state } = useStore();
  return (
    <select
      name={name}
      aria-label={name ? undefined : 'Caixa de destino'}
      value={onChange ? value : undefined}
      defaultValue={onChange ? undefined : value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    >
      <option value="">Sem caixa (a endereçar)</option>
      {state.locations
        .filter((l) => !l.archived)
        .map((l) => (
          <optgroup key={l.id} label={`${l.code} · ${l.name}`}>
            {state.boxes
              .filter((b) => b.location_id === l.id && !b.archived)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · N{b.level} {b.label ? `· ${b.label}` : ''}
                </option>
              ))}
          </optgroup>
        ))}
    </select>
  );
}

function PartsTable({
  rows,
  onEdit,
  onBox,
}: {
  rows: Part[];
  onEdit: (p: Part) => void;
  onBox: (id: string) => void;
}) {
  const { state } = useStore();
  return (
    <Plate>
      <Pagination rows={rows} size={12}>
        {(page) => (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Peça</th>
                  <th>Endereço</th>
                  <th>Origem</th>
                  <th>Disponível</th>
                  <th className="numeric">Preço</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {page.map((p) => {
                  const box = state.boxes.find((b) => b.id === p.box_id);
                  const loc = state.locations.find((l) => l.id === box?.location_id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="with-thumb">
                          <span className="thumb">
                            <Photo path={p.photos[0]} alt="" />
                          </span>
                          <span>
                            <button className="cell-link" onClick={() => onEdit(p)}>
                              {p.name}
                            </button>
                            <small>
                              <span className="mono">{p.code}</span> · {p.category}
                              {p.oem && ` · OEM ${p.oem}`}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        {box ? (
                          <button
                            className={`box-chip tone-${loc?.color}`}
                            onClick={() => onBox(box.id)}
                          >
                            {box.code}
                          </button>
                        ) : (
                          <span className="muted">Sem caixa</span>
                        )}
                        {loc && (
                          <small>
                            {loc.name} · N{box?.level}
                          </small>
                        )}
                      </td>
                      <td>{state.scraps.find((s) => s.id === p.scrap_id)?.code || 'Avulsa'}</td>
                      <td>
                        <Badge value={p.quantity <= p.minimum ? 'baixo' : 'disponivel'}>
                          {p.quantity} un.
                        </Badge>
                      </td>
                      <td className="numeric">{money(p.price)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            aria-label={`Editar ${p.name}`}
                            title="Editar"
                            onClick={() => onEdit(p)}
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Pagination>
    </Plate>
  );
}

export function PartForm({
  part,
  defaultBox = null,
  defaultScrap = null,
  close,
}: {
  part: Part | null;
  defaultBox?: string | null;
  defaultScrap?: string | null;
  close: () => void;
}) {
  const { state, execute } = useStore();
  const request = useRequestId();
  const [photos, setPhotos] = useState<string[]>(part?.photos || []);
  const scrap = state.scraps.find((s) => s.id === (part?.scrap_id ?? defaultScrap));
  return (
    <Modal
      title={part ? 'Editar peça' : 'Nova peça'}
      description="Endereço, preço e fotos para achar e vender rápido."
      close={close}
      wide
      onSubmit={async (e) => {
        const f = new FormData(e.currentTarget);
        const payload = {
          ...(part ? { id: part.id } : {}),
          code: textValue(f, 'code'),
          name: textValue(f, 'name'),
          category: textValue(f, 'category'),
          scrap_id: textValue(f, 'scrap_id') || null,
          box_id: textValue(f, 'box_id') || null,
          quantity: part?.quantity ?? Number(f.get('quantity')),
          minimum: Number(f.get('minimum')),
          cost: amountValue(f, 'cost'),
          price: amountValue(f, 'price'),
          location: part?.location || '',
          condition: textValue(f, 'condition'),
          oem: textValue(f, 'oem'),
          fits: textValue(f, 'fits'),
          photos,
          archived: part?.archived ?? false,
        };
        await execute('part.save', payload, request(payload));
        void removePhotos((part?.photos || []).filter((p) => !photos.includes(p)));
      }}
    >
      <div className="form-grid">
        <Field label="Código">
          <input
            name="code"
            defaultValue={part?.code}
            required
            maxLength={40}
            placeholder="PC-001"
          />
        </Field>
        <Field label="Nome da peça">
          <input name="name" defaultValue={part?.name} required maxLength={160} />
        </Field>
        <Field label="Código OEM / fabricante">
          <input name="oem" defaultValue={part?.oem} maxLength={80} placeholder="Ex.: 0124325171" />
        </Field>
        <Field label="Categoria">
          <select name="category" defaultValue={part?.category || 'Motor'}>
            {partCategories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Condição">
          <select name="condition" defaultValue={part?.condition || 'Usada'}>
            {['Nova', 'Usada', 'Recuperada'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Sucata de origem">
          <select name="scrap_id" defaultValue={part?.scrap_id || defaultScrap || ''}>
            <option value="">Peça avulsa</option>
            {state.scraps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.vehicle}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aplicação (veículos compatíveis)" wide>
          <input
            name="fits"
            defaultValue={part?.fits || (scrap ? scrap.vehicle : '')}
            maxLength={500}
            placeholder="Ex.: Gol/Voyage 1.6 2013-2016"
          />
        </Field>
        <Field label="Caixa (endereço)">
          <BoxSelect name="box_id" value={part?.box_id ?? defaultBox ?? ''} />
        </Field>
        {!part && (
          <Field label="Quantidade inicial">
            <input
              name="quantity"
              type="number"
              min="0"
              max="1000000"
              step="1"
              defaultValue="1"
              required
            />
          </Field>
        )}
        <Field label="Estoque mínimo">
          <input
            name="minimum"
            type="number"
            min="0"
            max="1000000"
            step="1"
            defaultValue={part?.minimum ?? 1}
            required
          />
        </Field>
        <Field label="Custo unitário (R$)">
          <input
            name="cost"
            type="number"
            min="0"
            max="100000000"
            step="0.01"
            defaultValue={(part?.cost || 0) / 100}
            required
          />
        </Field>
        <Field label="Preço de venda (R$)">
          <input
            name="price"
            type="number"
            min="0"
            max="100000000"
            step="0.01"
            defaultValue={(part?.price || 0) / 100}
            required
          />
        </Field>
      </div>
      <div className="form-section">
        <h3>Fotos da peça</h3>
        <PhotoUploader value={photos} onChange={setPhotos} folder="parts" max={6} />
      </div>
      {part && (
        <p className="hint">
          Quantidades mudam pelos botões + / − ou pela movimentação, para manter o histórico.
        </p>
      )}
    </Modal>
  );
}

function LocationForm({ location, close }: { location: StockLocation | null; close: () => void }) {
  const { execute } = useStore();
  const request = useRequestId();
  const [archive, setArchive] = useState(false);
  return (
    <>
      <Modal
        title={location ? 'Editar local' : 'Novo local'}
        description="Prateleira, gaveteiro, pallet ou área do galpão. Cada local tem níveis onde ficam as caixas."
        close={close}
        footer={
          location && (
            <button type="button" className="button ghost small" onClick={() => setArchive(true)}>
              <Archive size={14} /> Arquivar local
            </button>
          )
        }
        onSubmit={async (e) => {
          const f = new FormData(e.currentTarget);
          const payload = {
            ...(location ? { id: location.id } : {}),
            code: textValue(f, 'code'),
            name: textValue(f, 'name'),
            kind: textValue(f, 'kind'),
            levels: Number(f.get('levels')),
            color: textValue(f, 'color'),
            archived: false,
          };
          await execute('location.save', payload, request(payload));
        }}
      >
        <div className="form-grid">
          <Field label="Código" hint="Curto: A, B, G1, PATIO">
            <input name="code" required maxLength={20} defaultValue={location?.code} />
          </Field>
          <Field label="Nome">
            <input
              name="name"
              required
              maxLength={80}
              defaultValue={location?.name}
              placeholder="Prateleira A · Elétrica"
            />
          </Field>
          <Field label="Tipo">
            <select name="kind" defaultValue={location?.kind || 'prateleira'}>
              {(['prateleira', 'gaveteiro', 'pallet', 'area'] as const).map((k) => (
                <option key={k} value={k}>
                  {labels[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Níveis / andares">
            <input
              name="levels"
              type="number"
              min="1"
              max="12"
              required
              defaultValue={location?.levels || 4}
            />
          </Field>
          <Field label="Cor de identificação" wide>
            <div className="tone-picker">
              {tones.map((t) => (
                <label key={t} className={`tone-swatch tone-${t}`}>
                  <input
                    type="radio"
                    name="color"
                    value={t}
                    defaultChecked={(location?.color || 'amber') === t}
                  />
                  <span>{toneLabel[t]}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
      {archive && location && (
        <Confirm
          title="Arquivar local?"
          detail="Só é possível arquivar locais sem caixas ativas."
          close={() => setArchive(false)}
          run={async () => {
            await execute('location.save', { ...location, archived: true });
            close();
          }}
        />
      )}
    </>
  );
}

function BoxForm({ box, close }: { box: Partial<Box>; close: () => void }) {
  const { state, execute } = useStore();
  const request = useRequestId();
  const [locationId, setLocationId] = useState(box.location_id || state.locations[0]?.id || '');
  const loc = state.locations.find((l) => l.id === locationId);
  const suggested = loc
    ? `${loc.code}-${String(state.boxes.filter((b) => b.location_id === loc.id).length + 1).padStart(2, '0')}`
    : '';
  return (
    <Modal
      title={box.id ? `Editar caixa ${box.code}` : 'Nova caixa'}
      description="Cada caixa tem um código único que vai na etiqueta."
      close={close}
      footer={
        box.id && (
          <button
            type="button"
            className="button ghost small"
            onClick={async () => {
              await execute('box.save', { ...box, archived: true });
              close();
            }}
          >
            <Archive size={14} /> Arquivar caixa
          </button>
        )
      }
      onSubmit={async (e) => {
        const f = new FormData(e.currentTarget);
        const payload = {
          ...(box.id ? { id: box.id } : {}),
          code: textValue(f, 'code'),
          label: textValue(f, 'label'),
          location_id: locationId,
          level: Number(f.get('level')),
          archived: false,
        };
        await execute('box.save', payload, request(payload));
      }}
    >
      <div className="form-grid">
        <Field label="Local">
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
            {state.locations
              .filter((l) => !l.archived)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Nível">
          <select name="level" defaultValue={box.level || 1} key={locationId}>
            {Array.from({ length: loc?.levels || 1 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Nível {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Código da caixa">
          <input
            name="code"
            required
            maxLength={20}
            defaultValue={box.code || suggested}
            key={suggested}
          />
        </Field>
        <Field label="Etiqueta / conteúdo">
          <input name="label" maxLength={80} defaultValue={box.label} placeholder="Alternadores" />
        </Field>
      </div>
    </Modal>
  );
}
