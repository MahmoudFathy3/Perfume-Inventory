# Perfume Inventory (مخزن العطور)

تطبيق مخزن عطور أوفلاين لويندوز: **Electron + React + TypeScript + Tailwind CSS + SQLite**.

## تشغيل
```
npm install        # بيثبّت الحزم وبيبني SQLite المشفّر (better-sqlite3-multiple-ciphers) لـ Electron
npm run dev        # وضع التطوير
npm run typecheck  # فحص TypeScript للـ backend والواجهة
npm test           # اختبارات الـ backend (بتستخدم نسخة SQLite منفصلة، فمبتأثرش على التطبيق)
npm run dist       # بيبني ملف تنصيب Windows: dist/Perfume-Inventory-Setup-1.0.0.exe
npm run dist:dir   # نسخة غير منصّبة للتجربة السريعة: dist/win-unpacked
npm run dist:zip   # نسخة مضغوطة من غير تنصيب: dist/Perfume-Inventory-1.0.0-win.zip
npm run icons      # يعيد توليد الأيقونات من resources/icon.svg
```

## المخازن والشراكات
- **المخزون الفعلي**: مساحة شخصية موجودة دايمًا (`workspaces.id = 1`) ومينفعش تتعدّل أو تتقفل أو تتحذف.
- **الشراكات**: كل شراكة مخزن منفصل بين شريكين (القسمة 50/50) بأصنافه ومنتجاته وعملائه وفواتيره. تقدر تعمل أكتر من شراكة، حتى مع نفس الشخص (باسم يميّز كل واحدة).
- التبديل من أعلى القايمة الجانبية. المساحة النشطة بتتحفظ في الإعدادات (`active_workspace_id`).
- **التقنية**: `workspace_id` على الجداول الرئيسية (categories, items, customers, purchases, sales, returns) والباقي بيتبع أبوه. كل استعلام بيتفلتر بـ `inWorkspace()` / `scoped()` من `electron/lib/workspace.ts`. أي repository جديد لازم يفلتر بيهم.
- الشراكة اللي فيها بيانات بتتقفل ومبتتحذفش.

### التحويل وحسابات الشركاء
- **التحويل** بين المخزون الفعلي وأي شراكة (في الاتجاهين) من صفحة "التحويلات". النوع بيتحدد وقت التحويل:
  - **رأس مال**: القطع بتتنقل بتكلفتها (متوسط تكلفة المصدر) وبتتحسب رأس مال للشريك المختار (بيتخصم لو راجعة للمخزون الفعلي).
  - **بيع بسعر**: سعر القطعة بيتحدد (الافتراضي التكلفة)؛ بيبقى تكلفة القطع في الوجهة، والمبلغ مستحق للشريك البائع (أو عليه لو بيشتري من الشراكة).
  - **بالنص**: نقل من غير أي حسابات.
- في الوجهة المنتج بيتطابق بالاسم (من غير تفرقة همزة/تاء مربوطة)؛ لو مش موجود بيتعمل هو وصنفه بأسعار البيع من المصدر. التكلفة بتدخل في المتوسط المرجّح.
- حذف التحويل = عكسه بنفس التكلفة، ويترفض (`OUT_OF_STOCK`) لو الوجهة باعت القطع. مفيش تعديل.
- **حسابات الشركاء** (داخل الشراكة بس): المستحق للشريك = نصيبه من ربح الشراكة (50%) + اللي باعه للشراكة - التسويات. رأس المال بيتعرض لوحده. التسوية (`partner_payments`) موجبة لو الشراكة دفعت للشريك وسالبة لو هو دفع.
- أرقام الشريكين ثابتة لما تتعدّل الأسماء (التحويلات والتسويات مربوطة بيها).
- الجداول: `transfers`, `transfer_items`, `partner_payments`. الـ features: `electron/features/transfers`, `electron/features/partners`.

