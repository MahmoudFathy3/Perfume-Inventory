/**
 * الأنواع المشتركة بين الـ backend (electron/) والواجهة (src/).
 * ملف أنواع فقط (مفيش كود بيتنفذ هنا).
 */

// ---------- أنواع أساسية ----------
export type Condition = 'new' | 'damaged'
export type PriceType = 'retail' | 'wholesale'
/** مين بيدفع شحن فاتورة البيع: العميل (بيتضاف على الفاتورة) أو المحل (مصروف بيتخصم من الربح) */
export type ShippingPayer = 'customer' | 'shop'
export type ReturnKind = 'sale' | 'purchase'
export type MovementType = 'purchase' | 'sale' | 'sale_return' | 'purchase_return' | 'transfer_in' | 'transfer_out'
export type LanguageCode = 'ar' | 'en'

/** رقم أو نص رقمي (الفورم بيبعت نصوص، والـ backend بيحوّلها) */
export type NumLike = number | string

// ---------- IPC ----------
export type IpcResponse<T> = { ok: true; data: T } | { ok: false; error: string }

// ---------- Pagination (بيتعمل في الـ backend) ----------
export interface PageParams {
  /** رقم الصفحة من 1 */
  page?: number
  pageSize?: number
}

export interface Page<T> {
  rows: T[]
  /** إجمالي الصفوف (بعد البحث) */
  total: number
  page: number
  pageSize: number
  pageCount: number
}

// ---------- المساحات (المخزون الفعلي والشراكات) ----------
/** warehouse = مخزن خارجي (السعودية): كميات وشحنات بس */
export type WorkspaceKind = 'personal' | 'partnership' | 'warehouse'

export interface WorkspacePartner {
  id: number
  name: string
  share_percent: number
  /** هل هو صاحب المخزون الفعلي؟ (بالاسم، من غير تفرقة همزة/تاء مربوطة) */
  is_owner: boolean
  /** عميله في المخزون الفعلي (اللي بياخده لنفسه بيتسجل فاتورة عليه). null لصاحب المخزون */
  customer_id: number | null
}

export interface Workspace {
  id: number
  kind: WorkspaceKind
  /** المخزون الفعلي اسمه بيتترجم في الواجهة، واسم الشراكة بيتكتب */
  name: string
  closed_at: string | null
  partners: WorkspacePartner[]
  /** هل هي المساحة اللي شغالين عليها دلوقتي؟ */
  active: boolean
}

/** ملخص مخزن واحد (كروت المخازن في الصفحة الرئيسية) */
export interface WorkspaceOverview {
  workspace: Workspace
  pieces: number
  /** رأس المال: تكلفة المخزون الحالي */
  cost_value: number
  selling_value: number
  receivables: number
  today_sales: number
  /** الربح الفعلي من أول يوم */
  profit: number
}

export interface WorkspaceInput {
  /** شراكة (الافتراضي) أو مخزن خارجي. وقت التعديل النوع مبيتغيرش. */
  kind?: 'partnership' | 'warehouse'
  /** اسم الشراكة (لو فاضي بيتكوّن من أسماء الشركاء). للمخزن الخارجي مطلوب. */
  name?: string
  /** أسماء الشريكين (القسمة 50/50). المخزن الخارجي ملوش شركاء. */
  partners?: string[]
}

// ---------- كلمة السر والحماية ----------
/** setup = أول تشغيل (لسه مفيش كلمة سر) | locked = مقفول | unlocked = مفتوح */
export type AuthState = 'setup' | 'locked' | 'unlocked'

export interface AuthStatus {
  state: AuthState
  /** لو في انتظار بعد محاولات غلط: كام ثانية قبل المحاولة الجاية */
  waitSeconds: number
  /** دقايق الخمول قبل القفل التلقائي */
  idleMinutes: number
}

// ---------- التحويل بين المخازن وحسابات الشركاء ----------
/** رأس مال من شريك | بيع بسعر محدد | نقل بالنص من غير حسابات */
export type TransferKind = 'capital' | 'sale' | 'half'

