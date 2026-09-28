import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="loading" role="alert">
        <div style={{ textAlign: 'center' }}>
          <h2>Terjadi Kesalahan di Tampilan</h2>
          <p className="muted">{this.state.error.message}</p>
          <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>Coba Lagi</button>
        </div>
      </div>
    );
  }
}
