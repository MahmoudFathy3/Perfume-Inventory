import { useQuery } from '@/shared/hooks/useQuery'
import { transfersApi } from '../../transfers'
import { useWorkspaces } from '../../workspaces'

/**
 * منتجات المخازن التانية اللي ينفع تتباع في فاتورة المخزن النشط (وتتحوّل تلقائي وقت الحفظ):
 * في الشراكة = المخزون الفعلي، وفي المخزون الفعلي = الشراكات المفتوحة اللي صاحب المخزون شريك فيها.
 * من غير صاحب مخزون محدد مفيش (التحويل بيتعمل باسمه).
 */
export function useForeignItems() {
  const { active, workspaces, owner, label } = useWorkspaces()
  const ownerIn = (id: number) => workspaces.find((w) => w.id === id)?.partners.some((p) => p.is_owner) ?? false

  const stores = !owner
    ? []
    : active.kind === 'partnership'
      ? ownerIn(active.id) ? workspaces.filter((w) => w.kind === 'personal') : []
      : active.kind === 'personal'
        ? workspaces.filter((w) => w.kind === 'partnership' && !w.closed_at && ownerIn(w.id))
        : []

  const { data, reload } = useQuery(
    () => Promise.all(stores.map(async (s) => ({ workspace_id: s.id, name: label(s), items: await transfersApi.items({ workspace_id: s.id }) }))),
    [active.id, stores.map((s) => s.id).join(',')]
  )
  return { foreign: data ?? [], reload }
}
