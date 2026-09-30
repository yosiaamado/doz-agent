import { Component } from 'react';
import { useI18n } from '../../i18n/I18nProvider.jsx';

// Class component tidak bisa memakai hook; teks diambil dari komponen kecil ini.
function Fallback({ error, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="loading" role="alert">
      <div style={{ textAlign: 'center' }}>
        <h2>{t('dialogs.error-boundary.title')}</h2>
        <p className="muted">{error.message}</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>{t('common.retry')}</button>
      </div>
    </div>
  );
}

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
    return <Fallback error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}
