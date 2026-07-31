import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ModelRegistryProvider } from './context/modelRegistry/ModelRegistryProvider';
import './index.css';
import App from './App.tsx';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');
createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <ModelRegistryProvider>
          <App />
        </ModelRegistryProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
