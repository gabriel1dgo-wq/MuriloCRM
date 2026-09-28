import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { demoCommand, seedDemo } from './demo';
import { emptyState, normalizeState, type State } from './types';
export type Config = { supabaseUrl: string; supabaseKey: string; demoEnabled: boolean };
export const config: Config = await fetch('/config.json').then((r) => {
  if (!r.ok) throw new Error('Configuração indisponível.');
  return r.json();
});
export const client: SupabaseClient | null =
  config.supabaseUrl && config.supabaseKey
    ? createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
export const PHOTO_BUCKET = 'pixote-photos';
const DEMO_KEY = 'pixote.demo.v2';
type Store = {
  state: State;
  loading: boolean;
  error: string;
  demo: boolean;
  session: Session | null;
  authReady: boolean;
  busy: boolean;
  notice: string;
  recovery: boolean;
  finishRecovery: () => void;
  enterDemo: () => void;
  resetDemo: () => void;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  execute: (action: string, payload: Record<string, unknown>, requestId?: string) => Promise<void>;
  uploadPhoto: (file: File, folder: 'scraps' | 'parts') => Promise<string>;
  loadSignature: (orderId: string) => Promise<string>;
};
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState);
  const stateRef = useRef(state);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setReady] = useState(!client);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recovery, setRecovery] = useState(false);
  const epoch = useRef(0);
  const onboarded = useRef(false);
  const commit = useCallback((next: State) => {
    stateRef.current = next;
    setState(next);
  }, []);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    client.auth.getSession().then(({ data, error }) => {
      if (alive) {
        setSession(data.session);
        setReady(true);
        if (error) setError(authMessage(error));
      }
    });
    const { data } = client.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setReady(true);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const reload = useCallback(async () => {
    if (demo || !session || !client) return;
    const current = epoch.current;
    setLoading(true);
    setError('');
    try {
      const { data, error } = await client.rpc('z_snapshot');
      if (error) throw error;
      if (current !== epoch.current) return;
      const next = normalizeState(data as State);
      commit(next);
      // Primeiro acesso: aplica o nome da empresa informado no cadastro.
      const company = String(session.user.user_metadata?.company || '').trim();
      if (!onboarded.current && company && next.settings.name === 'Minha operação') {
        onboarded.current = true;
        await client.rpc('z_command', {
          request_id: crypto.randomUUID(),
          action: 'settings.save',
          payload: {
            ...next.settings,
            name: company.slice(0, 160),
            responsible: String(session.user.user_metadata?.name || '').slice(0, 160),
            email: session.user.email || '',
          },
        });
        const again = await client.rpc('z_snapshot');
        if (!again.error && current === epoch.current) commit(normalizeState(again.data as State));
      }
    } catch (e) {
      if (current === epoch.current) setError(message(e));
    } finally {
      if (current === epoch.current) setLoading(false);
    }
  }, [session?.user.id, demo, commit]);
  useEffect(() => {
    epoch.current++;
    commit(emptyState());
    if (!demo) void reload();
  }, [session?.user.id, demo, reload, commit]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  const enterDemo = () => {
    if (!config.demoEnabled) return;
    let next: State;
    try {
      const saved = localStorage.getItem(DEMO_KEY);
      next = saved ? normalizeState(JSON.parse(saved).state) : seedDemo();
      if (!next.parts.length && !next.orders.length) next = seedDemo();
    } catch {
      next = seedDemo();
    }
    setDemo(true);
    setError('');
    setLoading(false);
    setTimeout(() => commit(next), 0);
  };
  const resetDemo = () => {
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {
      /* armazenamento indisponível */
    }
    commit(seedDemo());
    setNotice('Demonstração restaurada.');
  };
  const execute: Store['execute'] = async (action, payload, requestId = crypto.randomUUID()) => {
    if (lock.current) throw new Error('Aguarde a operação em andamento.');
    lock.current = true;
    setBusy(true);
    try {
      if (demo) {
        let saved: { requests?: Record<string, string> } = {};
        try {
          saved = JSON.parse(localStorage.getItem(DEMO_KEY) || '{}');
        } catch {
          saved = {};
        }
        const requests = saved.requests || {};
        const body = JSON.stringify({ action, payload });
        if (requests[requestId] && requests[requestId] !== body)
          throw new Error('Identificador já utilizado.');
        if (!requests[requestId]) {
          const next = demoCommand(stateRef.current, { action, payload, request_id: requestId });
          commit(next);
          try {
            // Guarda só os últimos pedidos para não estourar o armazenamento do navegador.
            const kept = Object.entries({ ...requests, [requestId]: body }).slice(-200);
            localStorage.setItem(
              DEMO_KEY,
              JSON.stringify({ state: next, requests: Object.fromEntries(kept) }),
            );
          } catch {
            setError(
              'O navegador não conseguiu salvar a demonstração (espaço cheio). As alterações valem até recarregar a página.',
            );
          }
        }
      } else {
        if (!client || !session) throw new Error('Entre na sua conta.');
        const { error } = await client.rpc('z_command', { request_id: requestId, action, payload });
        if (error) throw error;
        await reload();
      }
      setNotice('Operação registrada.');
    } catch (e) {
      throw new Error(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const uploadPhoto: Store['uploadPhoto'] = async (file, folder) => {
    if (!file.type.startsWith('image/')) throw new Error('Envie um arquivo de imagem.');
    if (demo) return compress(file, 720, 0.72).then(blobToDataUrl);
    if (!client || !session) throw new Error('Entre na sua conta.');
    const blob = await compress(file, 1600, 0.82);
    const path = `${session.user.id}/${folder}/${crypto.randomUUID()}.jpg`;
    const { error } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error)
      throw new Error(
        /bucket/i.test(error.message)
          ? 'O armazenamento de fotos ainda não foi configurado no Supabase. Consulte o README.'
          : error.message,
      );
    return path;
  };
  const loadSignature: Store['loadSignature'] = async (orderId) => {
    if (demo) return stateRef.current.orders.find((o) => o.id === orderId)?.signature || '';
    if (!client) return '';
    const { data, error } = await client
      .from('z_orders')
      .select('signature')
      .eq('id', orderId)
      .single();
    if (error) throw new Error(message(error));
    return (data?.signature as string) || '';
  };
  const signOut = async () => {
    if (!demo && client) {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(message(error));
    }
    epoch.current++;
    onboarded.current = false;
    setDemo(false);
    setSession(null);
    setRecovery(false);
    commit(emptyState());
    setError('');
    window.location.hash = '';
  };
  return (
    <Context.Provider
      value={{
        state,
        loading,
        error,
        demo,
        session,
        authReady,
        busy,
        notice,
        recovery,
        finishRecovery: () => setRecovery(false),
        enterDemo,
        resetDemo,
        signOut,
        reload,
        execute,
        uploadPhoto,
        loadSignature,
      }}
    >
      {children}
    </Context.Provider>
  );
}
async function compress(file: File, max: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Não foi possível processar a imagem.'))),
      'image/jpeg',
      quality,
    ),
  );
}
const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
const signedCache = new Map<string, { url: string; expires: number }>();
/** Resolve caminhos do Storage em URLs assinadas (data: URLs da demonstração passam direto). */
export function usePhotoUrls(paths: string[]) {
  const key = paths.join('|');
  const [urls, setUrls] = useState<Record<string, string>>(() => resolveCached(paths));
  useEffect(() => {
    let alive = true;
    const missing = paths.filter(
      (p) => !p.startsWith('data:') && (signedCache.get(p)?.expires ?? 0) <= Date.now(),
    );
    if (!missing.length || !client) {
      setUrls(resolveCached(paths));
      return;
    }
    client.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        data?.forEach((d) => {
          if (d.signedUrl && d.path)
            signedCache.set(d.path, { url: d.signedUrl, expires: Date.now() + 3300_000 });
        });
        if (alive) setUrls(resolveCached(paths));
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return urls;
}
function resolveCached(paths: string[]) {
  return Object.fromEntries(
    paths.map((p) => [p, p.startsWith('data:') ? p : signedCache.get(p)?.url || '']),
  );
}
/** Remoção best-effort de arquivos que deixaram de ser usados. */
export async function removePhotos(paths: string[]) {
  const stored = paths.filter((p) => !p.startsWith('data:'));
  if (client && stored.length) await client.storage.from(PHOTO_BUCKET).remove(stored);
}
export function authMessage(error: unknown) {
  const text = (error as { message?: string })?.message || '';
  if (/invalid login credentials/i.test(text)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(text))
    return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/user already registered/i.test(text)) return 'Este e-mail já possui cadastro. Faça login.';
  if (/rate limit|too many/i.test(text))
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.';
  if (/password should be/i.test(text)) return 'A senha não atende aos requisitos mínimos.';
  if (/failed to fetch|network/i.test(text))
    return 'Sem conexão com o servidor. Verifique sua internet.';
  return text || 'Não foi possível concluir. Tente novamente.';
}
function message(error: unknown): string {
  const e = error as { message?: string; code?: string };
  if (e.code === '23505') return 'Este código já existe ou a operação já foi registrada.';
  if (e.code === '23503') return 'O registro vinculado não existe ou pertence a outra conta.';
  if (e.code === '23514' && e.message && !/violates/.test(e.message)) return e.message;
  if (e.code === '23514' || e.code === '23502' || e.code === '22P02' || e.code === '22007')
    return 'Verifique os campos, valores e datas informados.';
  if (e.code === 'PGRST202')
    return 'A estrutura do Pixote ainda não foi instalada neste Supabase. Consulte o guia de instalação.';
  return e.message || 'Não foi possível concluir. Tente novamente.';
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error('Provider ausente');
  return value;
}
