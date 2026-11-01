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
export type WorkspaceKind = 'personal' | 'partnership'

export interface WorkspacePartner {
  id: number
  name: string
  share_percent: number
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
  /** اسم الشراكة (لو فاضي بيتكوّن من أسماء الشركاء) */
  name?: string
  /** أسماء الشريكين (القسمة 50/50) */
  partners: string[]
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
}

export interface TransferLine {
  id: number
  item_name: string
  condition: Condition
  quantity: number
  unit_cost: number
  unit_price: number
}

export interface TransferDetails extends Transfer {
  items: TransferLine[]
}

export interface PartnerPayment {
  id: number
  partner_id: number
  partner_name: string
  /** موجب = الشراكة دفعت للشريك، سالب = الشريك دفع للشراكة */
  amount: number
  payment_date: string
  notes: string | null
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
  /** قيمة اللي باعه للشراكة بالصافي (مستحق له) */
  sold: number
  profit_share: number
  /** اللي اتسوّى فعلًا (موجب = اتدفع له) */
  settled: number
  /** المستحق دلوقتي: موجب = الشراكة مدينة للشريك، سالب = الشريك مدين */
  balance: number
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
  purchase_date: string
  shipping_cost: number
  total: number
  notes: string | null
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
}

export interface Sale {
  id: number
  customer_id: number | null
  customer_name: string | null
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
}

export interface SaleLine extends InvoiceLine {
  category_id: number
  purchase_price: number
  selling_price: number
}

export interface SalePayment {
  id: number
  sale_id: number
  amount: number
  payment_date: string
  notes: string | null
}

export interface SaleWithLines extends Sale {
  items: SaleLine[]
  payments: SalePayment[]
}

/** كشف حساب عميل: فواتيره ودفعاته */
export interface CustomerStatement {
  customer: Customer
  totals: { total: number; paid: number; returns: number; remaining: number }
  sales: Sale[]
  payments: SalePayment[]
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
  supplier_name: string | null
}

export interface ReturnLine extends InvoiceLine {
  unit_price: number
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
  purchase_date?: string
  shipping_cost?: NumLike
  notes?: string
  items: PurchaseLineInput[]
}

export interface SaleLineInput {
  item_id: number
  condition: Condition
  quantity: NumLike
  selling_price?: NumLike
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
  /** المدفوع وقت البيع (الافتراضي: الفاتورة كلها). بيتحدد وقت الإنشاء بس، والتحصيل بعد كده من العملاء. */
  paid?: NumLike
  notes?: string
  items: SaleLineInput[]
}

export interface ReturnLineInput {
  item_id: number
  condition: Condition
  quantity: NumLike
  unit_price: NumLike
}

export interface ReturnInput {
  type: ReturnKind
  sale_id?: number | null
  purchase_id?: number | null
  return_date?: string
  reason?: string
  items: ReturnLineInput[]
}

/** تحصيل مبلغ: على فاتورة معينة، أو على العميل (بيتوزع على أقدم فواتيره الأول) */
export interface CollectInput {
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
  today: { count: number; total: number }
  /** مستحقات عند العملاء (الحالي، مش بيتأثر بالفلتر) */
  receivables: number
  /** اللي اتحصّل في الفترة */
  collected: number
  profit: number
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
export type SettingKey = 'language' | 'shop_name' | 'shop_phone' | 'shop_address'
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

export interface ExportParams {
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
