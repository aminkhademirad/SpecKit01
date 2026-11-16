# گزارش اجرای فاز سوم ChangeFlow

**تاریخ**: 2026-11-16  
**دامنهٔ تأییدشده**: فقط فاز سوم، داستان اول، T022 تا T032  
**نتیجه**: هر ۱۱ Task این فاز با شواهد واقعی تکمیل شد؛ فاز چهارم آغاز نشده است.

## پیش‌نیاز و ترتیب اجرا

در آغاز، وضعیت واقعی T001 تا T021 تکمیل‌شده و سایر Taskها انجام‌نشده بود؛ Git تغییر ثبت‌نشده نداشت. Build، Typecheck و ۴۰ آزمون Unit دوباره اجرا و موفق شدند. گزارش ماشین‌خوان فاز دوم نیز ۶۴ آزمون Integration موفق و صفر ناموفق داشت؛ این گزارش قبلی با اجرای مجدد اشتباه گرفته نشد. چک‌لیست requirements.md دارای ۱۶ مورد تأییدشده و صفر مورد باز بود و تغییر نکرد.

مبنا، [Constitution](../../../.specify/memory/constitution.md)، [Specification](../spec.md)، [Plan](../plan.md)، [Research](../research.md)، [قرارداد HTTP](../contracts/http-api.md) و [Taskها](../tasks.md) است.

| Task | پیش‌نیاز مستقیم | نتیجه |
| --- | --- | --- |
| T022 | T021 | آزمون قرارداد POST/GET/PUT، شش فیلد نمایش، Location/ETag، خطاها و حدود ورودی |
| T023 | T021 | آزمون مستقل محتوا، حداقل/حداکثر، trim، Unicode و رد خصوصیت اضافی |
| T024 | T021 | سناریوهای AC-101 تا AC-116 با HTTP واقعی و بررسی Database |
| T025 | T021 | Persistence واقعی، اتصال مستقل، نسخهٔ تازه، نوشتن مشروط و ثبات هویت |
| T026 | T022، T023، T024 | اعتبارسنج مستقل Domain و ورودی deferred در HTTP |
| T027 | T017، T022، T024، T025 | گسترش همان Store برای insert، ویرایش مشروط و قابلیت زیرساختی انتقال مشروط |
| T028 | T026، T027 | Create با نقش جاری، Draft، مالک از هویت معتبر و UUIDهای تولیدشده توسط سامانه |
| T029 | T027 | Get با سرویس snapshot و سیاست مشترک visibility |
| T030 | T026، T027 | ویرایش فقط Draft مالک مجاز، با نسخهٔ مشاهده‌شده و تراکنش IMMEDIATE |
| T031 | T028، T029، T030 | Controller نازک و اتصال Providerها در AppModule |
| T032 | T031 | Build، Typecheck، آزمون‌های واقعی و این گزارش |

چهار فایل آزمون پیش از رفتار اصلی نوشته شدند. برای جلوگیری از خطای import، فقط امضای قابل‌فراخوانی اعتبارسنج و متدهای Store ابتدا به‌شکل اسکلت آماده شد. شکست رفتاری واقعی در هر چهار فایل ثبت شد؛ سپس پیاده‌سازی انجام شد.

## رفتار و معماری پیاده‌شده

