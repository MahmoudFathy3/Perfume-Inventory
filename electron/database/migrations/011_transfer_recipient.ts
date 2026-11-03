import type { Migration } from '../migrate'

/**
 * التحويل من المخزون الفعلي للشراكة "لمين": owner = صاحب المخزون، partner = الشريك التاني (اشترى القطع من صاحب المخزون)،
 * partnership = منتجات الشراكة بالنص (الشراكة عليها التكلفة لصاحب المخزون). NULL = تحويلات قديمة / الاتجاه التاني.
 * partner_sale_id: فاتورة البيع اللي اتعملت على عميل الشريك في المخزون الفعلي (لما التحويل يكون للشريك).
 */
const migration: Migration = {
  id: '011_transfer_recipient',
  sql: `
ALTER TABLE transfers ADD COLUMN recipient TEXT CHECK (recipient IN ('owner','partner','partnership'));
ALTER TABLE transfers ADD COLUMN partner_sale_id INTEGER REFERENCES sales(id);
`
}

export default migration
