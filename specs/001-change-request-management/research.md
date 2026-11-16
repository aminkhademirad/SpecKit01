# پژوهش و تصمیم‌های معماری ChangeFlow

**تاریخ**: 2026-11-16 | **مبنا**: [spec.md](spec.md)، [قانون اساسی](../../.specify/memory/constitution.md)

**وضعیت**: تصمیم‌های مهم با تأیید کاربر ثبت شده‌اند؛ طراحی برای NestJS تکمیل شده است.
کاربر D-01 را NestJS به دلیل نزدیکی به پشتهٔ خود انتخاب کرد و D-02 تا D-06 را برای MVP تأیید کرد.
سپس جایگزینی EF Core با Driver مستقیم better-sqlite3، با پذیرش نگاشت و Migration محدود پروژه، جداگانه تأیید شد.
هیچ Build، نصب، آزمون یا Benchmark برنامه اجرا نشده است؛ شواهد این سند، مطالعهٔ منابع و بازبینی طراحی‌اند.

## خلاصهٔ تصمیم‌های مصوب

| شناسه | تصمیم نهایی | دلیل و مصالحهٔ پذیرفته‌شده |
| --- | --- | --- |
| D-01 | NestJS 12، TypeScript 6، Node.js 24 LTS؛ CommonJS و Jest 30 با Supertest | انتخاب صریح کاربر برای نزدیکی به پشتهٔ خود؛ جایگزین C# و ابزارهای .NET شد. |
| D-02 | یک برنامهٔ قابل استقرار؛ جداسازی منطقی HTTP، Application/Domain و Persistence؛ دو مجموعهٔ مستقل آزمون | سادگی MVP؛ کنترل مرزها با بازبینی و آزمون، بدون اجبار به چند اسمبلی یا سرویس. |
| D-03 | SQLite روی دیسک محلی؛ better-sqlite3 مستقیم در Provider کوچک؛ Prepared SQL و Migration ترتیبی | بدون سرویس Database یا ORM؛ هزینهٔ نگاشت و Migration محدود به عهدهٔ پروژه است و کاربر تأیید کرده است. |
| D-04 | JWT امضاشدهٔ Development/Test و نقش فعلی از همان SQLite | اجرای مستقل تمرین؛ هویت عملیاتی سازمانی یا Login ساخته نمی‌شود. |
| D-05 | token نسخهٔ درخواست، ETag و If-Match؛ نوشتن مشروط | جلوگیری از Lost Update برای نسخهٔ مشاهده‌شدهٔ مشتری؛ کلاینت باید ETag را نگه دارد. |
| D-06 | شمارش Unicode scalar پس از trim | تعریف تکرارپذیر؛ ایموجی مرکب ممکن است چند scalar محسوب شود. |

نسخهٔ دقیق بسته‌ها در package-lock.json مرحلهٔ پیاده‌سازی تثبیت و با Build/Test واقعی بررسی می‌شود؛
نسخهٔ یک مخزن وب به معنی بستهٔ نصب‌شده در این پروژه نیست. تصمیم معماری باز یا منتظر تأیید باقی نمانده است.

## گزینه‌های Framework و سازگاری نسخه‌ها

NestJS به دلیل ترجیح صریح کاربر انتخاب شد؛ ASP.NET Core و FastAPI گزینه‌های بررسی‌شده بودند.
Nest ساختار Controller، Provider و Module را فراهم می‌کند؛ قواعد Domain خودکار از این ساختار حاصل نمی‌شوند.
نوع‌دهی TypeScript نیز جای اعتبارسنجی دادهٔ runtime را نمی‌گیرد.

