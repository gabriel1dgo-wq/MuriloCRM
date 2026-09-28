import { useEffect, useState } from 'react';
import { CarFront, FileCheck2, Gauge, Fuel, PackagePlus, Pencil, Plus } from 'lucide-react';
import { removePhotos, useStore } from '../lib/store';
import { dateLabel, includes, labels, money, scrapRecovery, today, type Scrap } from '../lib/types';
import { sum } from '../lib/metrics';
import {
  Badge,
  Drawer,
  Empty,
  Field,
  Heading,
  LicensePlate,
  Modal,
  Photo,
  PhotoGallery,
  PhotoUploader,
  Plate,
  SearchBox,
  Segmented,
  amountValue,
  intOrNull,
  textValue,
  useRequestId,
} from '../components/ui';
import { PartForm } from './Stock';

type Filter = 'all' | Scrap['status'];
const scrapStatus: Record<Scrap['status'], string> = {
  aguardando: 'Aguardando',
  desmontando: 'Desmontando',
  finalizada: 'Desmontada',
};
export function Scraps({ focus }: { focus?: string }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [edit, setEdit] = useState<Scrap | null | undefined>();
  const [detail, setDetail] = useState<string | undefined>(focus);
  useEffect(() => setDetail(focus), [focus]);
  const rows = state.scraps.filter(
    (s) =>
      includes(q, s.code, s.vehicle, s.plate, s.chassis, s.lot, s.color) &&
      (filter === 'all' || s.status === filter),
  );
  const invested = sum(state.scraps, (s) => s.cost);
  const recovered = sum(state.scraps, (s) => scrapRecovery(state.orders, s.id));
  const pending = state.scraps.filter((s) => s.detran !== 'baixado').length;
  const current = state.scraps.find((s) => s.id === detail);
  return (
    <>
      <Heading
        eyebrow="SUCATAS"
        title="Da sucata ao lucro."
        description="Cada veículo com fotos, documentação e o retorno das peças vendidas."
      >
        <button className="button primary" onClick={() => setEdit(null)}>
          <Plus size={17} /> Nova sucata
        </button>
      </Heading>
      <div className="stat-strip">
        <span>
          <strong>{state.scraps.length}</strong> veículos
        </span>
        <span>
          investido <strong>{money(invested)}</strong>
        </span>
        <span>
          recuperado <strong className="positive">{money(recovered)}</strong>
        </span>
        <span>
          retorno <strong>{invested ? Math.round((recovered / invested) * 100) : 0}%</strong>
        </span>
        <span className={pending ? 'alert' : ''}>
          <strong>{pending}</strong> com baixa no DETRAN pendente
        </span>
      </div>
      <div className="toolbar">
        <Segmented
          label="Filtrar por etapa"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todas', count: state.scraps.length },
            ...(['aguardando', 'desmontando', 'finalizada'] as const).map((s) => ({
              value: s,
              label: scrapStatus[s],
              count: state.scraps.filter((x) => x.status === s).length,
            })),
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Buscar veículo, placa, chassi, lote..." />
      </div>
      {rows.length ? (
        <div className="scrap-grid">
          {rows.map((s) => (
            <ScrapCard key={s.id} scrap={s} open={() => setDetail(s.id)} />
          ))}
        </div>
      ) : (
        <Plate>
          <Empty
            icon={<CarFront size={30} />}
            title="Nenhuma sucata aqui"
            detail="Cadastre o veículo com fotos e documentação para acompanhar o retorno de cada peça."
          />
        </Plate>
      )}
      {current && (
        <ScrapDrawer
          scrap={current}
          close={() => setDetail(undefined)}
          edit={() => setEdit(current)}
        />
      )}
      {edit !== undefined && <ScrapForm scrap={edit} close={() => setEdit(undefined)} />}
    </>
  );
}