- POST /api/change-requests درخواست را در Draft، با مالک منطبق بر نگاشت هویت معتبر و id/version تازه ایجاد می‌کند؛ پاسخ 201، Location و ETag قوی دارد.
- GET /api/change-requests/{id} نمایش مجاز را با ETag برمی‌گرداند؛ مالک در هر چهار وضعیت و Reviewer برای درخواست دیگران فقط در PendingReview دسترسی دارد.
- PUT /api/change-requests/{id} در این برش فقط محتوای Draft متعلق به Requester دارای مجوز جاری را جایگزین می‌کند؛ مالک، id و status ثابت و version تازه می‌شود.
- فقط شش فیلد id، title، description، reason، requesterId و status در Body نمایش داده می‌شوند؛ version فقط در ETag است و no-store حفظ شده است.
- اعتبارسنج Domain هر سه string را الزامی می‌داند؛ Unicode ناسالم، مقدار خالی یا فقط فاصله، نوع نامعتبر و خصوصیت ناشناخته را رد می‌کند. trim پیش از شمارش scalar است؛ حدود ۲۰۰، ۵۰۰۰ و ۲۰۰۰ و متن سادهٔ چندزبانه حفظ شده‌اند.
- requesterId یا status، حتی درست یا هم‌زمان، کل ورودی را نامعتبر می‌کنند؛ تبدیل خودکار نوع یا حذف بی‌صدای خصوصیت وجود ندارد.
- Create و Update داخل IMMEDIATE، نقش جاری را از همان SQLite می‌خوانند. مجوز و در Update وضعیت، پیش از بازکردن ورودی deferred بررسی می‌شوند؛ انقضای هویت پیش از خروج موفق callback نیز دوباره بررسی می‌شود و خطا Rollback دارد.
- Application به Nest یا HTTP وابسته نیست؛ ورودی و نسخه را از callbackهای همگام دریافت می‌کند. Controller فقط درخواست را به این callbackها تبدیل و نمایش و Header را تولید می‌کند؛ SQL و قواعد محصول در آن قرار ندارند.
- Store با Prepared SQL و RETURNING، دقیقاً یک ردیف را برای موفقیت الزام می‌کند؛ شرط id و version مشاهده‌شده مانع بازنویسی دادهٔ جدیدتر است. متد زیرساختی انتقال ساخته شده، اما هیچ کاربرد یا Endpoint مربوط به Submit، Approve یا RequestChanges در این فاز ایجاد نشده است.

ویرایش ChangesRequested طبق T047 به فاز ششم تعلق دارد و فعلاً با INVALID_STATE رد می‌شود؛ مشاهدهٔ آن برای مالک برقرار است. این محدودیت مرحله‌ای، تغییر Specification یا دامنهٔ نهایی MVP نیست.

## فرمان‌ها و نتایج واقعی

| فرمان | کد خروج | نتیجه |
| --- | --- | --- |
| npm.cmd run test:unit -- --runTestsByPath test/unit/us1-content.spec.ts --testNamePattern=AC-101 --json --outputFile=test-results/us1/unit-red.json | ۱ | یک assertion ناموفق؛ ۵۲ مورد انتخاب‌نشده؛ محتوای معتبر در اسکلت اولیه پذیرفته نمی‌شد. |
| npm.cmd run test:integration -- --runTestsByPath test/integration/us1-http.spec.ts test/integration/us1-persistence.spec.ts --testNamePattern=AC-101 --json --outputFile=test-results/us1/integration-red.json | ۱ | دو assertion ناموفق؛ HTTP پاسخ 404 به‌جای 201 داشت و Store هنوز insert موفق نداشت. |
| npm.cmd run test:contract -- --testNamePattern=AC-101 --json --outputFile=test-results/us1/contract-red.json | ۱ | یک assertion ناموفق؛ مسیر ایجاد هنوز وجود نداشت. |
| npm.cmd run build؛ اجرای نهایی | ۰ | ساخت واقعی برنامه با Nest CLI |
| npm.cmd run typecheck؛ اجرای نهایی | ۰ | بررسی نوع src، tools و test |
| npm.cmd run test:unit -- --json --outputFile=test-results/us1/unit.json | ۰ | ۳ مجموعه؛ ۹۳ آزمون موفق؛ صفر ناموفق |
| npm.cmd run test:integration -- --json --outputFile=test-results/us1/integration.json | ۰ | ۸ مجموعه؛ ۱۰۲ آزمون موفق؛ صفر ناموفق |
| npm.cmd run test:contract -- --json --outputFile=test-results/us1/contract.json | ۰ | یک مجموعه؛ ۶ آزمون موفق؛ صفر ناموفق |

