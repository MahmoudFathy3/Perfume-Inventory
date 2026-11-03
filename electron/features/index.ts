import type { IpcContext } from '../lib/context'
import { AppError } from '../lib/errors'
import { createHandle } from '../lib/ipc'
import * as auth from './auth/auth.ipc'
import * as backup from './backup/backup.ipc'
import * as categories from './categories/categories.ipc'
import * as clipboard from './clipboard/clipboard.ipc'
import * as customers from './customers/customers.ipc'
import * as dashboard from './dashboard/dashboard.ipc'
import * as exporting from './export/export.ipc'
import * as items from './items/items.ipc'
import * as partners from './partners/partners.ipc'
import * as payments from './payments/payments.ipc'
import * as printing from './printing/printing.ipc'
import * as purchases from './purchases/purchases.ipc'
import * as returns from './returns/returns.ipc'
import * as sales from './sales/sales.ipc'
import * as settings from './settings/settings.ipc'
import * as transfers from './transfers/transfers.ipc'
import * as warehouse from './warehouse/warehouse.ipc'
import * as workspaces from './workspaces/workspaces.ipc'

/** تسجيل كل أوامر الـ IPC. لإضافة feature جديدة: اعمل ملف ipc وضيفه هنا. */
export function registerAll(ctx: IpcContext): void {
  // التطبيق المقفول بيرفض كل الأوامر ما عدا الخاصة بكلمة السر
  const handle = createHandle(ctx.ipcMain, (channel) => {
    if (!channel.startsWith('auth:') && ctx.session.state() !== 'unlocked') throw new AppError('LOCKED')
  })
  const features = [auth, workspaces, categories, items, purchases, sales, customers, payments, returns, transfers, warehouse, partners, dashboard, settings, backup, exporting, printing, clipboard]
  for (const feature of features) feature.register(handle, ctx)
}
