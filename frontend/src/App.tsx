import { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { WorkspaceLoading } from '@/components/auth/RequireAuth'
import {
  AnalysisPage,
  AuthenticatedShell,
  CalibrationsPage,
  CapturePage,
  DashboardPage,
  ElementPage,
  HardnessConversionPage,
  PhaseDiagramPage,
  JobDetailPage,
  LandingPage,
  LoginPage,
  PeriodicTablePage,
  RegisterPage,
  ResetPasswordPage,
  RingTestHelpPage,
  RingTestNewPage,
  RingTestReportPage,
  RingTestReportsPage,
  RingTestSettingsPage,
  SettingsPage,
} from '@/routes/routeElements'

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<WorkspaceLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/app" element={<AuthenticatedShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="capture" element={<CapturePage />} />
            <Route path="calibrations" element={<CalibrationsPage />} />
            <Route path="analysis" element={<AnalysisPage />} />
            <Route path="jobs" element={<Navigate to="/app/analysis?view=jobs" replace />} />
            <Route path="jobs/:id" element={<JobDetailPage />} />
            <Route path="admin" element={<SettingsPage />} />
            <Route path="ring-test" element={<RingTestNewPage />} />
            <Route path="ring-test/reports" element={<RingTestReportsPage />} />
            <Route path="ring-test/reports/:id" element={<RingTestReportPage />} />
            <Route path="ring-test/settings" element={<RingTestSettingsPage />} />
            <Route path="ring-test/help" element={<RingTestHelpPage />} />
            <Route path="hardness" element={<HardnessConversionPage />} />
            <Route path="phase-diagram" element={<PhaseDiagramPage />} />
            <Route path="periodic-table" element={<PeriodicTablePage />} />
            <Route path="periodic-table/element/:symbol" element={<ElementPage />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
