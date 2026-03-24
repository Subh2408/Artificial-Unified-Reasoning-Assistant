import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'DM Sans, sans-serif', color: '#1f2937' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              fontFamily: 'IBM Plex Mono, monospace', fontSize: 11,
              padding: '6px 14px', cursor: 'pointer',
              background: '#1f2937', color: '#fff', border: 'none', borderRadius: 3,
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