function ScrapCard({ scrap: s, open }: { scrap: Scrap; open: () => void }) {
  const { state } = useStore();
  const recovered = scrapRecovery(state.orders, s.id);
  const pct = s.cost ? Math.round((recovered / s.cost) * 100) : 0;
  const parts = state.parts.filter((p) => p.scrap_id === s.id && !p.archived);
  return (
    <Plate tilt as="article" className="scrap-card">
      <button className="scrap-hit" onClick={open} aria-label={`Abrir ficha de ${s.vehicle}`} />
      <div className="scrap-cover">
        <Photo path={s.photos[0]} alt={`Foto de ${s.vehicle}`} />
        <div className="scrap-cover-top">
          <Badge value={s.status}>{scrapStatus[s.status]}</Badge>
          {s.photos.length > 1 && <span className="photo-count">{s.photos.length} fotos</span>}
        </div>
        <div className="scrap-cover-bottom">
          <LicensePlate plate={s.plate} small />
          <span className="scrap-code">{s.code}</span>
        </div>
      </div>
      <div className="scrap-body">
        <h3>{s.brand ? `${s.brand} ${s.model}` : s.vehicle}</h3>
        <div className="spec-chips">
          <span>{s.year}</span>
          {s.km !== null && (
            <span>
              <Gauge size={12} /> {s.km.toLocaleString('pt-BR')} km
            </span>
          )}
          {s.fuel && (
            <span>
              <Fuel size={12} /> {s.fuel}
            </span>
          )}
          {s.color && <span>{s.color}</span>}
          <span className={`detran detran-${s.detran}`}>
            <FileCheck2 size={12} /> {labels[s.detran]}
          </span>
        </div>
        <div className="roi">
          <div>
            <small>Investido</small>
            <strong>{money(s.cost)}</strong>
          </div>
          <div>
            <small>Recuperado</small>
            <strong className="positive">{money(recovered)}</strong>
          </div>
          <div className={`roi-pct ${pct >= 100 ? 'done' : ''}`}>
            <strong>{pct}%</strong>
          </div>
        </div>
        <div
          className="roi-bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Retorno de ${s.code}`}
        >
          <i style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <p className="scrap-foot">
          {parts.length} peças · {sum(parts, (p) => p.quantity)} un. em estoque · entrada{' '}
          {dateLabel(s.date)}
        </p>
      </div>
    </Plate>
  );
}

