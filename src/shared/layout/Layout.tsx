import { Outlet } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspaces'
import { Sidebar } from './Sidebar'

export function Layout() {
  const { active } = useWorkspaces()
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-7 py-6">
        {/* لما المخزن يتغيّر، الصفحة بتتحمّل من الأول على بيانات المخزن الجديد */}
        <div key={active.id}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
