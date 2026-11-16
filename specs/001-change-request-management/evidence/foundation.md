# گزارش اجرای فاز دوم ChangeFlow

**تاریخ**: 2026-11-16  
**دامنهٔ تأییدشده**: فقط T006 تا T021، زیرساخت پایه و پیش‌نیازهای مسدودکننده  
**نتیجه**: هر ۱۶ Task با شواهد اجرای واقعی تکمیل شدند؛ فاز سوم آغاز نشده است.

## مبنا و بررسی پیش‌نیاز

مبنا، [قانون اساسی نسخهٔ 1.1.0](../../../.specify/memory/constitution.md)، [Specification](../spec.md)، [Plan](../plan.md)، [Research](../research.md)، [مدل داده](../data-model.md)، [قرارداد HTTP](../contracts/http-api.md) و [Taskها](../tasks.md) است.

کاربر پایان فاز اول را تأیید و اجرای فقط فاز دوم را مجاز کرد. پیش از تغییر کد، Build، Typecheck، ۱۸ آزمون Unit و ۵ آزمون Integration فاز اول دوباره موفق شدند. چک‌لیست requirements.md دارای ۱۶ مورد تأییدشده و صفر مورد باز بود و تغییر نکرد. فایل .specify/extensions.yml وجود نداشت؛ Hook ثبت‌شده‌ای برای پیش یا پس از اجرا وجود نداشت.

## ترتیب وابستگی‌ها و خروجی Taskها

| Task | پیش‌نیاز مستقیم | خروجی و شاهد |
| --- | --- | --- |
| T006 | T005 | مدل مستقل User، شناسهٔ UUID، هویت دارای انقضا و نقش‌های پیش‌فرض غیرفعال؛ آزمون مدل و سیاست مجوز |
| T007 | T005 | مدل readonly درخواست، چهار وضعیت و ثابت‌های حدود محتوایی مصوب؛ بدون وابستگی Nest یا SQLite |
| T008 | T005 | خطاهای مستقل از HTTP با code و خطاهای فیلد؛ بدون ذخیرهٔ SQL یا JWT در خطای عمومی |
| T009 | T005 | Migration ترتیبی و تراکنشی، ثبت شماره و checksum، رد تغییر checksum و نسخهٔ نامعلوم؛ ابزار db:migrate |
| T010 | T009 | اتصال فایل محلی، foreign_keys فعال، timeout برابر ۱۰۰۰ میلی‌ثانیه، بستن اتصال؛ بدون WAL خودکار |
| T011 | T008، T010 | write با BEGIN IMMEDIATE پیش از callback؛ read با snapshot تراکنشی؛ Rollback، رد callback ناهمگام و تفکیک BUSY از تعارض نسخه |
| T012 | T006، T007، T008 | سیاست مستقل مشاهده، نقش فعلی، مالکیت، زمان اعتبار هویت و منع هر دو تصمیم روی درخواست خود |
| T013 | T006، T010، T011 | Store با Prepared SQL، نتیجهٔ صریح نبود نگاشت و سرویس داخلی تغییر نقش از واحد کار مشترک |
| T014 | T003، T006، T008 | verify واقعی JWT با HS256، امضا، issuer، audience، exp و sub؛ Guard فقط هویت قابل اتکا می‌دهد و role claim مرجع نقش نیست. |
| T015 | T008 | پاسخ‌های فارسی 400، 401، 403، 404، 409، 412، 413، 428 و 500/503؛ no-store و محرمانگی پاسخ عمومی |
| T016 | T007، T008 | codec مربوط به ETag قوی، تشخیص قالب نامعتبر، نسخهٔ غایب و نسخهٔ قدیمی |
| T017 | T007، T010، T011، T012، T013، T014، T015 | خواندن Store درخواست و Query/Guard با snapshot مشترک؛ id نامعتبر، ناموجود و پنهان یک 404 عمومی دارند. |
| T018 | T014، T015، T017 | bootstrap مشترک، بدنهٔ خام محدود، تقدم هویت و visibility، parsing پس از Guard و نگهداری deferred خطا برای بررسی نهایی Application |
| T019 | T002، T009، T010، T013، T014، T018 | fixture با Migration واقعی، چهار کاربر نمونه، درخواست‌های آمادهٔ چهار وضعیت، JWT واقعی و Nest test factory با تنظیم HTTP مشترک |
| T020 | T004، T009، T011، T013، T014 | ابزارهای dev:seed، dev:token و dev:permissions؛ فقط Development/Test و بدون Endpoint عمومی |
| T021 | T006 تا T020 | آزمون و ثبت آمادگی زیرساخت با Build، Typecheck، Unit و Integration واقعی |