جمع مجموعه‌های نهایی ۲۰۱ آزمون است؛ ۵۳ آزمون Unit، ۳۸ آزمون Integration و ۶ آزمون Contract مربوط به فایل‌های جدید US1 هستند و آزمون‌های موجود نیز دوباره عبور کردند. تعداد آزمون با تعداد معیار پذیرش یکسان نیست.

شروع ثبت‌شده در گزارش‌های نهایی: Unit برابر 2026-11-16T19:48:20.612Z، Integration برابر 2026-11-16T19:52:12.722Z و Contract برابر 2026-11-16T19:52:06.118Z.

گزارش‌های ماشین‌خوان [Unit](../../../test-results/us1/unit.json)، [Integration](../../../test-results/us1/integration.json) و [Contract](../../../test-results/us1/contract.json) در محیط محلی موجود و خارج از Git هستند؛ در checkout تازه باید با فرمان‌های بالا تولید شوند. خروجی‌های مرحلهٔ قرمز نیز در test-results/us1/ حفظ شده‌اند؛ انتخاب‌نشدن آزمون در آن اجراها به معنی موفقیت آن نیست.

## شواهد پذیرش ۱۶ سناریوی داستان اول

نتایج زیر به assertionهای اجراشده و خواندن واقعی SQLite در test/integration/us1-http.spec.ts و آزمون‌های مکمل متکی‌اند. نمونه‌ها دادهٔ آزمایشی‌اند؛ شناسه‌های تصادفی یا توکن واقعی در این جدول جعل نشده‌اند.

| سناریو | آزمون و نمونهٔ بررسی‌شده | نتیجهٔ Database و پاسخ |
| --- | --- | --- |
| AC-101 | ایجاد با عنوان « عنوان »، شرح «شرح تغییر» دارای فاصلهٔ بیرونی و دلیل « دلیل تغییر » | 201؛ ردیف با محتوای trim‌شده، مالک requester-a و status برابر Draft خوانده و تطبیق داده شد. |
| AC-102 | ویرایش عنوان همان درخواست به «عنوان تازه» با ETag جاری | 200؛ id، مالک و Draft ثابت ماندند؛ عنوان و version واقعی تغییر کردند. |
| AC-103 | ویرایش Draft شخص دیگر توسط reviewer-b، dual-c و reviewer-d | 404 عمومی؛ snapshot همهٔ ردیف‌های درخواست پیش و پس از هر تلاش برابر بود. |
| AC-104 | ایجاد بدون هویت، با Reviewer و با subject بدون نگاشت | به‌ترتیب 401 و 403؛ هیچ درخواست جدیدی ایجاد نشد. |
| AC-105 | ارسال requesterId جعلی یا status برابر Approved همراه محتوای معتبر | 400؛ snapshot Database تغییر نکرد. |
| AC-106 | GET مالک برای Draft، PendingReview، ChangesRequested و Approved آماده‌شده با fixture | هر چهار مورد 200؛ محتوا و وضعیت همان ردیف و ETag متناظر خوانده شدند؛ نمونهٔ Approved همچنان قابل مشاهده بود. |
| AC-107 | دو ایجاد با عنوان «عنوان» و محتوای یکسان؛ همچنین دو فراخوانی مستقیم Application با «عنوان یکسان» | شناسه‌ها و نسخه‌های مستقل؛ دو ردیف جدید؛ آزمون مستقیم تعداد ردیف‌ها را از ۸ به ۱۰ و حفظ هر دو ردیف بررسی کرد. |
| AC-108 | DELETE مالک روی Draft؛ همچنین بررسی نبود PATCH و مسیرهای انتقال | 404؛ داده، وضعیت و نسخهٔ درخواست حذف یا تغییر نکردند. |
| AC-109 | یک scalar و دقیقاً سقف مجاز در هر سه فیلد، با ایموجی | ایجاد موفق و مقدار کامل از SQLite بازیابی و تطبیق داده شد؛ شمارش بر حسب scalar بود. |
| AC-110 | نبود هر فیلد، null، مقدار خالی و فقط فاصله | 400؛ snapshot ردیف‌ها پیش و پس از تلاش برابر بود. |
| AC-111 | عنوان ۲۰۱، شرح ۵۰۰۱ یا دلیل ۲۰۰۱ scalar پس از trim | 400؛ هیچ ردیف جدید یا تغییر جزئی ثبت نشد. |
| AC-112 | فاصلهٔ بیرونی در هر سه مقدار و سقف هر فیلد همراه فاصله | مقدار trim‌شدهٔ هر فیلد از Database بررسی شد؛ رشتهٔ خام بلندتر به دلیل فاصلهٔ بیرونی رد نشد. |
| AC-113 | requesterId واقعی مالک، Draft درست و سپس هر دو هم‌زمان | همه 400؛ درست‌بودن مقدار باعث پذیرش یا نادیده‌گرفتن فیلد نشد؛ snapshot Database ثابت ماند. |
| AC-114 | متن فارسی و English، نیم‌فاصله، ایموجی مرکب، HTML و Markdown | ایجاد و GET موفق؛ همان متن ساده از ذخیره‌سازی و پاسخ بازیابی شد و تفسیر نشد. |
| AC-115 | PUT با عنوان خالی، status درست یا requesterId درست | 400 با دستهٔ ورودی نامعتبر، نام فیلد و علت فارسی؛ همهٔ داده‌ها و version بدون تغییر ماندند. |
| AC-116 | عملیات ایجاد بدون هویت معتبر و بدنهٔ JSON نامعتبر | 401 با دسته و توضیح فارسی و WWW-Authenticate؛ خطای JSON جای خطای هویت را نگرفت و داده‌ای ثبت نشد. |

