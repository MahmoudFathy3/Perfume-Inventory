import type { Migration } from '../migrate'

/**
 * كل شريك (غير صاحب المخزون) ليه عميل في المخزون الفعلي: اللي بياخده من المخزون الفعلي لنفسه
 * بيتسجل فاتورة بيع على العميل ده، وحسابه بيظهر في حسابات الشركاء. الربط بيتعمل من الكود (workspaces.service).
 */
const migration: Migration = {
  id: '009_partner_customer',
  sql: `
ALTER TABLE workspace_partners ADD COLUMN customer_id INTEGER REFERENCES customers(id);
`
}

export default migration
