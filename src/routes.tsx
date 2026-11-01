import { Route, Routes } from 'react-router-dom'
import { CategoriesPage } from './features/categories'
import { CustomerDetailsPage, CustomersPage } from './features/customers'
import { DashboardPage } from './features/dashboard'
import { ItemDetailsPage, ItemsPage } from './features/items'
import { PartnersPage } from './features/partners'
import { PurchasesPage } from './features/purchases'
import { ReturnsPage } from './features/returns'
import { SalesPage } from './features/sales'
import { SettingsPage } from './features/settings'
import { TransfersPage } from './features/transfers'
import { WorkspacesPage } from './features/workspaces'
import { Layout } from './shared/layout/Layout'

/** كل صفحات التطبيق. لإضافة صفحة: ضيف Route هنا + رابط في Sidebar. */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="items/:id" element={<ItemDetailsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailsPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="transfers" element={<TransfersPage />} />
        <Route path="partners" element={<PartnersPage />} />
        <Route path="workspaces" element={<WorkspacesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
