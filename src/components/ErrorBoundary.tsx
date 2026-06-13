import { Component } from 'react'
import type { ErrorInfo, ReactNode, CSSProperties } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error('[Space Sentinel] Uncaught error in App:', error, errorInfo)
  }

  handleReload = (): void => { window.location.reload() }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={styles.container}>
          <div style={styles.box}>
            <div style={styles.title}>Something went wrong</div>
            <pre style={styles.error}>{this.state.error.toString()}</pre>
            <button onClick={this.handleReload} style={styles.button}>
              Reload Game
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a1a',
    color: '#e0e0e0',
    fontFamily: 'monospace',
    zIndex: 9999,
  },
  box: {
    maxWidth: '600px',
    padding: '32px',
    textAlign: 'center',
  },
  title: {
    fontSize: '24px',
    color: '#ff6b6b',
    marginBottom: '16px',
  },
  error: {
    fontSize: '12px',
    color: '#888',
    background: '#111',
    padding: '12px',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '200px',
    marginBottom: '20px',
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  button: {
    padding: '10px 24px',
    fontSize: '14px',
    backgroundColor: '#22d3ee',
    color: '#000',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
}

export default ErrorBoundary