### بررسی‌های حساس مکمل

- ویرایش موفق و سپس ویرایش با نسخهٔ قدیمی، 412 ایجاد کرد و ردیف جدیدتر، محتوا و version آن حفظ شدند؛ این شاهد تعارض نسخه است، نه اثبات کامل رقابت چند worker در US5.
- PendingReview، Approved و فعلاً ChangesRequested برای ویرایش رد شدند؛ حتی JSON نامعتبر پیش از بررسی وضعیت، پاسخ اختصاصی نگرفت.
- پس از لغو مجوز Requester، همان هویت قبلی می‌تواند درخواست خود را مشاهده کند اما ایجاد و ویرایش 403 می‌گیرند؛ Database تغییر نکرد.
- فراخوانی مستقیم Application، مالکیت، وضعیت، نقش جاری و اعتبارسنجی را بدون Controller بررسی کرد؛ ورودی در عملیات فاقد مجوز خوانده نشد.
- انقضای هویت در callback محتوای ایجاد، پس از INSERT و پیش از Commit، Rollback ایجاد کرد؛ snapshot Database ثابت ماند.
- Unicode ناسالم از مسیر HTTP در ایجاد و ویرایش رد شد؛ هیچ تغییر جزئی رخ نداد.
- D-07 با بدنهٔ دقیقاً ۱۳۱۰۷۲ بایتی و محتوای معتبر پس از trim اجرا شد؛ یک بایت بیشتر با هویت نامعتبر نیز 413 داد و داده‌ای ثبت نشد.
- نگاشت فیلدها با بازکردن اتصال مستقل SQLite بررسی شد؛ شرط نسخه، Rollback و تغییرناپذیری id و مالک در Persistence آزموده شدند.

## خطاها و اصلاحات این فاز

۱. شکست‌های اولیهٔ آزمون‌ها رفتاری و مورد انتظار بودند؛ خروجی 404 و اسکلت نوشتن/اعتبارسنجی باعث شکست assertion شدند، نه خطای import یا نصب. نتیجهٔ قرمز به‌عنوان قبولی گزارش نشده است.

