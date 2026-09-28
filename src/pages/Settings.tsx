import { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { useStore } from '../lib/store';
import { money } from '../lib/types';
import { Field, Heading, Plate, textValue, useRequestId } from '../components/ui';

export function Settings() {
  const { state, execute, busy, demo, session, resetDemo } = useStore();
  const [error, setError] = useState('');
  const request = useRequestId();
  return (
    <>
      <Heading
        eyebrow="CONFIGURAÇÕES"
        title="A cara da sua operação."
        description="Dados da empresa nos documentos, meta do mês e garantia padrão da oficina."
      />
      <div className="settings-layout">
        <Plate className="settings-form">
          <form
            key={JSON.stringify(state.settings)}
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              const f = new FormData(e.currentTarget);
              const p = {
                ...Object.fromEntries(
                  [
                    'name',
                    'responsible',
                    'phone',
                    'email',
                    'document',
                    'address',
                    'warranty_text',
                  ].map((k) => [k, textValue(f, k)]),
                ),
                monthly_goal: Math.round(Number(f.get('monthly_goal') || 0) * 100),
              };
              try {
                await execute('settings.save', p, request(p));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <h2 className="section-title">Empresa</h2>
            <div className="form-grid">
              {[
                { key: 'name', label: 'Nome da empresa', required: true },
                { key: 'responsible', label: 'Responsável' },
                { key: 'phone', label: 'Telefone' },
                { key: 'email', label: 'E-mail', type: 'email' },
                { key: 'document', label: 'CPF / CNPJ' },
                { key: 'address', label: 'Endereço' },
              ].map((f) => (
                <Field key={f.key} label={f.label}>
                  <input
                    name={f.key}
                    required={f.required}
                    maxLength={160}
                    type={f.type || 'text'}
                    defaultValue={String(
                      state.settings[f.key as keyof typeof state.settings] ?? '',
                    )}
                  />
                </Field>
              ))}
            </div>
            <h2 className="section-title spaced">Metas e documentos</h2>
            <div className="form-grid">
              <Field
                label="Meta de receita mensal (R$)"
                hint={`Atual: ${money(state.settings.monthly_goal)}. Aparece no painel.`}
              >
                <input
                  name="monthly_goal"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={state.settings.monthly_goal / 100}
                />
              </Field>
              <Field
                label="Texto de garantia da OS"
                wide
                hint="Vai impresso em toda ordem de serviço. Em branco usa o texto padrão."
              >
                <textarea
                  name="warranty_text"
                  maxLength={2000}
                  rows={4}
                  defaultValue={state.settings.warranty_text}
                />
              </Field>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              <Save size={16} />
              {busy ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </Plate>
        <Plate className="settings-aside" as="aside">
          <div className="overline">AMBIENTE</div>
          <h3>{demo ? 'Demonstração local' : 'Supabase conectado'}</h3>
          <p className="subtle">
            {demo
              ? 'Dados fictícios salvos neste navegador. Nada vai para o banco.'
              : 'Dados no Supabase, isolados por conta com RLS. Fotos no Storage privado.'}
          </p>
          <hr />
          <small>Conta</small>
          <strong>{demo ? 'Visitante' : session?.user.email}</strong>
          <small>Modelo de acesso</small>
          <strong>Uma operação por conta</strong>
          {demo && (
            <button className="button ghost full" onClick={resetDemo}>
              <RotateCcw size={15} /> Restaurar demonstração
            </button>
          )}
        </Plate>
      </div>
    </>
  );
}