/**
 * التحويل من المخزون الفعلي للشراكة لمين:
 * owner = صاحب المخزون (رأس مال أو بيع بسعر) | partner = الشريك التاني اشترى القطع من صاحب المخزون
 * (رأس مال له + فاتورة عليه في المخزون الفعلي) | partnership = منتجات الشراكة بالنص (الشراكة عليها التكلفة لصاحب المخزون)
 */
export type TransferRecipient = 'owner' | 'partner' | 'partnership'

export interface TransferLineInput {
  item_id: number
  condition: Condition
  quantity: NumLike
  /** سعر القطعة (للبيع بس). الفاضي = التكلفة */
  unit_price?: NumLike | null
}

export interface TransferInput {
  from_workspace_id: number
  to_workspace_id: number
  kind: TransferKind
  /** صاحب رأس المال أو البيع (مش مطلوب في "بالنص") */
  partner_id?: number | null
  /** من المخزون الفعلي للشراكة بس: التحويل لمين (بيحدد النوع والشريك) */
  recipient?: TransferRecipient | null
  transfer_date?: string
  notes?: string
  items: TransferLineInput[]
}

export interface Transfer {
  id: number
  from_workspace_id: number
  to_workspace_id: number
  kind: TransferKind
  partner_id: number | null
  partner_name: string | null
  transfer_date: string
  total_cost: number
  total_price: number
  notes: string | null
  pieces: number
  /** المدفوع من سعر التحويل (للبيع بسعر بس، من الدفعات المربوطة بالتحويل) */
  paid: number
  /** تحويل تلقائي لفاتورة بيع فيها منتجات من المخزن ده (بيتعدّل ويتدفع مع الفاتورة بس) */
  sale_id: number | null
  /** التحويل لمين (null = تحويل قديم أو من الشراكة للمخزون الفعلي) */
  recipient: TransferRecipient | null
  /** التحويل للشريك: فاتورة البيع اللي عليه في المخزون الفعلي */
  partner_sale_id: number | null
}

/** فلتر جدول التحويلات (كله اختياري) */
export interface TransfersFilter {
  /** بحث في اسم الشريك والملاحظات وأسماء المنتجات */
  search?: string
  kind?: TransferKind | ''
  /** out = طالع من المخزن النشط، in = داخل عليه */
  direction?: 'out' | 'in' | ''
  /** من تاريخ / إلى تاريخ (YYYY-MM-DD) */
  from?: string
  to?: string
  /** الدفع (البيع بسعر بس): paid = اتدفع كله، unpaid = لسه عليه فلوس */
  payment?: 'paid' | 'unpaid' | ''
}

/**
 * ملخص التحويلات (بنفس فلتر الجدول): صف لكل اتجاه + شخص + نوع.
 * out = طالع من المخزن النشط، in = داخل عليه. partner_id = null في "بالنص" (من غير شريك).
 */
export interface TransferSummaryRow {
  direction: 'out' | 'in'
  partner_id: number | null
  partner_name: string | null
  kind: TransferKind
  transfers: number
  pieces: number
  total_cost: number
  total_price: number
}

/** دفعة على تحويل بيع بسعر */
export interface TransferPaymentInput {
  transfer_id: number
  amount: NumLike
  payment_date?: string
  notes?: string
}

/** مجموع فلوس تحويلات البيع في اتجاه واحد */
export interface TransferMoneyLine {
  total: number
  paid: number
  remaining: number
  /** عدد التحويلات اللي لسه عليها فلوس */
  unpaid_count: number
}

/**
 * فلوس تحويلات البيع بسعر من وجهة نظر المخزن النشط:
 * receivable = بيعنا لمخزن تاني (الفلوس لينا) | payable = اشترينا من مخزن تاني (الفلوس علينا)
 */
export interface TransferMoney {
  receivable: TransferMoneyLine
  payable: TransferMoneyLine
  /** نفس الأرقام لكل مخزن تاني اتعامل معانا */
  stores: { workspace_id: number; receivable: TransferMoneyLine; payable: TransferMoneyLine }[]
  /** أقدم التحويلات اللي لسه عليها فلوس */
  unpaid: Transfer[]
}

