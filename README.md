# ChangeFlow

سامانهٔ مدیریت درخواست تغییر با HTTP API؛ نسخهٔ فعلی برای Development/Test روی یک میزبان محلی است. Frontend، Login، مدیریت عمومی نقش، حذف و لغو درخواست جزو این نسخه نیستند.

پشتهٔ مصوب: NestJS، TypeScript، SQLite و Driver مستقیم better-sqlite3. مالک درخواست را در Draft یا ChangesRequested اصلاح و ارسال می‌کند؛ Reviewer غیرمالک، PendingReview را تأیید یا برمی‌گرداند. تأیید یا برگشت درخواست خود حتی با دو نقش ممنوع و Approved تغییرناپذیر است. مجوز فعلی و نسخهٔ درخواست در تراکنش IMMEDIATE بررسی می‌شوند.

## شروع محلی

Node.js 24 با حداقل 24.15 و npm حداقل 11.16 لازم است. نسخه‌های آزموده‌شده و نتایج واقعی در [گزارش Build و آزمون](specs/001-change-request-management/evidence/build-and-tests.md) ثبت می‌شوند.

از ریشهٔ مخزن در PowerShell اجرا کنید:

```powershell
npm.cmd ci --no-audit --no-fund --foreground-scripts
npm.cmd run dev:init
npm.cmd run db:migrate
npm.cmd run dev:seed
npm.cmd run build
npm.cmd start
```

برنامه روی http://127.0.0.1:3000 اجرا می‌شود. dev:init کلید تصادفی را در .env محلی می‌نویسد و فایل موجود را بازنویسی نمی‌کند. تنظیمات محیط فرایند بر .env اولویت دارند. قبل از اجرا PORT و DATABASE_PATH را در فایل محلی تنظیم کنید؛ Database باید فایل دیسک محلی باشد. اجرای production با این تنظیمات پذیرفته نمی‌شود. بهتر است آزمون دستی از Database آزمایشی جداگانه استفاده کند.

تنظیم allowScripts بستهٔ better-sqlite3 برای استفاده از باینری همراه نسخهٔ قفل‌شده حفظ شده است؛ حذف آن ممکن است نصب را به ساخت Native و ابزارهای سیستم وابسته کند. npm قدیمی‌تر، نسخهٔ دیگر Node یا سیستم‌عامل دیگر باید جداگانه بررسی شود.

## کاربران و هویت

| subject | نقش اولیه |
| --- | --- |
| requester-a | Requester |
| reviewer-b | Reviewer |
| dual-c | Requester و Reviewer |
| reviewer-d | Reviewer |

dev:seed تکرارپذیر است و مجوز موجود یا درخواست‌ها را بازنشانی نمی‌کند. توکن فقط هویت را ثابت می‌کند؛ role claim منبع مجوز نیست. توکن کوتاه‌عمر است و پس از انقضا باید دوباره تولید شود.

```powershell
$requesterToken = (npm.cmd run --silent dev:token -- --subject requester-a).Trim()
$reviewerToken = (npm.cmd run --silent dev:token -- --subject reviewer-b).Trim()
npm.cmd run dev:permissions -- --subject reviewer-b --requester false --reviewer false
npm.cmd run dev:permissions -- --subject reviewer-b --requester false --reviewer true
```

توکن و محتوای .env نباید در Git یا گزارش مشترک درج شوند. ابزارهای بالا فقط CLI داخلی توسعه‌اند و Endpoint عمومی ندارند.

## عملیات API

تمام مسیرها به Authorization با Bearer نیاز دارند. در عملیات نوشتن روی درخواست موجود، ETag نمایش مشاهده‌شده باید عیناً در If-Match ارسال شود.

| عملیات | مسیر | نتیجهٔ موفق |
| --- | --- | --- |
| ایجاد | POST /api/change-requests | 201، نمایش، Location و ETag |
| مشاهده | GET /api/change-requests/{id} | 200، نمایش و ETag |
| اصلاح محتوای کامل | PUT /api/change-requests/{id} | 200، نمایش و ETag تازه |
| ارسال یا ارسال مجدد | POST /api/change-requests/{id}/submit | 204 |
| تأیید | POST /api/change-requests/{id}/approve | 204 |
| برگشت | POST /api/change-requests/{id}/request-changes | 204 |

ورودی محتوا فقط شامل title، description و reason متنی است؛ عنوان ۱ تا ۲۰۰، شرح ۱ تا ۵۰۰۰ و دلیل ۱ تا ۲۰۰۰ Unicode scalar پس از trim. فیلد اضافه، حتی requesterId یا status صحیح، باعث رد کل ورودی می‌شود. انتقال‌ها بدنه ندارند یا {} دریافت می‌کنند. پاسخ 204 بدنه یا ETag ندارد؛ برای نسخهٔ تازه باید GET مجاز انجام شود. Reviewer پس از تصمیم دیگر درخواست دیگران را نمی‌بیند.

## خطاها و آزمون‌ها

| وضعیت | معنی |
| --- | --- |
| 400 | ورودی یا قالب If-Match نامعتبر؛ خطای فیلد فارسی |
| 401 | هویت نامعتبر یا منقضی |
| 403 | مجوز ناکافی روی منبع قابل مشاهده یا ممنوعیت تصمیم روی درخواست خود |
| 404 | منبع ناموجود، نامعتبر یا خارج از دسترسی؛ پاسخ یکسان |
| 409 | وضعیت فعلی عملیات را مجاز نمی‌کند |
| 412 | نسخهٔ مشاهده‌شده قدیمی است؛ دریافت تازه و تصمیم صریح لازم است |
| 413 | بدنه بیش از ۱۳۱۰۷۲ بایت است؛ پیش از بررسی هویت/منبع رد می‌شود |
| 428 | If-Match ارسال نشده است |
| 500 یا 503 | خطای فنی یا اشغال Database؛ موفقیت فرض نشود |

```powershell
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:concurrency
npm.cmd run test:contract
```

در خطای Migration، فایل یا checksum موجود نباید دستکاری یا Database خودکار reset شود؛ علت باید بررسی شود. در خطای قفل، وجود writer دیگر و پایان تراکنش آن بررسی شود؛ retry کور برای نوشتن انجام نشود. در خطای هویت، انقضا و تنظیمات issuer/audience بررسی شوند؛ کلید چاپ نشود.

[راهنمای عملی API و پذیرش](specs/001-change-request-management/quickstart.md)، [قرارداد فارسی](specs/001-change-request-management/contracts/http-api.md) و [OpenAPI](specs/001-change-request-management/contracts/openapi.json) جزئیات بیشتری دارند. وضعیت پذیرش نهایی و موارد باز در [گزارش پذیرش](specs/001-change-request-management/evidence/acceptance.md) ثبت می‌شوند.
