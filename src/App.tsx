import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Boxes,
  CarFront,
  Gauge,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShoppingBag,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { useStore } from './lib/store';
import { today, dateLabel, includes, money, osNumber, type Page } from './lib/types';
import { Brand, Grime, Logo } from './components/ui';
import { Auth } from './pages/Auth';
import { Overview } from './pages/Overview';
import { Stock } from './pages/Stock';
import { Scraps } from './pages/Scraps';
import { Contacts } from './pages/Contacts';
import { Sales } from './pages/Sales';
import { Workshop } from './pages/Workshop';
import { Finance } from './pages/Finance';
import { Settings } from './pages/Settings';
const navigation = [
  { id: 'overview', label: 'Painel', icon: Gauge },
  { id: 'parts', label: 'Estoque', icon: Boxes },
  { id: 'scraps', label: 'Sucatas', icon: CarFront },
  { id: 'sales', label: 'Vendas', icon: ShoppingBag },
  { id: 'workshop', label: 'Oficina', icon: Wrench },
  { id: 'cash', label: 'Financeiro', icon: Wallet },
  { id: 'contacts', label: 'Clientes e fornecedores', icon: Users },
  { id: 'settings', label: 'Configurações', icon: SettingsIcon },
] as const;
function readPage(): Page {
  const id = location.hash.replace('#/', '').split('?')[0];
  return navigation.some((n) => n.id === id) ? (id as Page) : 'overview';
}
export default function App() {
  const {
    state,
    demo,
    session,
    authReady,
    loading,
    error,
    notice,
    reload,
    signOut,
    recovery,
    busy,
  } = useStore();
  const [page, setPage] = useState<Page>(readPage);
  const [menu, setMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const [finder, setFinder] = useState(false);
  const [focus, setFocus] = useState<string>();
  const [logoutError, setLogoutError] = useState('');
  const navigate = (p: Page, target?: string) => {
    location.hash = '/' + p;
    setPage(p);
    setMenu(false);
    setCreating(false);
    setFocus(target);
  };
  useEffect(() => {
    const fn = () => {
      setPage(readPage());
      setCreating(false);
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  useEffect(() => {
    document.title = `${navigation.find((n) => n.id === page)?.label} · Pixote CRM`;
  }, [page]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setFinder((v) => !v);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  const create = (p: Page) => {
    navigate(p);
    setTimeout(() => setCreating(true), 40);
  };
  if (!authReady)
    return (
      <div className="loading-screen">
        <Grime />
        <Logo size={64} />
        <p>Aquecendo o motor...</p>
      </div>
    );
  if ((!session && !demo) || recovery) return <Auth />;
  const openOs = state.orders.filter(
    (o) => o.kind === 'oficina' && !['cancelada', 'entregue'].includes(o.status),
  ).length;
  const low = state.parts.filter((p) => !p.archived && p.quantity <= p.minimum).length;
  const overdue = state.bills.filter((b) => b.status === 'aberta' && b.due_date < today()).length;
  const counters: Partial<Record<Page, number>> = { workshop: openOs, parts: low, cash: overdue };
  return (
    <div className="app-shell">
      <Grime />
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      {menu && (
        <button
          className="mobile-overlay"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <div className="sidebar-top">
          <a href="#/overview" onClick={() => navigate('overview')} aria-label="Pixote CRM, painel">
            <Brand />
          </a>
          <button
            className="mobile-close icon-button"
            aria-label="Fechar navegação"
            onClick={() => setMenu(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace">
          <span className="workspace-avatar">{state.settings.name.slice(0, 2).toUpperCase()}</span>
          <span>
            <strong>{state.settings.name}</strong>
            <small>{demo ? 'Demonstração' : 'Operação conectada'}</small>
          </span>
        </div>
        <nav aria-label="Navegação principal">
          <span className="nav-caption">OPERAÇÃO</span>
          {navigation.map((n, i) => (
            <div key={n.id}>
              {i === 6 && <span className="nav-caption">CADASTROS</span>}
              <button
                className={`nav-link ${page === n.id ? 'active' : ''}`}
                aria-label={counters[n.id] ? `${n.label} (${counters[n.id]} pendente(s))` : n.label}
                aria-current={page === n.id ? 'page' : undefined}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {!!counters[n.id] && (
                  <span className={`nav-count ${n.id === 'workshop' ? '' : 'alert'}`}>
                    {counters[n.id]}
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account">
            <span className="avatar">
              {(state.settings.responsible || session?.user.email || 'PX')
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span>
              <strong>{state.settings.responsible || session?.user.email || 'Visitante'}</strong>
              <small>{demo ? 'Modo demonstração' : 'Conta autenticada'}</small>
            </span>
            <button
              className="icon-button"
              aria-label="Sair da conta"
              title="Sair"
              disabled={busy}
              onClick={async () => {
                try {
                  await signOut();
                } catch (e) {
                  setLogoutError((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir navegação"
            onClick={() => setMenu(true)}
          >
            <Menu size={21} />
          </button>
          <button className="finder-trigger" onClick={() => setFinder(true)}>
            <Search size={16} />
            <span>Buscar peça, OS, cliente, placa...</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-right">
            <span className="today-label">{dateLabel(today())}</span>
            <span className={`connection ${demo ? 'demo' : ''}`}>
              <span className="dot" />
              {demo ? 'Demonstração' : 'Supabase'}
            </span>
            <button
              className="icon-button"
              disabled={loading || demo || busy}
              aria-label="Atualizar dados"
              title="Atualizar dados"
              onClick={() => void reload()}
            >
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span className="hazard-chip" aria-hidden="true" />
            <span>
              <strong>Modo demonstração.</strong> Dados fictícios salvos só neste navegador.
            </span>
            <button onClick={() => void signOut()}>
              Ir para o acesso real <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        <main id="main-content" tabIndex={-1} className="main-content" key={page}>
          {(error || logoutError) && (
            <div className="error" role="alert">
              <strong>Não foi possível atualizar a operação.</strong>
              <p>{error || logoutError}</p>
              {!demo && (
                <button
                  className="button ghost small"
                  onClick={() => {
                    setLogoutError('');
                    void reload();
                  }}
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}
          {loading && !state.parts.length && !state.orders.length ? (
            <div className="skeleton-grid" aria-label="Carregando dados">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} />
              ))}
            </div>
          ) : (
            <>
              {page === 'overview' && <Overview navigate={navigate} create={create} />}
              {page === 'parts' && <Stock focus={focus} />}
              {page === 'scraps' && <Scraps focus={focus} />}
              {page === 'contacts' && <Contacts />}
              {page === 'sales' && (
                <Sales
                  creating={creating}
                  onCreate={() => setCreating(true)}
                  onClose={() => setCreating(false)}
                />
              )}
              {page === 'workshop' && (
                <Workshop
                  focus={focus}
                  creating={creating}
                  onCreate={() => setCreating(true)}
                  onClose={() => setCreating(false)}
                />
              )}
              {page === 'cash' && <Finance />}
              {page === 'settings' && <Settings />}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            <strong>PIXOTE</strong> CRM · estoque, oficina e caixa no mesmo motor.
          </span>
          <span>{state.settings.name}</span>
        </footer>
      </div>
      {finder && <Finder close={() => setFinder(false)} go={navigate} />}
      {notice && (
        <div className="toast" role="status">
          <span className="toast-icon">✓</span>
          {notice}
        </div>
      )}
    </div>
  );
}

function Finder({ close, go }: { close: () => void; go: (p: Page, target?: string) => void }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const box = (id: string | null) => state.boxes.find((b) => b.id === id)?.code || '';
    return [
      ...state.parts
        .filter((p) => !p.archived && includes(q, p.name, p.code, p.oem, p.fits, box(p.box_id)))
        .map((p) => ({
          key: p.id,
          page: 'parts' as Page,
          icon: Boxes,
          title: p.name,
          detail: `${p.code} · caixa ${box(p.box_id) || 'sem caixa'} · ${p.quantity} un. · ${money(p.price)}`,
        })),
      ...state.orders
        .filter((o) => includes(q, o.customer, osNumber(o), o.plate, o.vehicle, o.external_ref))
        .map((o) => ({
          key: o.id,
          page: (o.kind === 'venda' ? 'sales' : 'workshop') as Page,
          icon: o.kind === 'venda' ? ShoppingBag : Wrench,
          title: `${osNumber(o)} · ${o.customer}`,
          detail: `${o.vehicle || o.channel} ${o.plate ? '· ' + o.plate : ''} · ${money(o.total)}`,
        })),
      ...state.scraps
        .filter((s) => includes(q, s.code, s.vehicle, s.plate, s.chassis))
        .map((s) => ({
          key: s.id,
          page: 'scraps' as Page,
          icon: CarFront,
          title: `${s.code} · ${s.vehicle}`,
          detail: `${s.plate || 'sem placa'} · ${s.year}`,
        })),
      ...state.contacts
        .filter((c) => includes(q, c.name, c.phone, c.document))
        .map((c) => ({
          key: c.id,
          page: 'contacts' as Page,
          icon: Users,
          title: c.name,
          detail: c.phone || c.email || 'Contato',
        })),
    ].slice(0, 12);
  }, [q, state]);
  const pick = (r: (typeof results)[number]) => {
    go(r.page, r.key);
    close();
  };
  return (
    <dialog
      ref={ref}
      className="finder"
      aria-label="Busca global"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
    >
      <div className="finder-input">
        <Search size={19} />
        <input
          autoFocus
          aria-label="Buscar em todo o sistema"
          placeholder="Digite peça, código OEM, caixa, placa, OS ou cliente"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setCursor((c) => Math.min(c + 1, results.length - 1));
            if (e.key === 'ArrowUp') setCursor((c) => Math.max(c - 1, 0));
            if (e.key === 'Enter' && results[cursor]) pick(results[cursor]);
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <div className="finder-results">
        {q.trim().length < 2 ? (
          <p className="finder-hint">Digite pelo menos 2 caracteres. Use ↑ ↓ e Enter.</p>
        ) : results.length ? (
          results.map((r, i) => (
            <button
              key={r.key}
              className={`list-row ${i === cursor ? 'active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(r)}
            >
              <span className="list-icon">
                <r.icon size={17} />
              </span>
              <span className="grow">
                <strong>{r.title}</strong>
                <small>{r.detail}</small>
              </span>
            </button>
          ))
        ) : (
          <p className="finder-hint">Nada encontrado para “{q}”.</p>
        )}
      </div>
    </dialog>
  );
}