export interface TransferLine {
  id: number
  /** المنتج في مخزن المصدر (بيستخدمه فورم التعديل) */
  from_item_id: number
  item_name: string
  condition: Condition
  quantity: number
  unit_cost: number
  unit_price: number
}

export interface TransferDetails extends Transfer {
  items: TransferLine[]
  /** دفعات التحويل (البيع بسعر) */
  payments: PartnerPayment[]
}

export interface PartnerPayment {
  id: number
  partner_id: number
  partner_name: string
  /** موجب = الشراكة دفعت للشريك، سالب = الشريك دفع للشراكة */
  amount: number
  payment_date: string
  notes: string | null
  /** الدفعة على تحويل بيع (null = تسوية عادية) */
  transfer_id: number | null
  /** تسوية بين الشريكين: الدفعتين المربوطتين ليهم نفس الرقم */
  pair_id: number | null
  /** في التسوية بين الشريكين: اسم الشريك التاني (اللي دفع أو استلم) */
  counterparty_name: string | null
}

/** تسوية بين الشريكين: from دفع لـ to من جيبه */
export interface PartnerTransferInput {
  from_partner_id: number
  to_partner_id: number
  amount: NumLike
  payment_date?: string
  notes?: string
}

export interface PartnerPaymentInput {
  partner_id: number
  amount: NumLike
  direction: 'to_partner' | 'from_partner'
  payment_date?: string
  notes?: string
}

/** حساب شريك واحد داخل الشراكة */
export interface PartnerAccount {
  partner: WorkspacePartner
  /** رأس المال الداخل بالصافي (بتكلفته) */
  capital: number
  /** قيمة اللي باعه للشراكة من بضاعته بالصافي (مستحق له) */
  sold: number
  /** فواتير شراء للشراكة دفعها من جيبه (بعد مرتجعاتها) — مستحق له */
  paid_out: number
  profit_share: number
  /** اللي اتسوّى فعلًا (موجب = اتدفع له) */
  settled: number
  /** المستحق دلوقتي: موجب = الشراكة مدينة للشريك، سالب = الشريك مدين */
  balance: number
  /** حسابه كعميل في المخزون الفعلي (اللي أخده لنفسه). null لصاحب المخزون */
  store_account: { customer_id: number; sales_count: number; total: number; paid: number; remaining: number } | null
}

/** حركة واحدة في كشف حساب شريك. amount بإشارة تأثيرها على البند. */
export interface PartnerStatementLine {
  date: string
  /**
   * transfer = تحويل | purchase = فاتورة شراء دفعها | joint_purchase = فاتورة اشتروها مع بعض (نصيبه منها)
   * pair = تسوية بين الشريكين | payment = تسوية | transfer_payment = دفع تحويل
   */
  ref_type: 'transfer' | 'purchase' | 'joint_purchase' | 'pair' | 'payment' | 'transfer_payment'
  ref_id: number
  /** ملاحظات، أو اسم المورد (فاتورة شراء)، أو اسم الشريك التاني (تسوية بين الشريكين) */
  notes: string | null
  amount: number
}

export interface PartnerStatementLines {
  capital: PartnerStatementLine[]
  sold: PartnerStatementLine[]
  paid_out: PartnerStatementLine[]
  settled: PartnerStatementLine[]
}

/** كشف حساب شريك مفصّل: الرقم في الجدول جاي منين */
export interface PartnerStatement {
  account: PartnerAccount
  /** نصيبه من الربح: ربح الشراكة الفعلي − المصروفات = الصافي × نسبته */
  profit: { actual: number; expenses: number; net: number; share_percent: number }
  lines: PartnerStatementLines
}

/** مبيعات شريك واحد في الفترة (الفواتير اللي هو عملها) */
export interface PartnerSales {
  /** null = فواتير قديمة من غير شريك */
  partner_id: number | null
  partner_name: string | null
  invoices: number
  total: number
  returns_total: number
  /** الإجمالي - المرتجع */
  net: number
  /** المحصّل على الفواتير دي */
  paid: number
}

export interface PartnerLedger {
  profit: number
  accounts: PartnerAccount[]
  payments: PartnerPayment[]
}