## الأمان (كلمة السر والتشفير)
- **كلمة سر واحدة** بتتطلب عند كل تشغيل (أول مرة بتتعمل في شاشة الإعداد، 8 حروف على الأقل). التطبيق نفسه مبيتحمّلش ولا بيتعرض قبلها، والـ backend بيرفض أي أمر IPC (`LOCKED`) ما عدا `auth:*` وهو مقفول.
- **تشفير الداتا بيز بالكامل**: SQLCipher / AES-256 عن طريق `better-sqlite3-multiple-ciphers`. الملف مش مقروء من برا التطبيق، ونسخ الباك أب ونسخ الأمان بتفضل مشفّرة.
- **الخزنة (`vault.json` في فولدر بيانات التطبيق)**: الداتا بيز مشفّرة بمفتاح عشوائي 256 بت، والمفتاح ده متخزن مغلّف (AES-256-GCM، اشتقاق scrypt) مرتين: بكلمة السر وبمفتاح الاسترجاع. تغيير كلمة السر = إعادة تغليف المفتاح بس. فقد `vault.json` = فقد القدرة على فتح الداتا بيز.
- **مفتاح الاسترجاع**: بيظهر مرة واحدة بعد الإعداد (والتطبيق مبيكملش غير بعد التأكيد). لو نسيت كلمة السر: "نسيت كلمة السر؟" ← المفتاح + كلمة جديدة، وبيطلع مفتاح جديد والقديم بيبطل. تقدر تعمل مفتاح جديد من الإعدادات.
- **القفل**: يدوي (الشريط الجانبي)، تلقائي بعد خمول (1–120 دقيقة، الافتراضي 10، بيتحسب في الـ main)، وعند قفل شاشة ويندوز أو نوم الجهاز. القفل بيقفل الداتا بيز وبيمسح المفتاح من الذاكرة.
- **ضد التخمين**: بعد 5 محاولات غلط بيبدأ انتظار بيتضاعف (1، 2، 4... لحد 60 ثانية) ومشترك بين كلمة السر ومفتاح الاسترجاع (بيتصفّر لو التطبيق اتقفل وفتح من جديد).
- **داتا بيز قديمة غير مشفّرة**: بتتشفّر في مكانها تلقائي عند أول إعداد. استيراد نسخة عادية قديمة بيشفّرها كمان. نسخة مشفّرة بمفتاح تثبيت تاني بتترفض (`BACKUP_KEY_MISMATCH`).
- **تشديد Electron**: `contextIsolation` + `sandbox` + من غير Node في الواجهة، منع فتح نوافذ والتنقل لأي رابط برا التطبيق، رفض كل صلاحيات المتصفح، أدوات المطور مقفولة في النسخة المنصّبة، وCSP صارم.
- الكود: `electron/security/` (vault, vaultStore, session) و`electron/features/auth/` و`electron/windows/security.ts`، والواجهة `src/features/auth/`.
- **الاسترجاع على جهاز جديد**: تصدير النسخة بيعمل ملف جنبها `.sqlite.vault.json` (نسخة الخزنة). من شاشة الإعداد "استرجاع من نسخة احتياطية" ← كلمة السر ← اختيار الملف. (مفتاح الاسترجاع كمان يفتح الخزنة دي لو نسيت الكلمة، بس بعد الاسترجاع.) انسخ الملفين مع بعض.
- **حدود معروفة**: ولو مفتاح الاسترجاع اتنسخ على الـ clipboard بيفضل هناك لحد ما يتبدّل.

## النسخ الاحتياطي التلقائي
- نسخة كاملة (مشفّرة + الخزنة جنبها) **مرة كل يوم**: بعد فتح التطبيق بكلمة السر، وكل ساعة طول ما هو مفتوح لو عدّى يوم من آخر نسخة.
- الفولدر الافتراضي `%APPDATA%/Perfume Inventory/auto-backups`. الأفضل تختار فولدر على فلاشة أو هارد خارجي أو Google Drive / OneDrive من الإعدادات ← النسخ الاحتياطي.
- بيحتفظ بآخر 30 نسخة (7 / 14 / 30 / 60 / 90) والأقدم بيتمسح. بيمسح بس ملفات `auto-backup-*.sqlite` اللي هو عملها.
- الإعدادات في `config.json` (خاصة بالجهاز، مش جوه الداتا بيز). النجاح والفشل بيظهروا في "آخر العمليات".
- الكود: `electron/features/backup/autoBackup.service.ts`.

## الإعدادات (.env)
انسخ `.env.example` إلى `.env` وعدّل القيم. المتغيرات اللي بتبدأ بـ `MAIN_VITE_` للـ backend، وبـ `RENDERER_VITE_` للواجهة، والباقي مش بيوصل للتطبيق. أي تغيير محتاج إعادة تشغيل `npm run dev` أو إعادة البناء.
| المتغير | الاستخدام |
|---|---|
| `MAIN_VITE_DB_FILE_NAME` | اسم ملف الداتا بيز |
| `MAIN_VITE_APP_NAME` / `MAIN_VITE_APP_NAME_AR` | اسم التطبيق |
| `MAIN_VITE_SPLASH_DURATION_MS` | مدة شاشة البداية |
| `RENDERER_VITE_CURRENCY` | عملة العرض (EGP) |
| `RENDERER_VITE_DEFAULT_LANGUAGE` | لغة أول تشغيل (ar / en) |

## البناء والتنصيب
- **الإعدادات** كلها في `electron-builder.yml` (الاسم، الأيقونة، شكل شاشة التنصيب، الاختصارات).
- **الأيقونة**: عدّل `resources/icon.svg` وشغّل `npm run icons` (بيحدّث `build/icon.ico` وأيقونة النافذة وشعار القايمة).
- **الداتا**: بتتحفظ في `%APPDATA%/Perfume Inventory` ومبتتمسحش لما تحذف البرنامج. اسم ملف الداتا بيز من `.env`.
- **شاشة البداية (Splash)**: مدتها `MAIN_VITE_SPLASH_DURATION_MS` في `.env` (3000 = 3 ثواني).
- **تنبيهات**: لازم `package-lock.json` يفضل موجود (بيثبّت نسخ الحزم، وبدونه ممكن حزم تنقص من التنصيب). الحزم اللي بتدخل في الواجهة (react وغيره) مكانها `devDependencies` لأن vite بيدمجها، فمبتزودش حجم التنصيب.
- لو الـ build على ويندوز وقف بخطأ `symbolic link` أو `privilege`: شغّل الـ terminal كـ Administrator أو فعّل Developer Mode في ويندوز.

