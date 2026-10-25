import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { RequireRole } from '@/components/auth/RequireRole'
import { SETTINGS_MENU, type SettingsSection } from '@/lib/appNav'
import { LabSettingsSection } from '@/features/settings/lab/LabSettingsSection'
import { UserManagementSection } from '@/features/settings/users/UserManagementSection'
import { RolesSection } from '@/features/settings/roles/RolesSection'
import { AuditLogSection } from '@/features/settings/audit/AuditLogSection'
import { MyAccountSection } from '@/features/settings/account/MyAccountSection'
import { ThemeSection } from '@/features/settings/theme/ThemeSection'

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const { org } = useAuth()
  const section = (searchParams.get('section') || 'lab') as SettingsSection
  const meta = SETTINGS_MENU.find((m) => m.section === section)

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="page-title">{meta?.label || 'Settings'}</h1>
      </div>

      {section === 'lab' && (
        <RequireRole min="admin">
          <LabSettingsSection />
        </RequireRole>
      )}
      {section === 'users' && (
        <RequireRole min="admin">
          <UserManagementSection />
        </RequireRole>
      )}
      {section === 'roles' && (
        <RequireRole min="admin">
          <RolesSection />
        </RequireRole>
      )}
      {section === 'audit' && (
        <RequireRole min="admin">
          <AuditLogSection />
        </RequireRole>
      )}
      {section === 'theme' && <ThemeSection />}
      {section === 'account' && <MyAccountSection />}

      {section === 'contact' && (
        <section className="card p-6 space-y-3">
          <div className="text-sm space-y-1">
            <p>
              <b>Email:</b> support@metallurgylab.app
            </p>
            <p>
              <b>Lab:</b> {org?.name || '—'}
            </p>
          </div>
        </section>
      )}

      {section === 'help' && (
        <section className="card p-6 space-y-3">
          <ul className="text-sm text-[var(--muted)] space-y-2 list-disc pl-5">
            <li>Use Capture Studio to Upload or Capture Microscope Images.</li>
            <li>Set Calibration Before Running Grain Size or Depth Analysis.</li>
            <li>Choose the Etch Type for Grain Size: Boundary Etch (Default) or Contrast / Tint Etch.</li>
            <li>Reviewers Can Approve or Reject Jobs From the Job Detail Page.</li>
          </ul>
        </section>
      )}

      {!meta && <p className="text-sm text-[var(--muted)]">Select a Settings Option From the Profile Menu.</p>}
    </div>
  )
}
