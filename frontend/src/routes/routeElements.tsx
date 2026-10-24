import { lazy } from 'react'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { GlobalLayout } from '@/components/layout/GlobalLayout'

// Every page is code-split (same pattern as QIRLPL LIMS routes/routeElements.tsx).
export const LandingPage = lazy(() => import('@/features/public-site/LandingPage'))
export const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
export const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
export const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
export const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
export const CapturePage = lazy(() => import('@/features/capture/CapturePage'))
export const CalibrationsPage = lazy(() => import('@/features/calibrations/CalibrationsPage'))
export const AnalysisPage = lazy(() => import('@/features/analysis/AnalysisPage'))
export const JobDetailPage = lazy(() => import('@/features/analysis/JobDetailPage'))
export const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
export const RingTestNewPage = lazy(() => import('@/features/ring-test/RingTestNewPage'))
export const RingTestReportsPage = lazy(() => import('@/features/ring-test/RingTestReportsPage'))
export const RingTestReportPage = lazy(() => import('@/features/ring-test/RingTestReportPage'))
export const RingTestSettingsPage = lazy(() => import('@/features/ring-test/RingTestSettingsPage'))
export const RingTestHelpPage = lazy(() => import('@/features/ring-test/RingTestHelpPage'))
export const PeriodicTablePage = lazy(() => import('@/features/periodic-table/PeriodicTablePage'))
export const ElementPage = lazy(() => import('@/features/periodic-table/ElementPage'))

/** Stable shell for every signed-in route — avoids remounting the layout between pages. */
export function AuthenticatedShell() {
  return (
    <RequireAuth>
      <GlobalLayout />
    </RequireAuth>
  )
}
