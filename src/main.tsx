import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import React, { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './pages.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error) {
    console.error(error);
  }
  render() {
    return this.state.error ? (
      <main className="loading-screen">
        <h1>Algo travou nesta tela.</h1>
        <p>Recarregue para tentar novamente. Seus registros salvos continuam no banco.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Recarregar
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
async function start() {
  const [{ default: App }, { Provider }] = await Promise.all([
    import('./App'),
    import('./lib/store'),
  ]);
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Provider>
          <App />
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
start().catch((error) => {
  console.error(error);
  const root = document.getElementById('root')!;
  root.replaceChildren();
  const h = document.createElement('h1');
  h.textContent = 'Aplicação indisponível';
  const p = document.createElement('p');
  p.textContent =
    'Não foi possível carregar a configuração. Atualize a página ou verifique o servidor.';
  root.append(h, p);
});