// ---------- مخزن السعودية (كميات وشحنات بس) ----------
/** منتج في المخزن الخارجي. المبالغ للقطعة الواحدة بالريال. */
export interface WarehouseItem {
  id: number
  name: string
  quantity: number
  /** السعر اللي اتدفع في القطعة */
  unit_price: number
  shipping: number
  customs: number
  notes: string | null
}

export interface WarehouseItemInput {
  name: string
  quantity: NumLike
  unit_price?: NumLike
  shipping?: NumLike
  customs?: NumLike
  notes?: string
}

export type ShipmentStatus = 'in_transit' | 'arrived'

export interface WarehouseShipmentLine {
  item_id: number
  name: string
  quantity: number
}

export interface WarehouseShipment {
  id: number
  ship_date: string
  /** المخزن اللي الشحنة رايحاله في مصر (الفعلي أو شراكة) */
  workspace_id: number
  status: ShipmentStatus
  arrived_date: string | null
  notes: string | null
  pieces: number
  items: WarehouseShipmentLine[]
}

export interface WarehouseShipmentInput {
  ship_date?: string
  workspace_id: number
  notes?: string
  items: { item_id: number | ''; quantity: NumLike }[]
}

// ---------- الأصناف والمنتجات ----------
export interface Category {
  id: number
  name: string
  items_count: number
}

export interface Item {
  id: number
  name_ar: string
  name_en: string | null
  category_id: number
  category_name: string
  new_quantity: number
  new_purchase_price: number
  new_selling_price: number
  new_wholesale_price: number
  damaged_quantity: number
  damaged_purchase_price: number
  damaged_selling_price: number
  damaged_wholesale_price: number
  /** لو المنتج اتأرشف (اتحذف وله حركات) بيبقى فيه تاريخ */
  deleted_at: string | null
}

/** نتيجة حذف منتج: اتحذف نهائيًا، أو اتأرشف لأنه مرتبط بفواتير */
export type RemoveItemResult = { mode: 'deleted' | 'archived' }

export interface StockInput {
  quantity: NumLike
  purchase_price: NumLike
  selling_price: NumLike
  wholesale_price: NumLike
}

export interface ItemInput {
  id?: number
  category_id?: number | null
  name_ar: string
  name_en?: string | null
  stock?: Record<Condition, StockInput>
}

export interface Movement {
  type: MovementType
  ref_id: number
  date: string
  party: string | null
  condition: Condition
  quantity: number
  unit_price: number
  unit_cost: number
  /** 1 = داخل للمخزن، -1 = خارج منه */
  direction: 1 | -1
  total: number
}

export interface ItemDetails {
  item: Item
  totals: {
    purchased_qty: number
    sold_qty: number
    sale_returns_qty: number
    purchase_returns_qty: number
    purchases_cost: number
    sales_total: number
    profit: number
  }
  /** الفرق بين الكمية الحالية وصافي الحركات (كميات افتتاحية / تعديل يدوي) */
  adjustments: Record<Condition, number>
  movements: Movement[]
}

// ---------- العملاء ----------
export interface Customer {
  id: number
  name: string
  phone: string | null
  /** 1 = العميل ده شريك في شراكة (عميله في المخزون الفعلي) */
  is_partner: number
}

export interface CustomerInput {
  name: string
  phone?: string
}

/** عميل مع إجماليات فواتيره: المتبقي = اللي لسه عليه بعد الدفعات والمرتجعات */
export interface CustomerSummary extends Customer {
  sales_count: number
  total: number
  paid: number
  remaining: number
  /** رصيد العميل عندك (دفع زيادة بعد مرتجعات) */
  credit: number
}

// ---------- الفواتير ----------
export interface InvoiceLine {
  id: number
  item_id: number
  name_ar: string
  name_en: string | null
  condition: Condition
  quantity: number
}

