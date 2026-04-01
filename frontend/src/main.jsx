import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const DEFAULT_API_BASE = 'http://localhost:8000';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '');

// Expose resolved API base for links rendered in components.
window.__API_BASE = API_BASE;

// Rewrite old hardcoded localhost URLs at runtime for production builds.
if (!window.__API_PATCHED__) {
  window.__API_PATCHED__ = true;

  const rewriteUrl = (url) => {
    if (typeof url !== 'string') return url;
    return url.startsWith(DEFAULT_API_BASE) ? `${API_BASE}${url.slice(DEFAULT_API_BASE.length)}` : url;
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string') {
      return originalFetch(rewriteUrl(input), init);
    }

    if (input instanceof URL) {
      return originalFetch(new URL(rewriteUrl(input.toString())), init);
    }

    if (input instanceof Request) {
      return originalFetch(new Request(rewriteUrl(input.url), input), init);
    }

    return originalFetch(input, init);
  };

  const originalOpen = window.open.bind(window);
  window.open = (url, ...rest) => originalOpen(rewriteUrl(url), ...rest);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