در اجرای کد، اتصال پیش از Storeها و واحد کار آماده شد؛ fixture پیش از Migration داده نمی‌سازد. Store درخواست در این فاز فقط خواندن دارد؛ insert و update محصول طبق T027 به فاز سوم تعلق دارند. وضعیت‌ها و حدود محتوا در مدل ثبت شده‌اند؛ اعتبارسنجی کامل محتوای ایجاد و ویرایش طبق T026 باقی مانده است.

## تصمیم‌های اجرایی و حفظ معماری

- Domain فاقد import از Nest، SQLite یا لایهٔ HTTP است. Controller محصول ساخته نشده؛ سیاست مالکیت، مشاهده و مجوز در Domain و Application قرار دارد.
- کاربران و درخواست‌ها در یک فایل SQLite هستند. تغییر مجوز داخلی از همان واحد کار IMMEDIATE استفاده می‌کند؛ مجوز توکن یا cache جای خواندن نقش فعلی را نمی‌گیرد.
- Migration پیش از پذیرش ترافیک باید با ابزار مستقل اجرا شود. bootstrap نسخه و checksum را بررسی می‌کند و Database آماده‌نشده را رد می‌کند؛ reset یا synchronize خودکار وجود ندارد.
- checksum متن SQL پس از یکسان‌سازی پایان خط CRLF به LF محاسبه می‌شود تا تنظیم پایان خط Git به‌تنهایی خطای تغییر Migration ایجاد نکند. تغییر محتوای واقعی همچنان رد می‌شود.
- provision نمونه فقط کاربر غایب را ایجاد می‌کند؛ اجرای دوبارهٔ seed، id، دادهٔ درخواست یا نقش لغوشدهٔ کاربر موجود را بازنشانی نمی‌کند.
- مطابق D-07، بدنهٔ بیش از ۱۳۱۰۷۲ بایت پیش از parsing و بررسی هویت/visibility با 413 عمومی رد می‌شود. بدنهٔ دقیقاً در سقف فقط از کنترل حجم عبور می‌کند؛ این عبور تأیید محتوای کسب‌وکار نیست.
- مطابق D-08، JWT معتبر فاقد ردیف محلی مجوز ایجاد ندارد و هیچ provision خودکاری رخ نمی‌دهد؛ عملیات وابسته به شناسه 404 عمومی می‌گیرند. رفتار مجوز ایجاد در Application آزمایشی و سیاست مستقل سنجیده شد؛ Endpoint واقعی ایجاد در فاز سوم ساخته می‌شود.
- Pipe، خطای JSON را در DeferredJsonBody نگه می‌دارد؛ unwrap و رد خصوصیت اضافی باید پس از بازخوانی مجوز و وضعیت نهایی در Application انجام شود. آزمون HTTP این ترتیب را با Application فقط‌آزمایشی بررسی می‌کند؛ این کلاس وارد کد محصول نشده است.
- هیچ تغییر مهم محصولی، Framework، Database، Driver، سازوکار Concurrency یا راهبرد هویت نسبت به طرح مصوب انجام نشد؛ وابستگی جدیدی نصب نشد.

## محیط و اثر انگشت

| مورد | مقدار |
| --- | --- |
| محیط | Windows، win32، x64 |
| Node.js و npm | v24.18.0 و 11.16.0 |
| NestJS و TypeScript | 12.5.0 و 6.0.3 |
| Jest | 30.5.2 با VM Modules |
| better-sqlite3 و SQLite | 13.2.0 و 3.54.1؛ همان پشتهٔ فاز اول |
| SHA-256 فایل package-lock.json | 47aec7af21e0642cc65405a12c0cd95ef79f04604bb5bca2979b381244e1bc10 |
| checksum مربوط به Migration 001 | 0c5efb3ee71f245afc2d1651e5480b2d81e7065a335780ebca36ebcd9b1fd318 |

## اجرای واقعی نهایی

