import { useState } from 'react';
import { Archive, MessageCircle, Pencil, Plus, Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { dateLabel, includes, labels, money, osNumber, type Contact } from '../lib/types';
import {
  Badge,
  Confirm,
  Empty,
  Field,
  Heading,
  Modal,
  Pagination,
  Plate,
  SearchBox,
  Segmented,
  textValue,
  useRequestId,
} from '../components/ui';

export function Contacts() {
  const { state, execute } = useStore();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | Contact['kind']>('all');
  const [edit, setEdit] = useState<Contact | null | undefined>();
  const [archive, setArchive] = useState<Contact>();
  const [history, setHistory] = useState<Contact>();
  const [all, setAll] = useState(false);
  const request = useRequestId();
  const rows = state.contacts.filter(
    (c) =>
      (all || !c.archived) &&
      (kind === 'all' || c.kind === kind || c.kind === 'ambos') &&
      includes(q, c.name, c.phone, c.document, c.email),
  );
  const spent = (id: string) =>
    state.orders
      .filter(
        (o) =>
          o.contact_id === id &&
          o.status !== 'cancelada' &&
          (o.kind === 'venda' || o.status === 'entregue'),
      )
      .reduce((n, o) => n + o.total, 0);
  return (
    <>
      <Heading
        eyebrow="RELACIONAMENTO"
        title="Clientes e fornecedores."
        description="Quem compra, quem traz o carro e quem vende sucata para você."
      >
        <button className="button primary" onClick={() => setEdit(null)}>
          <Plus size={17} /> Novo contato
        </button>
      </Heading>
      <Plate>
        <div className="toolbar">
          <Segmented
            label="Tipo de contato"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'cliente', label: 'Clientes' },
              { value: 'fornecedor', label: 'Fornecedores' },
            ]}
          />
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Buscar nome, telefone, e-mail ou documento..."
          />
          <label className="check">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />{' '}
            Incluir arquivados
          </label>
        </div>
        <Pagination
          rows={rows}
          empty={
            <Empty
              icon={<Users size={28} />}
              title="Nenhum contato"
              detail="Cadastre clientes e fornecedores para vincular vendas, OS e sucatas."
            />
          }
        >
          {(page) => (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Telefone</th>
                    <th className="numeric">Movimentado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {page.map((c) => {
                    const phone = c.phone.replace(/\D/g, '');
                    return (
                      <tr key={c.id}>
                        <td>
                          <div className="with-thumb">
                            <span className="avatar small">{c.name.slice(0, 2).toUpperCase()}</span>
                            <span>
                              <button className="cell-link" onClick={() => setHistory(c)}>
                                {c.name}
                              </button>
                              <small>
                                {c.email || c.document || 'Sem e-mail'}
                                {c.archived ? ' · Arquivado' : ''}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <Badge value={c.kind} />
                        </td>
                        <td>
                          {c.phone ? (
                            <a
                              className="whats"
                              href={`https://wa.me/55${phone}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir no WhatsApp"
                            >
                              <MessageCircle size={14} /> {c.phone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="numeric">{money(spent(c.id))}</td>
                        <td>
                          <div className="row-actions">
                            <button aria-label={`Editar ${c.name}`} onClick={() => setEdit(c)}>
                              <Pencil size={15} />
                            </button>
                            <button
                              aria-label={`Arquivar ou restaurar ${c.name}`}
                              onClick={() => setArchive(c)}
                            >
                              <Archive size={15} />
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
      {edit !== undefined && (
        <Modal
          title={edit ? 'Editar contato' : 'Novo contato'}
          close={() => setEdit(undefined)}
          onSubmit={async (e) => {
            const f = new FormData(e.currentTarget);
            const payload = {
              ...(edit ? { id: edit.id } : {}),
              ...Object.fromEntries(
                ['name', 'kind', 'phone', 'email', 'document', 'notes'].map((k) => [
                  k,
                  textValue(f, k),
                ]),
              ),
              archived: edit?.archived ?? false,
            };
            await execute('contact.save', payload, request(payload));
          }}
        >
          <div className="form-grid">
            <Field label="Nome / razão social">
              <input name="name" required maxLength={160} defaultValue={edit?.name} />
            </Field>
            <Field label="Tipo">
              <select name="kind" defaultValue={edit?.kind || 'cliente'}>
                <option value="cliente">Cliente</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="ambos">Cliente e fornecedor</option>
              </select>
            </Field>
            <Field label="Telefone / WhatsApp">
              <input name="phone" type="tel" maxLength={30} defaultValue={edit?.phone} />
            </Field>
            <Field label="E-mail">
              <input name="email" type="email" maxLength={160} defaultValue={edit?.email} />
            </Field>
            <Field label="CPF / CNPJ">
              <input name="document" maxLength={30} defaultValue={edit?.document} />
            </Field>
            <Field label="Observações" wide>
              <textarea name="notes" maxLength={2000} defaultValue={edit?.notes} />
            </Field>
          </div>
        </Modal>
      )}
      {history && (
        <Modal
          title={history.name}
          description={`${labels[history.kind]} · histórico vinculado`}
          close={() => setHistory(undefined)}
        >
          <div className="list">
            {state.orders
              .filter((o) => o.contact_id === history.id)
              .map((o) => (
                <div className="list-row" key={o.id}>
                  <span className="grow">
                    <strong>
                      {osNumber(o)} · {o.kind === 'venda' ? labels[o.channel] : o.vehicle}
                    </strong>
                    <small>
                      {dateLabel(o.created_at)} · {labels[o.status]}
                    </small>
                  </span>
                  <strong>{money(o.total)}</strong>
                </div>
              ))}
            {state.scraps
              .filter((s) => s.supplier_id === history.id)
              .map((s) => (
                <div className="list-row" key={s.id}>
                  <span className="grow">
                    <strong>
                      {s.code} · {s.vehicle}
                    </strong>
                    <small>Sucata fornecida · {dateLabel(s.date)}</small>
                  </span>
                  <strong className="negative">{money(s.cost)}</strong>
                </div>
              ))}
            {!state.orders.some((o) => o.contact_id === history.id) &&
              !state.scraps.some((s) => s.supplier_id === history.id) && (
                <p className="subtle">Nenhuma operação vinculada.</p>
              )}
          </div>
          {history.notes && <p className="note-box">{history.notes}</p>}
        </Modal>
      )}
      {archive && (
        <Confirm
          title={archive.archived ? 'Restaurar contato?' : 'Arquivar contato?'}
          detail="Os registros anteriores serão preservados."
          close={() => setArchive(undefined)}
          run={() => execute('contact.save', { ...archive, archived: !archive.archived })}
        />
      )}
    </>
  );
}
