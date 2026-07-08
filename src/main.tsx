import React from 'react';
import ReactDOM from 'react-dom/client';
import { Theme } from '@radix-ui/themes';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import '@radix-ui/themes/styles.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme accentColor="indigo" grayColor="slate" radius="medium" scaling="95%">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Theme>
  </React.StrictMode>,
);
