import { Outlet } from 'react-router-dom'
import { useWorkspaces } from '@/features/workspaces'
import { Sidebar } from './Sidebar'

export function Layout() {
  const { active } = useWorkspaces()
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-5 xl:px-7 xl:py-6">
        {/* لما المخزن يتغيّر، الصفحة بتتحمّل من الأول على بيانات المخزن الجديد */}
        <div key={active.id}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
