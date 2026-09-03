import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './frontend/App';
import { ClerkProvider } from '@clerk/react';
import { ErrorBoundary } from './frontend/components/ErrorBoundary';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
console.log('[Clerk Init] publishableKey:', CLERK_PUBLISHABLE_KEY ? CLERK_PUBLISHABLE_KEY.substring(0, 20) + '...' : 'EMPTY');

// Catch any silent Clerk errors
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});
window.addEventListener('error', (event) => {
  console.error('[Window Error]', event.error);
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} clerkJSVersion="6.30.1">
        <App />
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
