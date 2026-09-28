import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  Hammer,
  KeyRound,
  Mail,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { authMessage, client, config, useStore } from '../lib/store';
import { Brand, Field, Grime } from '../components/ui';

type Mode = 'login' | 'signup' | 'reset' | 'magic';
function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const strengthLabel = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];

export function Auth() {
  const { enterDemo, recovery, finishRecovery } = useStore();
  const [mode, setMode] = useState<Mode>('login');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState('');
  const scene = useRef<HTMLDivElement>(null);
  const switchTo = (m: Mode) => {
    setMode(m);
    setError('');
    setMessage('');
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!client) return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    setPending(true);
    setError('');
    setMessage('');
    try {
      if (recovery) {
        if (password !== form.get('confirm')) throw new Error('As senhas não conferem.');
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        finishRecovery();
      } else if (mode === 'login') {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        if (password !== form.get('confirm')) throw new Error('As senhas não conferem.');
        if (strength(password) < 2) throw new Error('Escolha uma senha mais forte.');
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              name: String(form.get('name') || ''),
              company: String(form.get('company') || ''),
            },
          },
        });
        if (error) throw error;
        if (!data.session)
          setMessage('Conta criada! Enviamos um link de confirmação para o seu e-mail.');
      } else if (mode === 'magic') {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
        });
        if (error) throw error;
        setMessage('Link de acesso enviado. Abra o e-mail neste dispositivo para entrar.');
      } else {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage('Se o e-mail estiver cadastrado, você receberá um link para criar nova senha.');
      }
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setPending(false);
    }
  }
  const title = recovery
    ? 'Nova senha'
    : {
        login: 'Abrir a oficina',
        signup: 'Criar sua conta',
        reset: 'Recuperar acesso',
        magic: 'Entrar sem senha',
      }[mode];
  const score = strength(password);
  return (
    <main className="auth">
      <Grime variant="auth" />
      <section
        className="garage"
        ref={scene}
        aria-hidden="true"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          scene.current?.style.setProperty('--px', String((e.clientX - r.left) / r.width - 0.5));
          scene.current?.style.setProperty('--py', String((e.clientY - r.top) / r.height - 0.5));
        }}
      >
        <div className="garage-wall">
          <div className="pegboard">
            <Wrench className="tool t1" />
            <Hammer className="tool t2" />
            <Wrench className="tool t3" />
            <KeyRound className="tool t4" />
          </div>
          <div className="neon">
            PIXOTE<small>AUTO PEÇAS · OFICINA</small>
          </div>
          <div className="garage-shelf">
            {['A-01', 'A-02', 'B-01', 'B-02', 'C-01'].map((c, i) => (
              <span
                key={c}
                className={`mini-bin tone-${['amber', 'blue', 'orange', 'blue', 'green'][i]}`}
              >
                <b>{c}</b>
              </span>
            ))}
            <i className="beam" />
          </div>
        </div>
        <div className="garage-light" />
        <div className="garage-floor">
          <span className="floor-line" />
          <span className="floor-stain s1" />
          <span className="floor-stain s2" />
          <span className="floor-stain s3" />
        </div>
        <div className="garage-copy">
          <p className="overline">CRM DE OFICINA E AUTOPEÇAS</p>
          <h1>
            Cada peça na caixa certa.
            <br />
            <em>Cada serviço assinado.</em>
          </h1>
          <ul>
            <li>Estoque em prateleiras e caixas, com mapa visual</li>
            <li>Vendas no Balcão, Mercado Livre e Shopee</li>
            <li>OS completa com impressão em PDF e assinatura</li>
          </ul>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card plate">
          <i className="screws" aria-hidden="true" />
          <Brand />
          <div className="auth-head">
            <h2>{title}</h2>
            <p className="subtle">
              {client
                ? recovery
                  ? 'Defina uma nova senha para sua conta.'
                  : 'Acesso seguro via Supabase. Seus dados ficam isolados por conta.'
                : 'Supabase ainda não configurado. Explore a demonstração local.'}
            </p>
          </div>
          {client && !recovery && (mode === 'login' || mode === 'signup') && (
            <div className="auth-tabs" role="tablist">
              <button role="tab" aria-selected={mode === 'login'} onClick={() => switchTo('login')}>
                Entrar
              </button>
              <button
                role="tab"
                aria-selected={mode === 'signup'}
                onClick={() => switchTo('signup')}
              >
                Criar conta
              </button>
            </div>
          )}
          {client && (
            <form onSubmit={submit} className="auth-form">
              {mode === 'signup' && !recovery && (
                <div className="form-grid">
                  <Field label="Seu nome">
                    <input name="name" autoComplete="name" required maxLength={120} />
                  </Field>
                  <Field label="Nome da loja / oficina">
                    <input name="company" autoComplete="organization" required maxLength={160} />
                  </Field>
                </div>
              )}
              {!recovery && (
                <Field label="E-mail">
                  <span className="input-icon">
                    <Mail size={16} />
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      placeholder="voce@suaoficina.com.br"
                    />
                  </span>
                </Field>
              )}
              {(recovery || mode === 'login' || mode === 'signup') && (
                <Field label={recovery ? 'Nova senha' : 'Senha'}>
                  <span className="input-icon">
                    <KeyRound size={16} />
                    <input
                      type={show ? 'text' : 'password'}
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={
                        mode === 'signup' || recovery ? 'new-password' : 'current-password'
                      }
                      required
                      minLength={8}
                      placeholder="Mínimo de 8 caracteres"
                    />
                    <button
                      type="button"
                      className="reveal"
                      aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </Field>
              )}
              {(recovery || mode === 'signup') && (
                <>
                  <div className={`strength s${score}`} aria-live="polite">
                    <span>
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    {password ? strengthLabel[score] : 'Use letras, números e símbolos'}
                  </div>
                  <Field label="Confirmar senha">
                    <input
                      type={show ? 'text' : 'password'}
                      name="confirm"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                  </Field>
                </>
              )}
              {mode === 'login' && !recovery && (
                <div className="auth-row">
                  <button type="button" className="text-button" onClick={() => switchTo('reset')}>
                    Esqueci minha senha
                  </button>
                  <button type="button" className="text-button" onClick={() => switchTo('magic')}>
                    Entrar com link por e-mail
                  </button>
                </div>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="success" role="status">
                  {message}
                </p>
              )}
              <button className="button primary full ignition" disabled={pending}>
                {pending
                  ? 'Aguarde...'
                  : recovery
                    ? 'Salvar nova senha'
                    : {
                        login: 'Entrar',
                        signup: 'Criar conta',
                        reset: 'Enviar link',
                        magic: 'Enviar link de acesso',
                      }[mode]}
                <ArrowRight size={18} />
              </button>
              {(mode === 'reset' || mode === 'magic') && !recovery && (
                <button
                  type="button"
                  className="button ghost full"
                  onClick={() => switchTo('login')}
                >
                  Voltar para o login
                </button>
              )}
            </form>
          )}
          {config.demoEnabled && !recovery && (
            <>
              <div className="divider">
                <span>{client ? 'ou' : 'ambiente de demonstração'}</span>
              </div>
              <button className="button ghost full" onClick={enterDemo}>
                Explorar demonstração <ArrowUpRight size={18} />
              </button>
              <p className="fine-print">Dados fictícios, salvos apenas neste navegador.</p>
            </>
          )}
          {!client && (
            <div className="setup-note">
              {config.demoEnabled
                ? 'Para dados reais, configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY conforme o README.'
                : 'O administrador precisa configurar a URL e a chave publicável do Supabase.'}
            </div>
          )}
          <p className="auth-security">
            <ShieldCheck size={15} /> Conexão criptografada · sessão protegida pelo Supabase Auth
          </p>
        </div>
      </section>
    </main>
  );
}