export interface Purchase {
  id: number
  supplier_name: string
  /** الشريك اللي اشترى البضاعة (في الشراكة بس) */
  partner_id: number | null
  partner_name: string | null
  /** 1 = الشريكين اشتروها مع بعض (partner_id = null) */
  joint: number
  /** 1 = الشريك (أو الشريكين لو joint) دفعها من جيبه (الشراكة عليها المبلغ ليه) */
  paid_by_partner: number
  purchase_date: string
  shipping_cost: number
  total: number
  notes: string | null
  /** اللي اتدفع للمورد (اللي الشريك دفعها من جيبه = الإجمالي) */
  paid: number
  /** إجمالي مرتجعات الشراء على الفاتورة */
  returns_total: number
  /** اللي لسه للمورد = الإجمالي − المرتجع − المدفوع (مش أقل من صفر) */
  remaining: number
}

export interface PurchasePayment {
  id: number
  purchase_id: number
  amount: number
  payment_date: string
  notes: string | null
}

export interface PurchasePaymentInput {
  purchase_id: number
  amount: NumLike
  payment_date?: string
  notes?: string
}

export interface PurchaseLine extends InvoiceLine {
  category_id: number
  purchase_price: number
  landed_cost: number
  selling_price: number
  wholesale_price: number
}

export interface PurchaseWithLines extends Purchase {
  items: PurchaseLine[]
  payments: PurchasePayment[]
}

export interface Sale {
  id: number
  customer_id: number | null
  customer_name: string | null
  /** 1 = العميل شريك (بيتكتب جنب اسمه "(الشريك)") */
  customer_is_partner: number
  /** الشريك اللي عمل الفاتورة (في الشراكات بس) */
  partner_id: number | null
  partner_name: string | null
  sale_date: string
  price_type: PriceType
  shipping_payer: ShippingPayer
  shipping_cost: number
  total: number
  notes: string | null
  /** اللي اتحصّل على الفاتورة (من أول دفعة وقت البيع ولحد آخر تحصيل) */
  paid: number
  /** إجمالي مرتجعات الفاتورة */
  returns_total: number
  /** اللي لسه على العميل = الإجمالي - المرتجعات - المدفوع (مش أقل من صفر) */
  remaining: number
  /** رصيد العميل في الفاتورة: دفع زيادة عن صافيها بعد المرتجع (ولسه ما اتردّش ولا اتخصمش) */
  credit: number
  /** اترد للعميل كاش (مع مرتجعات) */
  refunded: number
  /** رصيده من الفاتورة دي اتخصم في فواتير تانية */
  credit_used: number
}

export interface SaleLine extends InvoiceLine {
  category_id: number
  purchase_price: number
  selling_price: number
  /** السطر جاي من مخزن تاني (اتحوّل تلقائي): المخزن والمنتج فيه وسعر التحويل. null = من مخزن الفاتورة */
  source_workspace_id: number | null
  source_item_id: number | null
  transfer_price: number | null
}

export interface SalePayment {
  id: number
  sale_id: number
  amount: number
  payment_date: string
  notes: string | null
  /** 1 = الدفعة من رصيد العميل (مش فلوس جديدة اتحصّلت) */
  from_credit: number
}

/** فلوس طلعت من فاتورة للعميل: cash = اترد له كاش مع مرتجع، credit = رصيده اتخصم في فاتورة تانية */
export interface SaleRefund {
  id: number
  sale_id: number
  amount: number
  refund_date: string
  kind: 'cash' | 'credit'
  return_id: number | null
  /** الرصيد اتخصم في الفاتورة دي */
  used_in_sale_id: number | null
}

export interface SaleWithLines extends Sale {
  items: SaleLine[]
  payments: SalePayment[]
}

/** كشف حساب عميل: فواتيره ودفعاته */
export interface CustomerStatement {
  customer: Customer
  /** paid = اللي دفعه فعلًا (قبل الردود)، refunded = اترد له كاش */
  totals: { total: number; paid: number; returns: number; remaining: number; credit: number; refunded: number }
  sales: Sale[]
  payments: SalePayment[]
  /** اللي اترد له أو اتخصم من رصيده */
  refunds: SaleRefund[]
}

export interface ReturnRecord {
  id: number
  type: ReturnKind
  sale_id: number | null
  purchase_id: number | null
  return_date: string
  reason: string | null
  total: number
  customer_name: string | null
  /** 1 = العميل شريك (بيتكتب جنب اسمه "(الشريك)") */
  customer_is_partner: number
  supplier_name: string | null
  /** مرتجع البيع: اللي اترد للعميل كاش معاه */
  refunded: number
  /** حالة فاتورة البيع دلوقتي: الباقي على العميل ورصيده فيها (null في مرتجع الشراء) */
  sale_remaining: number | null
  sale_credit: number | null
}

