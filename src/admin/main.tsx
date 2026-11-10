import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { AdminApp } from './AdminApp';
import '../index.css';

const rootElement = document.getElementById('admin-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AdminAuthProvider>
        <AdminApp />
      </AdminAuthProvider>
    </React.StrictMode>
  );
}
