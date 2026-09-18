import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { StorageProvider } from './context/StorageContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StorageProvider>
      <App />
    </StorageProvider>
  </StrictMode>,
);