export interface ReturnLine extends InvoiceLine {
  unit_price: number
  /** رجع للمخزن الأصلي (مش مخزن الفاتورة) */
  to_source: number
}

export interface ReturnWithLines extends ReturnRecord {
  items: ReturnLine[]
}

// ---------- مدخلات الفواتير ----------
export interface PurchaseLineInput {
  item_id?: number | ''
  /** منتج جديد: اسمه وصنفه (بيتعمل مع الفاتورة) */
  name_ar?: string
  name_en?: string
  category_id?: number | ''
  condition: Condition
  quantity: NumLike
  purchase_price: NumLike
  selling_price?: NumLike
  wholesale_price?: NumLike
}

export interface PurchaseInput {
  supplier_name: string
  /** الشريك اللي اشترى: لازم في الشراكة، وبيتجاهل في المخزون الفعلي */
  partner_id?: number | null
  /** الشريكين اشتروها مع بعض (في الشراكة: بدل partner_id) */
  joint?: boolean
  /** الشريك (أو الشريكين لو joint) دفعها من جيبه (مش من فلوس الشراكة) */
  paid_by_partner?: boolean
  /** المدفوع للمورد وقت الشراء (الافتراضي الفاتورة كلها). وقت الإنشاء بس، والباقي بيتدفع بعد كده من دفعات الفاتورة. */
  paid?: NumLike
  purchase_date?: string
  shipping_cost?: NumLike
  notes?: string
  items: PurchaseLineInput[]
}

export interface SaleLineInput {
  /** المنتج في مخزن الفاتورة، أو في source_workspace_id لو السطر جاي من مخزن تاني */
  item_id: number
  condition: Condition
  quantity: NumLike
  selling_price?: NumLike
  /** مخزن تاني (المخزون الفعلي ↔ شراكة): القطع بتتحوّل تلقائي (بيع بسعر) قبل البيع */
  source_workspace_id?: number | null
  /** سعر التحويل للمخزن التاني (الافتراضي: سعر البيع في السطر) */
  transfer_price?: NumLike
}

export interface SaleInput {
  /** لازم لو الفاتورة مش مدفوعة كلها */
  customer_id?: number | null
  /** الشريك اللي عمل الفاتورة: لازم في الشراكة، وبيتجاهل في المخزون الفعلي */
  partner_id?: number | null
  sale_date?: string
  price_type?: PriceType
  shipping_payer?: ShippingPayer
  shipping_cost?: NumLike
  /** المدفوع وقت البيع (الافتراضي: الفاتورة كلها بعد الرصيد). بيتحدد وقت الإنشاء بس، والتحصيل بعد كده من العملاء. */
  paid?: NumLike
  /** يتخصم من رصيد العميل الأول (لو ليه رصيد) */
  use_credit?: boolean
  notes?: string
  items: SaleLineInput[]
}

export interface ReturnLineInput {
  item_id: number
  condition: Condition
  quantity: NumLike
  unit_price: NumLike
  /** القطع جاية من مخزن تاني في الفاتورة: ترجع له بدل مخزن الفاتورة (والمستحق عليه بيقل) */
  to_source?: boolean
}

export interface ReturnInput {
  type: ReturnKind
  sale_id?: number | null
  purchase_id?: number | null
  return_date?: string
  reason?: string
  /** مرتجع بيع: اللي اترد للعميل كاش (الباقي من فلوسه بيفضل رصيد له). الافتراضي: مفيش */
  refund?: NumLike
  items: ReturnLineInput[]
}

/** تحصيل مبلغ: على فاتورة معينة، أو على العميل (بيتوزع على أقدم فواتيره الأول) */
export interface CollectInput {
  /** خصم من رصيد العميل بدل فلوس جديدة (التحصيل على العميل بس) */
  from_credit?: boolean
  sale_id?: number
  customer_id?: number
  amount: NumLike
  payment_date?: string
  notes?: string
}

