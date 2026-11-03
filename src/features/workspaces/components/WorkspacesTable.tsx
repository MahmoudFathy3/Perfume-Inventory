import { ArrowLeftRight, Lock, Pencil, Trash2, Unlock, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Workspace } from '@shared/types'
import { Badge, Button, DataTable, RowActions } from '@/shared/components/ui'
import type { Column } from '@/shared/components/ui'
import { useWorkspaces } from '../WorkspaceProvider'

interface WorkspacesTableProps {
  rows: Workspace[]
  onSwitch: (row: Workspace) => void
  onEdit: (row: Workspace) => void
  onClose: (row: Workspace) => void
  onReopen: (row: Workspace) => void
  onDelete: (row: Workspace) => void
  /** تحديد / تعديل صاحب المخزون الفعلي */
  onEditOwner: () => void
}

export function WorkspacesTable({ rows, onSwitch, onEdit, onClose, onReopen, onDelete, onEditOwner }: WorkspacesTableProps) {
  const { t } = useTranslation()
  const { label, owner } = useWorkspaces()

  const columns: Column<Workspace>[] = [
    { key: 'name', header: t('common.name'), cell: (r) => <strong>{label(r)}</strong> },
    {
      key: 'partners',
      header: t('workspaces.partners'),
      cell: (r) => {
        if (r.kind === 'personal') return owner ? `${t('workspaces.owner')}: ${owner}` : <span className="text-amber-700">{t('workspaces.ownerMissing')}</span>
        if (r.partners.length === 0) return '—'
        return (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {r.partners.map((p, i) => (
              <span key={p.id} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-slate-300">•</span>}
                {p.name} ({p.share_percent}%)
                {p.is_owner && <Badge tone="teal">{t('workspaces.ownerTag')}</Badge>}
              </span>
            ))}
          </span>
        )
      }
    },
    {
      key: 'status',
      header: t('workspaces.status'),
      cell: (r) =>
        r.active ? <Badge tone="teal">{t('workspaces.current')}</Badge> : r.closed_at ? <Badge tone="slate">{t('workspaces.closed')}</Badge> : <Badge tone="green">{t('workspaces.open')}</Badge>
    },
    {
      key: 'actions',
      header: t('common.actions'),
      cell: (r) =>
        r.kind === 'personal' ? (
          <Button size="sm" icon={UserRound} onClick={onEditOwner}>{t(owner ? 'workspaces.editOwner' : 'workspaces.setOwner')}</Button>
        ) : (
          <RowActions>
            {!r.active && !r.closed_at && <Button size="sm" variant="primary" icon={ArrowLeftRight} onClick={() => onSwitch(r)}>{t('workspaces.switchTo')}</Button>}
            <Button size="sm" icon={Pencil} onClick={() => onEdit(r)}>{t('common.edit')}</Button>
            {r.closed_at ? (
              <Button size="sm" icon={Unlock} onClick={() => onReopen(r)}>{t('workspaces.reopen')}</Button>
            ) : (
              <Button size="sm" icon={Lock} onClick={() => onClose(r)}>{t('workspaces.close')}</Button>
            )}
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(r)}>{t('common.delete')}</Button>
          </RowActions>
        )
    }
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
}