function ScrapDrawer({
  scrap: s,
  close,
  edit,
}: {
  scrap: Scrap;
  close: () => void;
  edit: () => void;
}) {
  const { state } = useStore();
  const [newPart, setNewPart] = useState(false);
  const parts = state.parts.filter((p) => p.scrap_id === s.id && !p.archived);
  const recovered = scrapRecovery(state.orders, s.id);
  const supplier = state.contacts.find((c) => c.id === s.supplier_id);
  const sold = state.orders
    .filter((o) => o.status !== 'cancelada' && (o.kind === 'venda' || o.status === 'entregue'))
    .flatMap((o) =>
      o.items.filter((i) => i.scrap_id === s.id).map((i) => ({ ...i, date: o.created_at })),
    );
  const spec: [string, string][] = [
    ['Marca', s.brand],
    ['Modelo', s.model],
    ['Ano', String(s.year)],
    ['Cor', s.color],
    ['Combustível', s.fuel],
    ['Motor', s.engine],
    ['Quilometragem', s.km !== null ? `${s.km.toLocaleString('pt-BR')} km` : ''],
    ['Placa', s.plate],
    ['Chassi', s.chassis],
    ['Renavam', s.renavam],
    ['Origem', labels[s.origin]],
    ['Lote / sinistro', s.lot],
    ['Fornecedor', supplier?.name || ''],
    ['Data de entrada', dateLabel(s.date)],
  ];
  return (
    <Drawer
      title={s.brand ? `${s.brand} ${s.model}` : s.vehicle}
      subtitle={
        <>
          {s.code} · <Badge value={s.status}>{scrapStatus[s.status]}</Badge>{' '}
          <Badge value={s.detran} />
        </>
      }
      close={close}
      actions={
        <>
          <button className="button primary small" onClick={() => setNewPart(true)}>
            <PackagePlus size={15} /> Cadastrar peça retirada
          </button>
          <button className="button ghost small" onClick={edit}>
            <Pencil size={14} /> Editar ficha
          </button>
        </>
      }
    >
      <PhotoGallery photos={s.photos} alt={s.vehicle} />
      <div className="roi big">
        <div>
          <small>Investido</small>
          <strong>{money(s.cost)}</strong>
        </div>
        <div>
          <small>Recuperado</small>
          <strong className="positive">{money(recovered)}</strong>
        </div>
        <div>
          <small>Saldo</small>
          <strong className={recovered - s.cost >= 0 ? 'positive' : 'negative'}>
            {money(recovered - s.cost)}
          </strong>
        </div>
      </div>
      <h3 className="section-title">Ficha técnica</h3>
      <dl className="spec-grid">
        {spec.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className={['Chassi', 'Renavam', 'Placa'].includes(k) ? 'mono' : ''}>{v || '—'}</dd>
          </div>
        ))}
      </dl>
      {s.notes && (
        <>
          <h3 className="section-title">Observações</h3>
          <p className="note-box">{s.notes}</p>
        </>
      )}
      <h3 className="section-title">Peças retiradas ({parts.length})</h3>
      {parts.length ? (
        <div className="list">
          {parts.map((p) => (
            <div className="list-row" key={p.id}>
              <span className="grow">
                <strong>{p.name}</strong>
                <small>
                  {p.code} · caixa {state.boxes.find((b) => b.id === p.box_id)?.code || '—'}
                </small>
              </span>
              <span className="muted">{p.quantity} un.</span>
              <b>{money(p.price)}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="subtle">Nenhuma peça cadastrada desta sucata.</p>
      )}
      {sold.length > 0 && (
        <>
          <h3 className="section-title">Vendidas</h3>
          <div className="list">
            {sold.map((i, n) => (
              <div className="list-row" key={n}>
                <span className="grow">
                  <strong>{i.name}</strong>
                  <small>{dateLabel(i.date)}</small>
                </span>
                <span className="muted">{i.quantity}×</span>
                <b className="positive">{money(i.price * i.quantity)}</b>
              </div>
            ))}
          </div>
        </>
      )}
      {newPart && <PartForm part={null} defaultScrap={s.id} close={() => setNewPart(false)} />}
    </Drawer>
  );
}

function ScrapForm({ scrap, close }: { scrap: Scrap | null; close: () => void }) {
  const { state, execute } = useStore();
  const request = useRequestId();
  const [photos, setPhotos] = useState<string[]>(scrap?.photos || []);
  const nextCode = `SUC-${String(state.scraps.length + 1).padStart(3, '0')}`;
  return (
    <Modal
      title={scrap ? `Editar ${scrap.code}` : 'Nova sucata'}
      description="O custo gera uma saída no caixa. Alterar o custo depois lança apenas a diferença."
      close={close}
      size="xl"
      onSubmit={async (e) => {
        const f = new FormData(e.currentTarget);
        const brand = textValue(f, 'brand');
        const model = textValue(f, 'model');
        const payload = {
          ...(scrap ? { id: scrap.id } : {}),
          code: textValue(f, 'code'),
          vehicle: `${brand} ${model}`.trim(),
          brand,
          model,
          plate: textValue(f, 'plate').toUpperCase(),
          year: Number(f.get('year')),
          color: textValue(f, 'color'),
          fuel: textValue(f, 'fuel'),
          engine: textValue(f, 'engine'),
          km: intOrNull(f, 'km'),
          chassis: textValue(f, 'chassis'),
          renavam: textValue(f, 'renavam'),
          detran: textValue(f, 'detran'),
          origin: textValue(f, 'origin'),
          lot: textValue(f, 'lot'),
          supplier_id: textValue(f, 'supplier_id') || null,
          cost: amountValue(f, 'cost'),
          date: textValue(f, 'date'),
          status: textValue(f, 'status'),
          notes: textValue(f, 'notes'),
          photos,
        };
        await execute('scrap.save', payload, request(payload));
        void removePhotos((scrap?.photos || []).filter((p) => !photos.includes(p)));
      }}
    >
      <div className="form-columns">
        <div>
          <h3 className="section-title">Veículo</h3>
          <div className="form-grid three">
            <Field label="Código interno">
              <input name="code" required maxLength={40} defaultValue={scrap?.code || nextCode} />
            </Field>
            <Field label="Marca">
              <input
                name="brand"
                required
                maxLength={60}
                defaultValue={scrap?.brand || scrap?.vehicle.split(' ')[0]}
                list="brands"
              />
            </Field>
            <Field label="Modelo / versão">
              <input
                name="model"
                required
                maxLength={100}
                defaultValue={scrap?.model || scrap?.vehicle.split(' ').slice(1).join(' ')}
                placeholder="Gol G6 1.6 MSI"
              />
            </Field>
            <Field label="Ano">
              <input
                name="year"
                type="number"
                required
                min="1900"
                max="2100"
                defaultValue={scrap?.year || new Date().getFullYear() - 8}
              />
            </Field>
            <Field label="Cor">
              <input name="color" maxLength={40} defaultValue={scrap?.color} />
            </Field>
            <Field label="Combustível">
              <select name="fuel" defaultValue={scrap?.fuel || 'Flex'}>
                {['Flex', 'Gasolina', 'Etanol', 'Diesel', 'GNV', 'Híbrido', 'Elétrico'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Motor">
              <input
                name="engine"
                maxLength={60}
                defaultValue={scrap?.engine}
                placeholder="1.6 8V"
              />
            </Field>
            <Field label="Quilometragem">
              <input name="km" type="number" min="0" max="5000000" defaultValue={scrap?.km ?? ''} />
            </Field>
            <Field label="Placa">
              <input
                name="plate"
                maxLength={12}
                defaultValue={scrap?.plate}
                placeholder="ABC1D23"
              />
            </Field>
          </div>
          <h3 className="section-title spaced">Documentação</h3>
          <div className="form-grid three">
            <Field label="Chassi">
              <input name="chassis" maxLength={30} defaultValue={scrap?.chassis} className="mono" />
            </Field>
            <Field label="Renavam">
              <input name="renavam" maxLength={20} defaultValue={scrap?.renavam} className="mono" />
            </Field>
            <Field label="Baixa no DETRAN" hint="Lei 12.977/2014 (desmontagem)">
              <select name="detran" defaultValue={scrap?.detran || 'pendente'}>
                {(['pendente', 'em_andamento', 'baixado'] as const).map((x) => (
                  <option key={x} value={x}>
                    {labels[x]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <h3 className="section-title spaced">Aquisição</h3>
          <div className="form-grid three">
            <Field label="Origem">
              <select name="origin" defaultValue={scrap?.origin || 'leilao'}>
                {(['leilao', 'seguradora', 'particular', 'troca', 'outro'] as const).map((x) => (
                  <option key={x} value={x}>
                    {labels[x]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lote / nº sinistro">
              <input name="lot" maxLength={60} defaultValue={scrap?.lot} />
            </Field>
            <Field label="Fornecedor">
              <select name="supplier_id" defaultValue={scrap?.supplier_id || ''}>
                <option value="">Não informado</option>
                {state.contacts
                  .filter((c) => c.kind !== 'cliente' || c.id === scrap?.supplier_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Custo total pago (R$)">
              <input
                name="cost"
                type="number"
                required
                min="0"
                max="100000000"
                step="0.01"
                defaultValue={(scrap?.cost || 0) / 100}
              />
            </Field>
            <Field label="Data de entrada">
              <input type="date" name="date" required defaultValue={scrap?.date || today()} />
            </Field>
            <Field label="Etapa">
              <select name="status" defaultValue={scrap?.status || 'aguardando'}>
                {(['aguardando', 'desmontando', 'finalizada'] as const).map((x) => (
                  <option key={x} value={x}>
                    {scrapStatus[x]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <div>
          <h3 className="section-title">Fotos (até 12)</h3>
          <PhotoUploader value={photos} onChange={setPhotos} folder="scraps" max={12} />
          <p className="hint">
            Dica: lateral, frente, traseira, motor, painel com km, chassi e avarias.
          </p>
          <Field label="Observações / estado geral" wide>
            <textarea name="notes" maxLength={2000} defaultValue={scrap?.notes} rows={5} />
          </Field>
        </div>
      </div>
      <datalist id="brands">
        {[
          'Volkswagen',
          'Fiat',
          'Chevrolet',
          'Ford',
          'Toyota',
          'Honda',
          'Hyundai',
          'Renault',
          'Nissan',
          'Peugeot',
          'Citroën',
          'Jeep',
          'Mitsubishi',
          'Kia',
        ].map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </Modal>
  );
}