// ---------- الرئيسية ----------
export interface DashboardRange {
  from: string | null
  to: string | null
}

export interface ChartPoint {
  period: string
  sales: number
  purchases: number
  /** بيع لمخازن تانية بسعر (تحويلات) */
  transfer_sales: number
  profit: number
}

export interface TopProduct {
  id: number
  name_ar: string
  name_en: string | null
  quantity: number
  revenue: number
}

export interface DashboardSummary {
  stock: {
    pieces: number
    new_pieces: number
    damaged_pieces: number
    /** رأس المال: قيمة المخزون الفعلية بسعر التكلفة */
    cost_value: number
    new_cost_value: number
    damaged_cost_value: number
    selling_value: number
    expected_profit: number
  }
  purchases: { count: number; total: number; shipping: number; returns: number; net: number }
  sales: {
    count: number
    products: number
    /** شحن دفعه العملاء (جزء من إجمالي الفواتير) */
    shipping: number
    /** شحن دفعه المحل (مصروف بيتخصم من الربح) */
    shop_shipping: number
    total: number
    returns_count: number
    returns: number
    net_products: number
  }
  /** القطع اللي اتباعت لمخازن تانية بسعر في الفترة (تحويلات، مش فواتير بيع)، واللي اتدفع منها */
  transfer_sales: { count: number; pieces: number; total: number; paid: number; remaining: number }
  today: { count: number; total: number }
  /** مستحقات عند العملاء (الحالي، مش بيتأثر بالفلتر) */
  receivables: number
  /** اللي اتحصّل في الفترة */
  collected: number
  /** الربح الفعلي (قبل المصروفات) */
  profit: number
  /** مصروفات الفترة: الكل، واللي بيتخصم من الربح */
  expenses: { count: number; total: number; deducted: number }
  /** صافي الربح = الربح الفعلي − المصروفات اللي بتتخصم */
  net_profit: number
  profit_previous: { from: string; to: string; profit: number } | null
  counts: { items: number; categories: number; customers: number }
  charts: {
    mode: 'day' | 'month'
    series: ChartPoint[]
    top: TopProduct[]
    stock: { new: number; damaged: number }
  }
}

// ---------- الإعدادات والنسخ الاحتياطي ----------
/** owner_name = صاحب المخزون الفعلي (شريك في كل شراكة بيعملها). بيتغيّر من صفحة الشراكات بس. */
export type SettingKey = 'language' | 'shop_name' | 'shop_phone' | 'shop_address' | 'owner_name'
export type SettingsMap = Partial<Record<SettingKey, string>>

/** حالة النسخ الاحتياطي التلقائي (إعدادات الجهاز ده) */
export interface AutoBackupStatus {
  enabled: boolean
  /** الفولدر الفعلي اللي النسخ بتتحفظ فيه */
  dir: string
  /** الفولدر الافتراضي جوه بيانات التطبيق (مش فولدر اختاره المستخدم) */
  isDefaultDir: boolean
  keep: number
  /** وقت آخر نسخة تلقائية (ISO) أو null لو لسه مفيش */
  lastAt: string | null
  /** عدد النسخ التلقائية الموجودة في الفولدر */
  count: number
}

export interface DataTransfer {
  id: number
  type: 'export' | 'import'
  file_path: string
  status: string
  created_at: string
}

// ---------- التصدير والطباعة ----------
export type ExportDataset = 'categories' | 'items' | 'purchases' | 'sales' | 'returns' | 'customers' | 'movements'
export type ExportFormat = 'xlsx' | 'csv'
export type CellType = 'text' | 'number' | 'money' | 'date' | 'enum'
export type CellValue = string | number | null

export interface ExportColumn {
  key: string
  type: CellType
  width: number
}

export interface ExportSheet {
  key: string
  /** table = جدول عادي، record = صف واحد بيتعرض كـ (البند | القيمة) */
  layout?: 'table' | 'record'
  columns: ExportColumn[]
  rows: Record<string, CellValue>[]
}

