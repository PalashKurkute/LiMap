import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../index.css';
import { initTheme } from '../theme/theme';
import HomePage from './HomePage';

// Links made before the home screen existed (`/?tour=1`) go straight to the tour on the dashboard.
if (new URLSearchParams(window.location.search).get('tour') === '1') {
  window.location.replace('/dashboard/?tour=1');
} else {
  initTheme();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HomePage />
    </StrictMode>,
  );
}
