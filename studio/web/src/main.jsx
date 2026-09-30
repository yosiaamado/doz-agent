import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { DialogProvider } from './components/ui/Dialogs.jsx';
import { I18nProvider } from './i18n/I18nProvider.jsx';

createRoot(document.getElementById('root')).render(
  // I18nProvider paling luar supaya ErrorBoundary dan toast juga bisa menerjemahkan.
  <I18nProvider>
    <ErrorBoundary>
      <ToastProvider>
        <DialogProvider>
          <ReactFlowProvider>
            <App />
          </ReactFlowProvider>
        </DialogProvider>
      </ToastProvider>
    </ErrorBoundary>
  </I18nProvider>,
);
