# نصب، Build و آزمون نهایی ـ T062

**تاریخ**: 2026-11-17، به وقت تهران | **محیط واقعی**: Windows، Node.js v24.18.0، npm 11.16.0، SQLite 3.54.1، better-sqlite3 13.2.0، NestJS 12.5.0، TypeScript 6.0.3 و Ajv 8.20.0.

## فرمان‌ها و نتیجه

| فرمان | خروج | نتیجهٔ واقعی |
| --- | --- | --- |
| npm.cmd install --save-dev --save-exact --package-lock-only --offline --ignore-scripts --no-audit --no-fund ajv@8.20.0 | ۱ | ENOTCACHED؛ metadata لازم در cache نبود و ثبت وابستگی کامل نشد. |
| همان فرمان ثبت Ajv بدون --offline | ۰ | نسخهٔ نصب‌شده به devDependencies مستقیم افزوده شد؛ نسخهٔ Runtime عوض نشد. |
| npm.cmd ci --no-audit --no-fund --foreground-scripts | ۰ | نصب قفل‌شدهٔ واقعی ۵۰۳ بسته در ۳۴ ثانیه؛ باینری Native با آزمون‌های بعدی بارگذاری شد. |
| npm.cmd run build | ۰ | dist/main.js از کد فعلی ساخته شد. |
| npm.cmd run typecheck | ۰ | src، tools و test بررسی شدند. |
| npm.cmd run test:unit -- --json --outputFile=test-results/us8/unit.json | ۰ | ۷ مجموعه، ۲۳۴ موفق، صفر ناموفق و صفر انتخاب‌نشده. |
| npm.cmd run test:integration -- --json --outputFile=test-results/us8/integration.json | ۰ | ۱۳ مجموعه، ۲۵۲ موفق، صفر ناموفق و صفر انتخاب‌نشده. |
| npm.cmd run test:concurrency -- --json --outputFile=test-results/us8/concurrency.json | ۰ | ۵ مجموعه، ۲۸ موفق، صفر ناموفق و صفر انتخاب‌نشده. |
| npm.cmd run test:contract -- --json --outputFile=test-results/us8/contract.json | ۰ | ۲ مجموعه، ۲۱ موفق، صفر ناموفق و صفر انتخاب‌نشده. |

جمع نهایی **۵۳۵ آزمون موفق** است؛ ۴۲ آزمون جدید این فاز شامل ۱۶ معماری، ۱۱ امنیت و ۱۵ OpenAPI هستند. نام فایل openapi-contract.spec.ts آن را در مجموعهٔ Contract قرار می‌دهد؛ اجرای هدفمند اولیه با تنظیم Integration آن را انتخاب نکرد، سپس با فرمان test:contract اجرا شد. عدم انتخاب به‌عنوان موفقیت آن فایل گزارش نشده است.

| گزارش | شروع UTC در 2026-11-16 | پایان UTC |
| --- | --- | --- |
| [Unit](../../../test-results/us8/unit.json) | 21:28:28.765 | 21:28:36.854 |
| [Integration](../../../test-results/us8/integration.json) | 21:28:33.439 | 21:29:26.416 |
| [Contract](../../../test-results/us8/contract.json) | 21:28:38.554 | 21:28:43.318 |
| [Concurrency](../../../test-results/us8/concurrency.json) | 21:29:28.902 | 21:29:41.368 |

این زمان‌ها در تهران بامداد 2026-11-17 هستند. هر چهار گزارش success برابر true دارند. خروجی‌ها محلی و خارج از Git هستند و در checkout تازه باید بازتولید شوند.

[رد رقابت همین اجرای نهایی](../../../test-results/us8/races.jsonl) شامل ۱۹ رکورد از بازهٔ زمانی Suite نهایی است؛ از خروجی harness براساس زمان اجرای واقعی جدا شده و با اجراهای تاریخی مخلوط نشده است.

## اجرای راهنمای واقعی

اسکریپت محلی .local/phase8-quickstart.ps1، تنظیمات تصادفی و Database مستقل ایجاد کرد؛ با متغیرهای محیطی همان فرمان‌های dev:init، db:migrate و dev:seed را اجرا کرد، برنامهٔ Buildشده را روی پورت آزاد localhost بالا آورد و دو بلوک نخست quickstart.md را عیناً با جایگزینی پورت اجرا کرد. توکن‌ها در حافظه گرفته شدند و چاپ نشدند. Migration دوباره اجرا شد و سرور موقت در پایان متوقف شد.

چرخهٔ واقعی ایجاد Draft، اصلاح، Submit، RequestChanges، اصلاح ChangesRequested، GET نسخهٔ تازه، Submit مجدد و Approve با همان شناسه و مالک تا Approved موفق بود. [خروجی راهنما](../../../test-results/us8/quickstart.json) فرمان‌ها و نمایش نهایی را ثبت می‌کند؛ زمان پایان 2026-11-16T21:29:23.9186356Z و humanObserved برابر false است. این اجرا شاهد فنی است و مشاهدهٔ نمایندهٔ انسانی نیست.

اجرای نخست اسکریپت محلی پیش از انجام عملیات، به علت خواندن UTF-8 بدون BOM توسط Windows PowerShell خطای parsing داشت؛ Encoding فایل محلی اصلاح و اجرای بعدی واقعاً موفق شد. این خطا در محصول یا راهنمای UTF-8 Markdown نبود. سرور یا Database اصلی کاربر برای چرخهٔ آزمون استفاده نشد.

## محدودیت‌ها و تمامیت شواهد

- نصب دربارهٔ glob@10.5.0 غیرمستقیم هشدار منسوخ‌بودن داد؛ ممیزی کامل آسیب‌پذیری و رفع هشدار انجام نشده است. هشدار آزمایشی VM Modules نیز باقی است.
- نصب و اجرای نیازمند subprocess، worker یا دریافت metadata با دسترسی لازم محیط انجام شد؛ نتیجهٔ مسدود یا ناموفق موفق گزارش نشده است.
- SHA-256 فایل package-lock.json پس از افزودن مستقیم Ajv برابر 6809ffe3837ff391e3e4d76932a07d886b5f7ab0fb1ea62db7ef7c493b1025ed است. تغییر lockfile فقط ثبت وابستگی آزمون موجود است.
- کد محصول، Migration و تصمیم‌های محصول یا معماری تغییر نکردند. موفقیت این مجموعه‌ها به‌تنهایی پذیرش انسانی SC-007 یا پذیرش نهایی MVP نیست.