| فرمان | کد خروج | نتیجه |
| --- | --- | --- |
| npm.cmd run build | ۰ | Build واقعی پس از آخرین تغییر کد موفق بود. |
| npm.cmd run typecheck | ۰ | بررسی نوع src، tools و test موفق بود. |
| npm.cmd run test:unit -- --json --outputFile=test-results/foundation/unit.json | ۰ | ۲ مجموعه، ۴۰ آزمون موفق، صفر ناموفق |
| npm.cmd run test:integration -- --json --outputFile=test-results/foundation/integration.json | ۰ | ۶ مجموعه، ۶۴ آزمون موفق، صفر ناموفق |
| npm.cmd run test:integration -- --runTestsByPath test/integration/development-tools.spec.ts | ۰ | بررسی مستقل ۷ آزمون ابزارهای واقعی CLI نیز موفق بود. |
| جست‌وجوی وابستگی‌های ممنوع در src/domain | بدون تطابق | import از Nest، SQLite، Infrastructure یا HTTP یافت نشد؛ این بررسی جای تست معماری نهایی T058 را نمی‌گیرد. |

شروع ثبت‌شده در خروجی Unit برابر 2026-11-16T19:21:03.394Z و در Integration برابر 2026-11-16T19:23:29.095Z است.
خروجی‌های ماشین‌خوان [Unit](../../../test-results/foundation/unit.json) و [Integration](../../../test-results/foundation/integration.json) محلی و خارج از Git هستند؛ در checkout تازه باید با فرمان‌های بالا تولید شوند. الگوی توکن JWT در گزارش‌های نهایی یافت نشد؛ کلید واقعی در سند ثبت نشده است.

### دامنهٔ آزمون‌های اجراشده

- مدل کاربر، نقش غیرفعال پیش‌فرض، مالک در چهار وضعیت، Reviewer فقط برای درخواست دیگران در PendingReview، غیرمالک، کاربر بدون نقش و کاربر دارای دو نقش
- منع مستقیم Approve و RequestChanges روی درخواست خود، انقضای هویت و رد عملیات ناشناخته در سیاست مجوز
- Migration اولیه و تکراری، عدم حذف داده، checksum تغییرکرده، نسخهٔ ناشناخته، شمارهٔ ناپیوسته، CRLF، Rollback کل Migration ناموفق و رد Database بدون Migration
- PK، UNIQUE هویت، FK، نقش نامعتبر، وضعیت نامعتبر و تغییرناپذیری شناسه و مالک درخواست در SQLite
- خواندن مجوز جاری پس از صدور توکن، لغو نقش و عدم احیای خودکار آن در seed تکراری؛ JWT دارای role claim نیز نقش محلی ایجاد نمی‌کند.
- JWT با امضای نامعتبر، الگوریتم نامعتبر، issuer/audience نامعتبر یا غایب، exp غایب یا منقضی و sub غایب یا خالی
- Rollback تغییر نقش، عدم اجرای callback ناهمگام، قفل واقعی نویسنده پیش از callback و نگاشت SQLITE_BUSY به SERVICE_UNAVAILABLE با اتصال مستقل
- ETag قوی، پیش‌شرط غایب 428، قالب نامعتبر 400، نسخهٔ قدیمی 412 و JSON/UTF-8 نامعتبر به‌صورت deferred
- bootstrap واقعی با Authentication و visibility مقدم بر خطای بدنه؛ برابری پاسخ منبع ناموجود، پنهان و id نامعتبر؛ خطای مجوز پیش از خطای JSON برای منبع قابل مشاهده
- سقف دقیق بدنه و یک بایت بیشتر، پاسخ یکسان 413 با هویت معتبر و نامعتبر و منبع موجود، پنهان و ناموجود و عدم تغییر داده
- تمام نگاشت‌های خطای مصوب، پیام فارسی، no-store، WWW-Authenticate و عدم افشای stack یا خطای داخلی
- CLI واقعی Migration، seed، تغییر مجوز و توکن کوتاه‌عمر؛ Database موقت، منع اجرا در production و عدم provision کاربر ناشناخته

## خطاها و محدودیت‌های مشاهده‌شده

۱. اجرای اولیهٔ Integration در محیط محدود، ۵۷ آزمون موفق و ۳ ناموفق داشت؛ هر سه مورد ناموفق مربوط به subprocess ابزارهای CLI بودند. فایل test-results/foundation-initial.json این نتیجه را نگه می‌دارد. اجرای مجاز ابزارها با محیط لازم سپس هر ۷ آزمون CLI را گذراند و اجرای نهایی کل مجموعه نیز موفق شد؛ نتیجهٔ اولیه موفق گزارش نشده است.

