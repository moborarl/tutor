import React from 'react';
import ReactDOM from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import './styles/tokens.css';
import './styles/foundation.css';
import './styles/shared-components.css';
import './styles/shell.css';
import './styles/auth-family.css';
import './styles/explorer.css';
import './styles/data-workspace.css';
import { AppNotifications } from './components/AppNotifications';
import { initTelemetry } from './lib/telemetry';

// Radix's full theme is kept out of the critical CSS entry and loaded as a
// separate asset. This keeps first paint smaller without removing component styles.
void import('@radix-ui/themes/styles.css');
initTelemetry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme accentColor="grass" grayColor="olive" radius="medium" scaling="100%">
      <BrowserRouter>
        <AppNotifications>
          <App />
        </AppNotifications>
      </BrowserRouter>
    </Theme>
  </React.StrictMode>,
);
