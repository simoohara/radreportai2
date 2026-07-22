import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Oups, une erreur inattendue est survenue !</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px', maxWidth: '500px' }}>
            L'application a rencontré un problème technique. Vos données ont été préservées autant que possible.
            Veuillez recharger la page pour continuer.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            🔄 Recharger la page
          </button>
          {import.meta.env.MODE === 'development' && this.state.error && (
            <pre style={{
              marginTop: '40px',
              padding: '16px',
              background: 'var(--color-surface-hover)',
              borderRadius: '8px',
              maxWidth: '80%',
              overflow: 'auto',
              textAlign: 'left',
              fontSize: '12px'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