در [راهنمای رسمی NestJS 12](https://docs.nestjs.com/migration-guide)، حداقل ابزار CLI در خط Node 24
برابر 24.15 و حداقل اجرای Jest با بسته‌های ESM برابر 24.9 ذکر شده است. CommonJS با Jest همچنان پشتیبانی می‌شود؛
انتخاب این ترکیب از افزودن مهاجرت ESM و تغییر Runner هم‌زمان به این MVP جلوگیری می‌کند.
Node فعلی محیط 24.18.0 از این حداقل‌ها بالاتر است؛ سازگاری واقعی بسته‌های قفل‌شده هنوز اجرا نشده است.
[وضعیت خط‌های Node.js](https://nodejs.org/en/about/previous-releases) باید هنگام تثبیت وابستگی‌ها نیز بررسی شود.

xUnit، WebApplicationFactory، EF Core و ابزار user-jwts متعلق به گزینهٔ .NET هستند و در طراحی نهایی استفاده نمی‌شوند.
معادل آزمون، Jest و @nestjs/testing و Supertest و معادل ابزار توکن، CLI محلی توسعهٔ پروژه خواهد بود.
[آزمون رسمی NestJS](https://docs.nestjs.com/fundamentals/testing).

## ساختار و جداسازی مسئولیت‌ها

HTTP مسئول parsing، اعتبارسنجی قرارداد ورودی و نگاشت پاسخ است. Application عملیات و مجوز فعلی را هماهنگ
می‌کند و Domain قواعد مالکیت، Self-Approval، برگشت درخواست خود، وضعیت و متن را مستقل از Nest بررسی می‌کند.
Infrastructure تنها مسئول SQLite، تراکنش، نگاشت و ذخیره‌سازی است؛ Controller مستقیماً SQL اجرا نمی‌کند.

گزینهٔ Core در پروژهٔ مستقل، کنترل کامپایل بیشتری می‌داد ولی کاربر ساختار منطقی در یک برنامه را تأیید کرد.
Microservice، CQRS، Mediator، Generic Repository، Event Sourcing و صف به این نیاز کوچک اضافه نمی‌شوند.
Providerهای اختصاصی برای ذخیرهٔ درخواست و سیاست کاربر کافی‌اند؛ Abstraction عمومی ذخیره‌سازی ساخته نمی‌شود.

**ردیابی**: اصول ۱ و ۵؛ `FR-004` تا `FR-018`.

## گزینه‌های Persistence و تصمیم تطبیقی با NestJS

| گزینهٔ بررسی‌شده | مزیت | محدودیت و نتیجه |
| --- | --- | --- |
| better-sqlite3 مستقیم | مرز IMMEDIATE صریح و نگاشت محدود برای دو موجودیت اصلی | همگام و مسدودکنندهٔ کوتاه Event Loop؛ Mapping و Migration پروژه لازم است؛ انتخاب تأییدشده. |
| TypeORM با SQLite | Entity، Repository و Migration آماده؛ Integration شناخته‌شده در Nest | حالت SERIALIZABLE به‌تنهایی BEGIN IMMEDIATE را اثبات نمی‌کند؛ اتصال و تراکنش مشترک نیازمند هماهنگی بیشترند. |
| Prisma | Schema و Client تولیدی و Migration | ابزار و Adapter بیشتر؛ مزیت کافی بر مسیر محدود مستقیم برای این MVP نشان داده نشد. |
| PostgreSQL | Database مرکزی و قفل سطری برای چند نمونهٔ برنامه | سرویس و نگهداری بیشتر؛ با محدودهٔ محلی تأییدشده انتخاب نشد. |

Nest استفاده از Driver مستقیم از طریق Provider را مجاز می‌داند؛ ORM الزام Framework نیست.
[Database در Nest](https://docs.nestjs.com/techniques/database)،
[SQLite در TypeORM](https://typeorm.io/docs/drivers/sqlite/)،
[Prisma در Nest](https://docs.nestjs.com/data/prisma).

در source بررسی‌شدهٔ TypeORM، آغاز تراکنش بیرونی BEGIN TRANSACTION است و Driver مربوط به better-sqlite3
QueryRunner و اتصال مشترک نگه می‌دارد. احتمال درهم‌تنیدگی عملیات async استنتاج از source است، نه نتیجهٔ تست.
به این دلیل، استفادهٔ صرف از نام SERIALIZABLE یا ایجاد QueryRunner جدید را تضمین D-03 ندانستیم.
[QueryRunner نسخهٔ بررسی‌شده](https://raw.githubusercontent.com/typeorm/typeorm/1.0.0/src/driver/sqlite-abstract/AbstractSqliteQueryRunner.ts)،
[Driver نسخهٔ بررسی‌شده](https://raw.githubusercontent.com/typeorm/typeorm/1.0.0/src/driver/better-sqlite3/BetterSqlite3Driver.ts).

مستند better-sqlite3 تراکنش immediate را ارائه می‌کند و callback async را پشتیبانی نمی‌کند؛
callback باید تا پایان خواندن، بررسی، تغییر و Commit همگام بماند. Native Driver باید بعداً واقعاً در محیط هدف بارگذاری شود.
[API رسمی Driver](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)،
[Manifest رسمی](https://raw.githubusercontent.com/WiseLibs/better-sqlite3/master/package.json).

**ردیابی**: `FR-012`، `FR-014` تا `FR-016`، `FR-024`؛ `AC-501` تا `AC-508`.

## طرح نهایی تراکنش و لغو مجوز

۱. JWT بیرون از تراکنش اعتبارسنجی و هویت پایدار استخراج شود؛ شبکه یا await وارد callback Database نشود.
۲. تراکنش نوشتن .immediate پیش از خواندن مجوز و درخواست آغاز شود.
۳. مجوز جاری از users و درخواست و نسخه از change_requests در همان تراکنش خوانده شوند.
۴. قابلیت مشاهده، مجوز عملیات، مالکیت، وضعیت و نسخهٔ مشاهده‌شده بررسی و تغییر مشروط اجرا شود.
۵. Commit مرز نهایی‌شدن است؛ تغییر نقش نیز باید از همان مرز و همان Database عبور کند.

این طرح استنتاج از [قواعد تراکنش SQLite](https://www.sqlite.org/lang_transaction.html) و
[Isolation آن](https://www.sqlite.org/isolation.html) است: لغوِ زودتر Commit‌شده، در تصمیم بعدی دیده می‌شود؛
تصمیم معتبرِ زودتر Commit‌شده با لغو بعدی باطل نمی‌شود. قفل داخل Process به‌تنهایی این تضمین را نمی‌دهد.

محدودهٔ تضمین، مرجع محلی مجوز همین برنامه است؛ لغو مستقل در صادرکنندهٔ خارجی و Cache قدیمی بدون
پروتکل هماهنگی، مشمول ادعای اتمیک بالا نیست. مدیریت مجوز، Endpoint عمومی جدید ندارد.
SQLite برای یک میزبان محلی انتخاب شده است؛ توان بار عملیاتی نامعلوم یا چندمیزبانی ادعا نمی‌شود.

تراکنش‌ها کوتاه‌اند؛ timeout نویسنده در راهنمای محلی ۱۰۰۰ میلی‌ثانیه است. SQLITE_BUSY خطای اشغال
زیرساخت است و معادل stale version نیست. پس از timeout، پاسخ 503 عمومی و بدون تغییر جزئی داده می‌شود.
retry کاربردی خودکار برای تغییر داده یا نتیجهٔ نامعلوم Commit وجود ندارد؛ ایجاد مجدد معتبر می‌تواند رکورد مستقل بسازد.
حالت WAL پیش‌فرض طراحی نیست؛ در صورت افزودن بعدی، نسخهٔ Native SQLite و اصلاحات آن مطابق
[مستند WAL](https://www.sqlite.org/wal.html) بررسی می‌شوند.

## هویت محلی و مجوز فعلی

@nestjs/jwt برای توکن توسعه و Guard احراز هویت با بررسی امضا، الگوریتم HS256، issuer، audience، exp و sub
به‌کار می‌رود. JWT_SECRET محلی و خارج از مخزن است؛ issuer برابر changeflow-dev و audience برابر changeflow-api است.
نگاشت `(issuer, subject)` به user محلی پایدار است. نقش توکن یا Header انتخابی مشتری، مجوز فعلی نیست.
[بستهٔ رسمی JWT](https://github.com/nestjs/jwt)، [راهنمای JWT در Passport](https://docs.nestjs.com/recipes/passport).

این راهبرد فقط Development/Test تأیید شده است؛ Login، حساب، Refresh Token و مدیریت نقش عمومی ساخته نمی‌شوند.
ابزار توسعهٔ داخلی برای provision و تغییر نقش، همان هماهنگی تراکنشی برنامه را رعایت می‌کند.
آزمون JWT نامعتبر واقعی لازم است؛ جایگزینی هویت فقط در Unit جای اثبات Authentication را نمی‌گیرد.

**ردیابی**: `FR-001`، `FR-008`، `FR-009`، `FR-012`، `FR-019`، `FR-023`، `FR-024`.

## نسخهٔ مشاهده‌شده و قرارداد HTTP

نسخهٔ UUID در پاسخ مجاز به‌صورت ETag قوی ارائه و در If-Match دریافت می‌شود. نوشتن باید با نسخهٔ مشتری
مشروط شود؛ token صرفاً حاصل از خواندن تازهٔ سرور، قدیمی‌بودن payload مشتری را آشکار نمی‌کند.
پس از تغییر موفق، version همراه همان تغییر عوض می‌شود؛ در تعارض، Merge یا تازه‌کردن بی‌صدای نسخه انجام نمی‌شود.
[استاندارد If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match).

برای عملیات مجاز در وضعیت معتبر، نبود پیش‌شرط 428 و ناهماهنگی نسخه 412 است؛ Submit تکراری مالک در
PendingReview طبق مشخصات 409 وضعیت نامعتبر می‌گیرد. پاسخ منبع ناموجود و غیرقابل‌مشاهده همیشه 404 یکسان است؛
جزئیات وضعیت یا نسخهٔ تازه برای Reviewer که دیگر دسترسی ندارد افشا نمی‌شود.
Approve و RequestChanges موفق پاسخ 204 بدون محتوا یا ETag دارند تا محتوای اکنون غیرقابل‌مشاهده بازگردانده نشود.
[قرارداد کامل](contracts/http-api.md) و [OpenAPI](contracts/openapi.json) مرجع نگاشت‌اند.

**ردیابی**: `FR-013` تا `FR-019`، `FR-023`، `FR-027`؛ `AC-205`، `AC-312`، `AC-316`، `AC-501` تا `AC-508`.

## تقدم محرمانگی در NestJS

چرخهٔ رسمی Nest، Guard را پیش از Pipe اجرا می‌کند؛ بنابراین Guardهای اولیه هویت و visibility پیش از
خطای اختصاصی DTO قرار می‌گیرند. Application بررسی جاری را در تراکنش تکرار می‌کند.
ValidationPipe با whitelist تنها، فیلد غیرمجاز را حذف می‌کند؛ قرارداد ما رد صریح فیلد را لازم دارد.
[چرخهٔ درخواست](https://docs.nestjs.com/faq/request-lifecycle)،
[اعتبارسنجی Nest](https://docs.nestjs.com/techniques/validation).

parser خودکار JSON در Middleware می‌تواند پیش از Guard خطا بدهد. برای رعایت قرارداد سخت‌گیرانهٔ همین پروژه،
bootstrap باید بدنهٔ خام را با حد محدود دریافت کند و parsing JSON/خطای DTO را پس از هویت و visibility انجام دهد؛
فعال‌کردن خطای خودکار پیش از آن بدون حفظ تقدم مصوب مجاز نیست. این تنظیم در آزمون مسیر واقعی bootstrap بررسی می‌شود.
پاسخ خطای استاندارد Nest نباید بی‌تغییر برگردد؛ Filter مشترک دسته و پیام فارسی و محرمانگی را اعمال می‌کند.

## Unicode و اعتبارسنجی محتوایی

کاربر شمارش scalar را تأیید کرد. رشته باید well-formed باشد؛ trim پیش از شمارش انجام می‌شود و
iterator رشته در JavaScript scalarهای آن را می‌شمارد. String.length واحد UTF-16 است و TextEncoder بایت می‌سازد؛
هیچ‌کدام معیار طول قرارداد نیستند. نیم‌فاصله و متن حفظ می‌شوند؛ normalization یا جایگزینی خودکار انجام نمی‌شود.
[استاندارد iterator رشته](https://tc39.es/ecma262/multipage/text-processing.html#sec-string.prototype-%symbol.iterator%)،
[well-formed بودن رشته](https://tc39.es/ecma262/multipage/text-processing.html#sec-string.prototype.iswellformed).

ایموجی مرکب می‌تواند چند scalar باشد؛ سقف‌های مصوب تغییر نکرده‌اند. سه مقدار متن ساده‌اند و
نشانه‌های HTML/Markdown تفسیر نمی‌شوند. اعتبارسنجی scalar در Domain/Application نیز اجرا می‌شود.

**ردیابی**: `FR-022`، `FR-025`، `FR-026`؛ `AC-109` تا `AC-116`، `AC-405` تا `AC-407`.

## راهبرد آزمون و محدودیت شواهد

- Unit: قواعد مستقل از Nest و Database برای مالکیت، مجوز، وضعیت، Self-Approval و Unicode.
- HTTP: Nest TestingModule و Supertest با bootstrap واقعی، JWT معتبر/نامعتبر و پاسخ فارسی.
- Persistence: فایل SQLite موقت، Migration واقعی و Prepared SQL؛ Mock جای Database واقعی را نمی‌گیرد.
- Concurrency: worker/process و اتصال مستقل با Coordinator؛ Promise.all روی دو callback همگامِ یک Event Loop کافی نیست.
- آزمون هر دو ترتیب Commit در لغو/تصمیم و حفظ داده در Rollback؛ موفقیت ساختگی یا مبتنی بر sleep تصادفی گزارش نمی‌شود.
- پوشش ۲۷ نیازمندی و هر ۵۳ سناریوی مشخصات در [validation.md](validation.md) ردیابی می‌شود.

منابع راهبرد: [آزمون NestJS](https://docs.nestjs.com/fundamentals/testing)،
[Worker در Node.js](https://nodejs.org/docs/latest-v24.x/api/worker_threads.html).
نصب Driver، نسخهٔ Native SQLite، Build، تست و کارایی هنوز اجرا نشده‌اند؛ سازگاری منبع رسمی جای اجرای واقعی نیست.

## وضعیت خروجی

[plan.md](plan.md)، [data-model.md](data-model.md)، [contracts/http-api.md](contracts/http-api.md)،
[contracts/openapi.json](contracts/openapi.json)، [quickstart.md](quickstart.md) و [validation.md](validation.md)
خروجی طراحی این مرحله‌اند. هیچ کد برنامه، SQL Migration، package.json یا tasks.md تولید نشده است.
قانون اساسی و Specification تغییر نکرده‌اند. ورود به Tasks یا Implement در این درخواست انجام نمی‌شود.
