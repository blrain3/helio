import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { router } from './router';
import { configureApiInvalidation } from './lib/api';
import { browserSessionStore } from './lib/session';
import './index.css';

const queryClient = new QueryClient();

configureApiInvalidation(async (keys) => {
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
});

browserSessionStore.subscribe(() => {
  if (!browserSessionStore.getSession()) {
    queryClient.clear();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