۲. بررسی خودکار مجوز اجرای خارج از محدودیت برای دو درخواست، پیش از شروع فرمان به مهلت خود رسید. پیام ابزار تصریح کرد این پایان مهلت به معنی ناامن‌بودن فرمان نیست و یک بار تکرار مجاز است؛ تکرار هر درخواست پذیرفته شد و فرمان اجرا شد. رد ایمنی قطعی یا مجوز معلق در پایان باقی نماند.

۳. هشدار آزمایشی VM Modules همچنان در Jest دیده می‌شود. lockfile و نسخه‌های ابزار تغییر نکردند؛ هشدار glob ابزار فاز اول در این فاز رفع یا ممیزی نشده است.

۴. آزمون قفل SQLite با دو اتصال واقعی، شاهد آمادگی مرز IMMEDIATE است؛ به معنی تکمیل سناریوهای رقابت ویرایش و تصمیم یا هر دو ترتیب Commit لغو مجوز در US5 نیست. آن سناریوهای محصول هنوز اجرا نشده‌اند.

۵. هیچ Endpoint محصول برای ایجاد، مشاهده، ویرایش، Submit، Approve یا RequestChanges ساخته نشده است. مسیرهای foundation فقط Controllerهای آزمون داخل test هستند و به AppModule محصول اضافه نشده‌اند. موفقیت ۱۰۴ آزمون موجود، به معنی قبولی ۵۳ سناریوی پذیرش محصول نیست.

## فایل‌های ایجادشده و تغییرکرده

| بخش | فایل‌ها |
| --- | --- |
| مدل و سیاست | src/domain/user.ts، change-request.ts، errors.ts و authorization-policy.ts |
| Migration | migrations/001-initial-schema.sql؛ src/infrastructure/sqlite/migration-runner.ts؛ tools/migrate.ts |
| SQLite | src/infrastructure/sqlite/sqlite-database.ts، sqlite-unit-of-work.ts، sqlite-user-store.ts و sqlite-change-request-store.ts |
| Authentication | src/infrastructure/authentication/jwt-identity.ts؛ src/http/guards/authentication.guard.ts |
| Application | src/application/change-user-permissions.ts و request-visibility.ts |
| HTTP | src/http/guards/request-visibility.guard.ts؛ src/http/filters/api-error.filter.ts؛ src/http/etag.ts؛ src/http/configure-http.ts؛ src/http/pipes/parse-json-body.pipe.ts |
| اتصال برنامه | src/app.module.ts و src/main.ts تغییر کردند. |
| ابزارهای توسعه | tools/development-context.ts، dev-seed.ts، dev-token.ts و dev-permissions.ts |
| fixture | test/fixtures/database-fixture.ts، identity-fixture.ts و create-test-app.ts |
| آزمون | test/unit/authorization-policy.spec.ts؛ test/integration/foundation.spec.ts، foundation-http.spec.ts و development-tools.spec.ts |
| حفظ آزمون Setup | test/integration/setup-bootstrap.spec.ts اکنون از factory مشترک و bootstrap واقعی فاز دوم استفاده می‌کند. |
| پیگیری و شواهد | tasks.md برای تکمیل T006 تا T021 و همین گزارش foundation.md |

Constitution، Specification، Plan/Research، قراردادها، package.json، lockfile و چک‌لیست‌ها در این فاز تغییر نکردند. فایل .env و کلید محلی نیز بازنویسی نشدند؛ آزمون‌ها Database و کلید نمونهٔ موقت خود را دارند.

## نقطهٔ توقف و پیش‌نیاز بعد

T001 تا T021 تکمیل و T022 تا T064، شامل ۴۳ Task، انجام‌نشده‌اند. فاز بعد، داستان اول در T022 تا T032، به دروازهٔ T021 و تأیید صریح کاربر وابسته است؛ ابتدا آزمون‌های داستان و سپس اعتبارسنج محتوا، گسترش Store و کاربردهای ایجاد، مشاهده و ویرایش ساخته می‌شوند.

هیچ Task فاز سوم آغاز نشده است. Build و Test موفق این فاز، پذیرش نهایی محصول نیستند؛ Validation و Acceptance مصوب همچنان در فازهای بعد باقی می‌مانند.
