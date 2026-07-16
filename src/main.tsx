import React from 'react';
import ReactDOM from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@radix-ui/themes/styles.css';
import './styles.css';
import './styles/tokens.css';
import './styles/foundation.css';
import './styles/shared-components.css';
import './styles/shell.css';
import './styles/auth-family.css';
import { AppNotifications } from './components/AppNotifications';

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
