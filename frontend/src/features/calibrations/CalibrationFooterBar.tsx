export function CalibrationFooterBar({
  selectedCount,
  canDelete,
  deleting,
  onDelete,
}: {
  selectedCount: number
  canDelete: boolean
  deleting: boolean
  onDelete: () => void
}) {
  if (!canDelete || selectedCount === 0) return null
  return (
    <div className="flex items-center justify-between card px-4 py-3 text-sm">
      <span>{selectedCount} selected</span>
      <button type="button" className="btn btn-ghost text-[var(--danger)]" disabled={deleting} onClick={onDelete}>
        {deleting ? 'Deleting…' : 'Delete Selected'}
      </button>
    </div>
  )
}
