import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/hooks/useAuth'
import { AppThemeProvider } from '@/hooks/useAppTheme'
import { applyTheme, readStoredTheme } from '@/lib/appTheme'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import './index.css'
import './styles/metallurgy.css'
import App from './App.tsx'

// Theme before the first paint (Settings → Theme).
applyTheme(readStoredTheme())

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </QueryClientProvider>
      </AppThemeProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
