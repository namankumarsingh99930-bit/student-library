import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Admin from './Admin';
import './index.css';

const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isAdmin ? <Admin /> : <App />}</React.StrictMode>
);