۲. Typecheck اولیه نبود تعریف نوع String.isWellFormed در lib پیش‌فرض ES2023 و nullable بودن Header در چند آزمون را گزارش کرد. lib برابر ES2024 به tsconfig افزوده شد تا API استاندارد موجود در Node 24 به‌درستی نوع‌دهی شود؛ target برابر ES2023، خروجی CommonJS و Runtime مصوب تغییر نکردند. آزمون‌ها نیز پس از بررسی قرارداد Header، نوع مقدار موجود را مشخص کردند. Typecheck نهایی موفق بود.

۳. آزمون قدیمی setup-bootstrap که نبود مسیر محصول را توصیف می‌کرد، اکنون دقیقاً نبود GET فهرست عمومی را توصیف می‌کند؛ assertion مربوط به 404 حفظ شد و قابلیت فهرست اضافه نشد.

۴. اجرای کامل Integration با دسترسی لازم برای subprocess ابزارهای CLI موجود انجام شد؛ هیچ کلید یا توکنی در گزارش چاپ نشد. هشدار آزمایشی VM Modules باقی است؛ هشدار ابزار glob و ممیزی نهایی وابستگی‌ها در این فاز رفع یا تکمیل نشده‌اند.

## فایل‌های ایجادشده و تغییرکرده

| بخش | فایل‌ها |
| --- | --- |
| اعتبارسنجی | src/domain/change-request-content.ts و src/http/inputs/write-change-request.input.ts |
| Persistence | src/infrastructure/sqlite/sqlite-change-request-store.ts گسترش یافت. |
| Application | src/application/create-change-request.ts، get-change-request.ts و update-change-request.ts |
| HTTP و اتصال | src/http/controllers/change-requests.controller.ts و src/app.module.ts |
| آزمون جدید | test/unit/us1-content.spec.ts؛ test/integration/us1-http.spec.ts، us1-persistence.spec.ts و us1-contract.spec.ts |
| تنظیم و آزمون موجود | tsconfig.json و عنوان آزمون test/integration/setup-bootstrap.spec.ts |
| پیگیری | tasks.md و این گزارش در evidence/us1.md |

Constitution، Specification، Plan/Research، قراردادها، Migration، package.json، lockfile، چک‌لیست‌ها و فایل کلید محلی تغییر نکردند. SHA-256 فایل lockfile همچنان 47aec7af21e0642cc65405a12c0cd95ef79f04604bb5bca2979b381244e1bc10 است. آزمون‌ها Database و هویت نمونهٔ موقت خود را داشتند.

## محدودیت‌ها و نقطهٔ توقف

- این خروجی، برش ایجاد و ویرایش Draft و مشاهدهٔ مجاز است؛ MVP کامل و پذیرش نهایی ۲۷ نیازمندی و ۵۳ سناریو نیست. برای نمونه، بخش ChangesRequested در FR-004 به US4 وابسته است.
- هیچ کاربرد یا Endpoint مربوط به Submit، Approve، RequestChanges، اصلاح درخواست برگشت‌خورده، حذف، لغو، فهرست عمومی، Login یا مدیریت عمومی نقش ساخته نشده است.
- آزمون‌های رقابت چند worker و هر دو ترتیب Commit تصمیم و لغو مجوز، Validation و Acceptance نهایی در Taskهای آینده باقی مانده‌اند؛ موفقیت فعلی جایگزین آن‌ها نیست.
- آزمون‌ها با bootstrap مشترک، JWT واقعی و SQLite فایل‌محور موقت اجرا شدند؛ استقرار production، بار عملیاتی و پذیرش نمایندگان کاربران در این مرحله بررسی نشده‌اند.
- T001 تا T032 تکمیل و T033 تا T064، شامل ۳۲ Task، انجام‌نشده‌اند. فاز بعد T033 تا T037 است و به T032 و تأیید صریح کاربر وابسته است.
- .specify/extensions.yml وجود نداشت؛ Hook پیش یا پس از Implement ثبت نشده بود.

فاز سوم در همین نقطه متوقف شده است؛ هیچ Task فاز چهارم آغاز نشده است.
