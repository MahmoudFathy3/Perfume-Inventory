import { ArrowLeftRight, Lock, Pencil, Trash2, Unlock } from 'lucide-react'
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
}

export function WorkspacesTable({ rows, onSwitch, onEdit, onClose, onReopen, onDelete }: WorkspacesTableProps) {
  const { t } = useTranslation()
  const { label } = useWorkspaces()

  const columns: Column<Workspace>[] = [
    { key: 'name', header: t('common.name'), cell: (r) => <strong>{label(r)}</strong> },
    {
      key: 'partners',
      header: t('workspaces.partners'),
      cell: (r) => (r.partners.length === 0 ? '—' : r.partners.map((p) => `${p.name} (${p.share_percent}%)`).join(' • '))
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
        r.kind === 'personal' ? null : (
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