## الهيكل
```
shared/types.ts            أنواع مشتركة بين الـ backend والواجهة (أنواع بس)
electron/                  الـ backend (Main Process)
├── main.ts, preload.ts
├── windows/               الـ Splash والنافذة الرئيسية وترتيب التشغيل (launch.ts)
├── app/                   تجهيز الـ backend
├── config/                قراءة .env ومسار الداتا بيز (config.json)
├── database/              الاتصال + migration واحدة نظيفة (001_init)
├── lib/                   أدوات صغيرة مشتركة (كل ملف لحاجة واحدة):
│                          errors, ipc, search, pagination, workspace, cost, normalizeArabic
├── features/<feature>/    كل feature فولدر، وكل ملف فيه ليه دور واحد:
│   ├── x.repository.ts    SQL بس (استعلامات + findAll للقوايم الكاملة + findPage للـ pagination)
│   ├── x.validation.ts    فحص وتنضيف المدخلات (لو كتير)
│   ├── x.stock.ts         تأثير العملية على المخزن (لو في)
│   ├── x.service.ts       العمليات والقواعد (create / update / remove)
│   └── x.ipc.ts           استقبال الطلبات من الواجهة (x:list كل الصفوف، x:page صفحة واحدة)
│   features: categories, items, purchases, sales, customers, payments, returns,
│             workspaces, transfers, partners, dashboard, settings, backup, export, printing, clipboard
│   ├── items/             items.repository (المنتجات) + stock.repository (المخزون) + movements.repository (الحركات)
│   ├── dashboard/         queries/ (stock, period, charts) + dashboard.periods + service
│   └── export/            datasets/ (ملف sheets لكل جدول + index) + builders (xlsx/csv/pdf)
└── tests/                 اختبارات الـ backend: ملف لكل موضوع + helpers.ts (داتا بيز مؤقتة ومساعدات)

src/                       الواجهة (Renderer)
├── i18n/                  ar.json / en.json + languages.ts
├── shared/
│   ├── components/ui/     عناصر أساسية (Button, Input, Modal, DataTable, Badge...) بـ Tailwind + clsx
│   ├── components/data/   Pagination, SearchBar, ExportMenu, ProductSelect, OptionSelect, CustomerSelect, ConfirmDialog
│   ├── components/invoice/ فورم الشراء والبيع، وعرض وطباعة الفاتورة (وطباعة اسم العميل)
│   ├── toast/             رسائل Toast (useToast)
│   ├── export/, print/    التصدير والطباعة
│   ├── hooks/, utils/, api/, layout/   (usePagedQuery = قايمة بـ pagination من الـ backend)
└── features/<feature>/    api + hooks + components + pages
```

## الـ Pagination
القوايم الكبيرة (المنتجات، الأصناف، العملاء، المشتريات، المبيعات، المرتجعات) بتتقسم في الـ backend: `x:page` بياخد `{ page, pageSize, search }` وبيرجّع `{ rows, total, page, pageSize, pageCount }` (COUNT + LIMIT/OFFSET في SQL من `lib/pagination.ts`). الواجهة بتستخدم `usePagedQuery`. `x:list` بيرجّع كل الصفوف وبنستخدمه للقوايم المنسدلة والتصدير ونسخ القايمة بس.

## التصدير
كل جدول بيتصدّر **بكل بياناته وتفاصيله**: الجدول الأساسي + جدول التفاصيل (مثلًا فواتير + أصناف الفواتير). صفحة تفاصيل المنتج بتصدّر بيانات المنتج وملخصه وكل حركاته. الصيغ: Excel (شيتات منفصلة)، وCSV (كل الجداول في ملف واحد)، وPDF.
لإضافة عمود أو جدول للتصدير: عدّل `electron/features/export/export.datasets.ts` وضيف الترجمة في `export.columns` / `export.sheets` في ملفات الترجمة.

## قواعد الكود
- **Tailwind + clsx**: الكلاسات الطويلة بتتقسم في الـ primitives (`ui/Button.tsx` مثال) بدل ما تتكرر في الصفحات. اللون الأساسي بيتغير من `tailwind.config.ts`.
- **الترجمة**: كل النصوص في `src/i18n/locales`. لغة جديدة = ملف json + سطر في `i18n/index.ts` و`languages.ts`.
- **الداتا بيز**: لسه في التطوير فالهيكل كله في `001_init.ts` (امسح ملف الداتا بيز بعد أي تعديل). بعد الإصدار الأول أي تعديل = migration جديدة (بتاخد نسخة `.bak` تلقائيًا).
- **الأيقونات**: `lucide-react` بس. **الرسائل**: `useToast()` بدل أي رسالة داخل الصفحة.
- **إضافة feature**: فولدر في `electron/features` (repository/service/ipc) وسجّله في `features/index.ts`، وفولدر في `src/features`، وRoute في `routes.tsx`.