// ---------- المصروفات ----------
export interface Expense {
  id: number
  expense_date: string
  /** النوع (إيجار، راتب...) زي ما المستخدم كتبه */
  category: string
  amount: number
  /** 1 = بيتخصم من الربح، 0 = تسجيل بس */
  deduct: number
  notes: string | null
}

export interface ExpenseInput {
  expense_date?: string
  category: string
  amount: NumLike
  /** الافتراضي true */
  deduct?: boolean
  notes?: string
}

/** إجماليات المصروفات بنفس الفلتر (كل الصفحات مش الصفحة الحالية بس) */
export interface ExpensesTotals {
  count: number
  total: number
  deducted: number
}

/** فلتر الفترة في الجداول (من / إلى اختياري، YYYY-MM-DD) */
export interface DateFilter {
  from?: string
  to?: string
}

export interface ExportParams extends DateFilter {
  search?: string
  itemId?: number
  /** فواتير شريك واحد بس (مبيعات الشراكة) */
  partnerId?: number
}

/** الترجمات اللي الواجهة بتبعتها للـ backend علشان عناوين الأعمدة وقيم الحالات تتكتب بلغة التطبيق */
export interface ExportLabels {
  sheets: Record<string, string>
  columns: Record<string, string>
  values: Record<string, string>
}

export interface ExportRequest extends ExportParams {
  dataset: ExportDataset
  format: ExportFormat
  labels: ExportLabels
  /** اتجاه الصفحة في ملف الإكسيل (عربي = من اليمين لليسار) */
  rtl?: boolean
}

export interface ExportResult {
  done: boolean
  filePath?: string
}

// ---------- الفواتير الحرّة (المخزون الفعلي بس) ----------
/** سطر في فاتورة حرّة: item_id = منتج من المخزون (مبيتخصمش)، فاضي = بند من برّه بالاسم */
export interface FreeInvoiceLineInput {
  item_id?: number | null
  /** حالة منتج المخزون (البنود اللي من برّه ملهاش حالة) */
  condition?: Condition | null
  name?: string
  quantity: NumLike
  unit_price: NumLike
}

export interface FreeInvoiceInput {
  /** عميل متسجل، أو اسم وتليفون بيتكتبوا */
  customer_id?: number | null
  customer_name?: string
  customer_phone?: string
  invoice_date?: string
  price_type?: PriceType
  shipping_cost?: NumLike
  discount?: NumLike
  /** المدفوع وقت الإنشاء (الافتراضي الفاتورة كلها). الباقي بيتدفع بعد كده من دفعات الفاتورة */
  paid?: NumLike
  notes?: string
  items: FreeInvoiceLineInput[]
}

export interface FreeInvoiceLine {
  id: number
  item_id: number | null
  condition: Condition | null
  name: string
  /** الاسم الإنجليزي لمنتج المخزون (للطباعة) */
  name_en: string | null
  quantity: number
  unit_price: number
}

export interface FreeInvoicePayment {
  id: number
  amount: number
  payment_date: string
  notes: string | null
}

export interface FreeInvoice {
  id: number
  invoice_date: string
  customer_id: number | null
  /** اسم العميل المتسجل أو المكتوب */
  customer_name: string | null
  customer_phone: string | null
  price_type: PriceType
  shipping_cost: number
  discount: number
  total: number
  notes: string | null
  /** فاتورة البيع اللي اتعملت من بنود المخزون */
  sale_id: number | null
  paid: number
  remaining: number
  lines_count: number
  /** عدد سطور منتجات المخزون (لو صفر مفيش فاتورة بيع تتعمل منها) */
  stock_lines: number
}

export interface FreeInvoiceWithLines extends FreeInvoice {
  items: FreeInvoiceLine[]
  payments: FreeInvoicePayment[]
}

export interface FreeInvoicePaymentInput {
  invoice_id: number
  amount: NumLike
  payment_date?: string
  notes?: string
}

/** فاتورة بيع حقيقية من بنود المخزون اللي في الفاتورة الحرّة (القطع بتتخصم والربح بيتحسب) */
export interface FreeInvoiceToSaleInput {
  id: number
  /** المدفوع من فاتورة البيع (الافتراضي كلها) */
  paid?: NumLike
  notes?: string
}
