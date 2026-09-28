import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { DialogProvider } from './components/ui/Dialogs.jsx';

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ToastProvider>
      <DialogProvider>
        <ReactFlowProvider>
          <App />
        </ReactFlowProvider>
      </DialogProvider>
    </ToastProvider>
  </ErrorBoundary>,
);
