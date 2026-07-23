import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyTheme, getAppColor } from './theme';
import './styles.css';

// Applique la couleur venue de l'environnement (APP_COLOR) avant le rendu
applyTheme(getAppColor());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
