# ماتریس شواهد اعتبارسنجی ChangeFlow

**تاریخ**: 2026-11-17 | **مبنا**: [spec.md](spec.md) | **وضعیت**: شواهد جاری برای ارزیابی T063؛ نهایی‌سازی T064 منتظر پذیرش انسانی است.

این سند از برنامهٔ آینده به شواهد اجرای واقعی به‌روز شده است. ۵۳۵ آزمون نهایی موفق‌اند؛ ۲۷ FR و هر ۵۳ AC مرجع آزمون موفق دارند. شناسه‌ها از Specification و نام آزمون‌ها از JSON اجرای نهایی استخراج شدند؛ ردیف‌ها با گزارش‌های US1 تا US5 و بررسی‌های معماری، امنیت و قرارداد تطبیق داده شدند. وجود یک شناسه در نام آزمون به‌تنهایی جای بررسی رفتار را نمی‌گیرد.

نتیجهٔ فنی در دامنهٔ نمونه‌های مصوب مثبت است، اما SC-007 مشاهدهٔ انسانی ندارد و بنا به پاسخ صریح کاربر باز می‌ماند. این سند اعلام پذیرش نهایی یا تکمیل T064 نیست؛ پس از بستن T063 باید دروازهٔ نهایی دوباره بررسی شود.

## نیازمندی‌ها و شواهد جاری

| نیازمندی | ACهای مصوب | سطح/شاهد | وضعیت |
| --- | --- | --- | --- |
| FR-001 | AC-101، AC-104 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) | موفق خودکار |
| FR-002 | AC-101 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) | موفق خودکار |
| FR-003 | AC-101، AC-105 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) | موفق خودکار |
| FR-004 | AC-102، AC-103، AC-401، AC-403 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts) | موفق خودکار |
| FR-005 | AC-201، AC-202، AC-204 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts) | موفق خودکار |
| FR-006 | AC-203، AC-503 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts) / [content-races.spec.ts](../../test/integration/concurrency/content-races.spec.ts) | موفق خودکار |
| FR-007 | AC-301، AC-304، AC-305 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) | موفق خودکار |
| FR-008 | AC-302، AC-304، AC-305، AC-311 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) | موفق خودکار |
| FR-009 | AC-303 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) | موفق خودکار |
| FR-010 | AC-402، AC-403، AC-404 | [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts) | موفق خودکار |
| FR-011 | AC-203، AC-307 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts) / [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) | موفق خودکار |
| FR-012 | AC-204، AC-304، AC-305، AC-306، AC-506، AC-507 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts) / [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) / [permission-races.spec.ts](../../test/integration/concurrency/permission-races.spec.ts) | موفق خودکار |
| FR-013 | AC-205، AC-305، AC-307، AC-312 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts) / [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) | موفق خودکار |
| FR-014 | AC-501، AC-504 | [content-races.spec.ts](../../test/integration/concurrency/content-races.spec.ts) | موفق خودکار |
| FR-015 | AC-502، AC-503 | [decision-races.spec.ts](../../test/integration/concurrency/decision-races.spec.ts) / [content-races.spec.ts](../../test/integration/concurrency/content-races.spec.ts) | موفق خودکار |
| FR-016 | AC-103، AC-202، AC-304، AC-505 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts) / [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) / [rollback-and-busy.spec.ts](../../test/integration/concurrency/rollback-and-busy.spec.ts) | موفق خودکار |
| FR-017 | AC-115، AC-116، AC-304، AC-314، AC-315، AC-316، AC-501، AC-502، AC-505، AC-508 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) / [content-races.spec.ts](../../test/integration/concurrency/content-races.spec.ts) / [decision-races.spec.ts](../../test/integration/concurrency/decision-races.spec.ts) / [rollback-and-busy.spec.ts](../../test/integration/concurrency/rollback-and-busy.spec.ts) | موفق خودکار؛ SC-007 باز |
| FR-018 | AC-102، AC-201، AC-301، AC-302، AC-401، AC-402 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts) / [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) / [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts) | موفق خودکار |
| FR-019 | AC-106، AC-308، AC-309، AC-310، AC-313 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) | موفق خودکار |
| FR-020 | AC-107، AC-205، AC-312، AC-501 تا AC-505 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts) / [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) / [content-races.spec.ts](../../test/integration/concurrency/content-races.spec.ts) / [rollback-and-busy.spec.ts](../../test/integration/concurrency/rollback-and-busy.spec.ts) / [decision-races.spec.ts](../../test/integration/concurrency/decision-races.spec.ts) | موفق خودکار |
| FR-021 | AC-108، AC-206 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts) | موفق خودکار |
| FR-022 | AC-101، AC-109، AC-110، AC-111، AC-112، AC-405 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts) | موفق خودکار |
| FR-023 | AC-309، AC-310، AC-313، AC-316 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) | موفق خودکار |
| FR-024 | AC-306، AC-506، AC-507 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) / [permission-races.spec.ts](../../test/integration/concurrency/permission-races.spec.ts) | موفق خودکار |
| FR-025 | AC-101، AC-105، AC-113، AC-406 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts) | موفق خودکار |
| FR-026 | AC-114، AC-407 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts) | موفق خودکار |
| FR-027 | AC-115، AC-116، AC-314، AC-315، AC-316، AC-508 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts) / [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts) / [rollback-and-busy.spec.ts](../../test/integration/concurrency/rollback-and-busy.spec.ts) | موفق خودکار |

## سناریوها و آزمون موفق واقعی

برای هر AC یک آزمون نماینده از خروجی نهایی درج شده است؛ فهرست تمام آزمون‌های دارای آن شناسه در [نگاشت ماشینی](../../test-results/us8/traceability.json) محلی موجود است. نتیجه‌های مربوط به یک قاعده در سناریوهای مرتبط دیگر نیز بررسی شده‌اند. بازه‌های «تا» در نام آزمون فقط برای شناسه‌های موجود گسترش یافته‌اند.

| سناریو | آزمون نمایندهٔ اجراشده | نتیجه |
| --- | --- | --- |
| AC-101 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-101، AC-102 و AC-112؛ ایجاد Draft، trim و ویرایش فقط محتوا با هویت واقعی | موفق؛ 4 آزمون |
| AC-102 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-101، AC-102 و AC-112؛ ایجاد Draft، trim و ویرایش فقط محتوا با هویت واقعی | موفق؛ 2 آزمون |
| AC-103 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-103؛ غیرمالک reviewer-b هیچ داده‌ای را تغییر نمی‌دهد | موفق؛ 3 آزمون |
| AC-104 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-104 و AC-116؛ هویت نامعتبر و مجوز ناکافی هیچ ایجاد ندارند | موفق؛ 6 آزمون |
| AC-105 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-105 و AC-113؛ ورودی محافظت‌شده {"requesterId": "forged"} رد کامل می‌شود | موفق؛ 11 آزمون |
| AC-106 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-106؛ مالک Draft را مشاهده می‌کند | موفق؛ 20 آزمون |
| AC-107 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-107؛ دو ایجاد تکراری مستقل هستند | موفق؛ 2 آزمون |
| AC-108 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-108؛ DELETE و PATCH وجود ندارند | موفق؛ 2 آزمون |
| AC-109 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-109 تا AC-112؛ مرز و trim فیلد title | موفق؛ 9 آزمون |
| AC-110 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-109 تا AC-112؛ مرز و trim فیلد title | موفق؛ 27 آزمون |
| AC-111 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-109 تا AC-112؛ مرز و trim فیلد title | موفق؛ 6 آزمون |
| AC-112 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-101، AC-102 و AC-112؛ ایجاد Draft، trim و ویرایش فقط محتوا با هویت واقعی | موفق؛ 17 آزمون |
| AC-113 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-105 و AC-113؛ ورودی محافظت‌شده {"requesterId": "forged"} رد کامل می‌شود | موفق؛ 11 آزمون |
| AC-114 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-114؛ متن ساده حفظ و از GET بازگردانده می‌شود | موفق؛ 3 آزمون |
| AC-115 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-115؛ ویرایش نامعتبر پاسخ فارسی با نام فیلد دارد و هیچ تغییر جزئی ندارد | موفق؛ 23 آزمون |
| AC-116 | [us1-http.spec.ts](../../test/integration/us1-http.spec.ts)؛ US1؛ پذیرش HTTP با بررسی Database AC-104 و AC-116؛ هویت نامعتبر و مجوز ناکافی هیچ ایجاد ندارند | موفق؛ 7 آزمون |
| AC-201 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts)؛ US2؛ HTTP و قرارداد Submit با Database واقعی AC-201؛ بدنهٔ absent، پاسخ 204 بدون Body/ETag و انتقال فقط status/version | موفق؛ 4 آزمون |
| AC-202 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts)؛ US2؛ HTTP و قرارداد Submit با Database واقعی AC-202؛ غیرمالک reviewer-b بدون تغییر رد می‌شود | موفق؛ 4 آزمون |
| AC-203 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts)؛ US2؛ HTTP و قرارداد Submit با Database واقعی AC-203؛ ویرایش PendingReview همچنان ممنوع است | موفق؛ 4 آزمون |
| AC-204 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts)؛ US2؛ HTTP و قرارداد Submit با Database واقعی AC-204؛ هویت نامعتبر، نقش لغوشده و نگاشت ناموجود تغییری نمی‌دهند | موفق؛ 3 آزمون |
| AC-205 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts)؛ US2؛ HTTP و قرارداد Submit با Database واقعی AC-205؛ Submit تکراری با نسخهٔ قدیمی یا بدنهٔ نامعتبر 409 است | موفق؛ 3 آزمون |
| AC-206 | [us2-submit-http.spec.ts](../../test/integration/us2-submit-http.spec.ts)؛ US2؛ HTTP و قرارداد Submit با Database واقعی AC-206؛ عملیات لغو برای مالک یا Reviewer وجود ندارد | موفق؛ 2 آزمون |
| AC-301 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-301 و AC-302؛ موفقیت با بدنهٔ absent پاسخ 204 بدون داده می‌دهد | موفق؛ 6 آزمون |
| AC-302 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-301 و AC-302؛ موفقیت با بدنهٔ absent پاسخ 204 بدون داده می‌دهد | موفق؛ 6 آزمون |
| AC-303 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-303، AC-311 و AC-314؛ تصمیم روی درخواست خود حتی با دو نقش 403 صریح است | موفق؛ 6 آزمون |
| AC-304 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-304 و AC-306؛ هویت نامعتبر، نگاشت ناموجود و نقش لغوشده اثری ندارند | موفق؛ 4 آزمون |
| AC-305 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-305؛ وضعیت Draft برای Reviewer خارج از دید است | موفق؛ 12 آزمون |
| AC-306 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-304 و AC-306؛ هویت نامعتبر، نگاشت ناموجود و نقش لغوشده اثری ندارند | موفق؛ 10 آزمون |
| AC-307 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database AC-307 و AC-315؛ Approved هیچ ویرایش یا انتقال خروجی ندارد | موفق؛ 7 آزمون |
| AC-308 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database AC-308 تا AC-310؛ مشاهدهٔ Reviewer و دو نقش از سیاست جاری پیروی می‌کند | موفق؛ 17 آزمون |
| AC-309 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-309 و AC-312؛ تکرار تصمیم پس از ازدست‌رفتن visibility یک 404 عمومی است | موفق؛ 13 آزمون |
| AC-310 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database AC-308 تا AC-310؛ مشاهدهٔ Reviewer و دو نقش از سیاست جاری پیروی می‌کند | موفق؛ 17 آزمون |
| AC-311 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-303، AC-311 و AC-314؛ تصمیم روی درخواست خود حتی با دو نقش 403 صریح است | موفق؛ 6 آزمون |
| AC-312 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-309 و AC-312؛ تکرار تصمیم پس از ازدست‌رفتن visibility یک 404 عمومی است | موفق؛ 6 آزمون |
| AC-313 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database AC-313 و AC-316؛ منبع پنهان و ناموجود در تصمیم پاسخ یکسان دارند | موفق؛ 14 آزمون |
| AC-314 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database approve AC-303، AC-311 و AC-314؛ تصمیم روی درخواست خود حتی با دو نقش 403 صریح است | موفق؛ 4 آزمون |
| AC-315 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database AC-307 و AC-315؛ Approved هیچ ویرایش یا انتقال خروجی ندارد | موفق؛ 1 آزمون |
| AC-316 | [us3-review-http.spec.ts](../../test/integration/us3-review-http.spec.ts)؛ US3؛ تصمیم HTTP و پذیرش با بررسی واقعی Database AC-313 و AC-316؛ منبع پنهان و ناموجود در تصمیم پاسخ یکسان دارند | موفق؛ 16 آزمون |
| AC-401 | [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts)؛ US4؛ پذیرش اصلاح و ارسال مجدد از HTTP و Database واقعی AC-401 و AC-402؛ مالک requester-a درخواست برگشت‌خوردهٔ آماده را اصلاح و ارسال می‌کند | موفق؛ 4 آزمون |
| AC-402 | [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts)؛ US4؛ پذیرش اصلاح و ارسال مجدد از HTTP و Database واقعی AC-401 و AC-402؛ مالک requester-a درخواست برگشت‌خوردهٔ آماده را اصلاح و ارسال می‌کند | موفق؛ 8 آزمون |
| AC-403 | [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts)؛ US4؛ پذیرش اصلاح و ارسال مجدد از HTTP و Database واقعی edit AC-403؛ غیرمالک reviewer-b و شناسهٔ ناموجود پاسخ عمومی یکسان دارند | موفق؛ 8 آزمون |
| AC-404 | [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts)؛ US4؛ پذیرش اصلاح و ارسال مجدد از HTTP و Database واقعی AC-404؛ چرخهٔ برگشت، اصلاح، ارسال و بررسی دوباره با approve | موفق؛ 2 آزمون |
| AC-405 | [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts)؛ US4؛ پذیرش اصلاح و ارسال مجدد از HTTP و Database واقعی AC-405 و AC-407؛ title در حد 1 scalar با trim ذخیره می‌شود | موفق؛ 78 آزمون |
| AC-406 | [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts)؛ US4؛ پذیرش اصلاح و ارسال مجدد از HTTP و Database واقعی AC-406؛ requesterId با مقدار same رد کامل دارد | موفق؛ 25 آزمون |
| AC-407 | [us4-revision-http.spec.ts](../../test/integration/us4-revision-http.spec.ts)؛ US4؛ پذیرش اصلاح و ارسال مجدد از HTTP و Database واقعی AC-405 و AC-407؛ title در حد 1 scalar با trim ذخیره می‌شود | موفق؛ 14 آزمون |
| AC-501 | [content-races.spec.ts](../../test/integration/concurrency/content-races.spec.ts)؛ US5؛ رقابت محتوا با اتصال مستقل AC-501، AC-504 و AC-505؛ دو ویرایش Draft فقط یک نسخه را می‌پذیرند | موفق؛ 3 آزمون |
| AC-502 | [decision-races.spec.ts](../../test/integration/concurrency/decision-races.spec.ts)؛ US5؛ تصمیم‌های متناقض با دو Reviewer AC-502 و AC-505؛ نخستین تصمیم approve تنها انتقال نهایی است | موفق؛ 2 آزمون |
| AC-503 | [content-races.spec.ts](../../test/integration/concurrency/content-races.spec.ts)؛ US5؛ رقابت محتوا با اتصال مستقل AC-503 و AC-505؛ رقابت ویرایش و Submit با برندهٔ submit | موفق؛ 2 آزمون |
| AC-504 | [content-races.spec.ts](../../test/integration/concurrency/content-races.spec.ts)؛ US5؛ رقابت محتوا با اتصال مستقل AC-501، AC-504 و AC-505؛ دو ویرایش Draft فقط یک نسخه را می‌پذیرند | موفق؛ 2 آزمون |
| AC-505 | [rollback-and-busy.spec.ts](../../test/integration/concurrency/rollback-and-busy.spec.ts)؛ US5؛ Rollback و قفل واقعی SQLite AC-505؛ شکست پس از نوشتن edit پیش از Commit همهٔ تغییر را برمی‌گرداند | موفق؛ 11 آزمون |
| AC-506 | [permission-races.spec.ts](../../test/integration/concurrency/permission-races.spec.ts)؛ US5؛ ترتیب نهایی‌شدن لغو مجوز و تصمیم AC-306، AC-506 و AC-507؛ approve با برندهٔ revoke | موفق؛ 4 آزمون |
| AC-507 | [permission-races.spec.ts](../../test/integration/concurrency/permission-races.spec.ts)؛ US5؛ ترتیب نهایی‌شدن لغو مجوز و تصمیم AC-306، AC-506 و AC-507؛ approve با برندهٔ revoke | موفق؛ 4 آزمون |
| AC-508 | [rollback-and-busy.spec.ts](../../test/integration/concurrency/rollback-and-busy.spec.ts)؛ US5؛ Rollback و قفل واقعی SQLite AC-505 و AC-508؛ قفل مستقل پس از مهلت مصوب 503 دارد، نه 412 یا موفقیت | موفق؛ 3 آزمون |

## معیارهای موفقیت

| معیار | وضعیت | شاهد |
| --- | --- | --- |
| SC-001 | موفق خودکار | [SC-001](evidence/acceptance.md) |
| SC-002 | موفق خودکار | [SC-002](evidence/acceptance.md) |
| SC-003 | موفق خودکار | [SC-003](evidence/acceptance.md) |
| SC-004 | موفق خودکار | [SC-004](evidence/acceptance.md) |
| SC-005 | موفق خودکار | [SC-005](evidence/acceptance.md) |
| SC-006 | موفق خودکار | [SC-006](evidence/acceptance.md) |
| SC-007 | باز | [SC-007](evidence/acceptance.md) |
| SC-008 | موفق خودکار | [SC-008](evidence/acceptance.md) |
| SC-009 | موفق خودکار | [SC-009](evidence/acceptance.md) |
| SC-010 | موفق خودکار | [SC-010](evidence/acceptance.md) |
| SC-011 | موفق خودکار | [SC-011](evidence/acceptance.md) |
| SC-012 | موفق خودکار | [SC-012](evidence/acceptance.md) |
| SC-013 | موفق خودکار | [SC-013](evidence/acceptance.md) |
| SC-014 | موفق خودکار | [SC-014](evidence/acceptance.md) |
| SC-015 | موفق خودکار | [SC-015](evidence/acceptance.md) |

در [گزارش پذیرش](evidence/acceptance.md) دامنهٔ بررسی هر SC و شرایط باقی‌ماندهٔ مشاهدهٔ انسانی آمده است. کاربر در 2026-11-17 اعلام کرد مشاهده هنوز انجام نشده و SC-007 باز بماند؛ تأییدهای قبلی فازها جای این شاهد نیستند.

## منابع اجرا و حدود نتیجه

- [نصب، Build و آزمون](evidence/build-and-tests.md): نصب قفل‌شده، اجرای واقعی quickstart، ۲۳۴ Unit، ۲۵۲ Integration، ۲۱ Contract و ۲۸ Concurrency؛ صفر ناموفق یا انتخاب‌نشده.
- [معماری](evidence/architecture.md) و [امنیت](evidence/security.md): مرز مسئولیت‌ها، فراخوانی مستقیم Application، JWT، مجوز جاری، Self-Approval، عدم provision خودکار و محرمانگی.
- [US1](evidence/us1.md)، [US2](evidence/us2.md)، [US3](evidence/us3.md)، [US4](evidence/us4.md) و [US5](evidence/us5.md): شواهد تفصیلی قواعد محصول و Database؛ [بازبینی Concurrency](evidence/concurrency-review.md) ترتیب‌های انتخاب‌شده و محدودیت آن‌ها را توضیح می‌دهد.
- قرارداد OpenAPI با Ajv 2020 و پاسخ‌های واقعی مقایسه شد؛ ورودی خامِ دارای فاصله در حداکثر، Unicode escape، شش عملیات، خطاها و سقف فنی بدنه بررسی شدند.

خروجی JSON و Database آزمایشی محلی خارج از Git هستند و در checkout تازه باید بازتولید شوند. کارایی، هویت production، همهٔ زمان‌بندی‌های ممکن و ممیزی جامع وابستگی‌ها تأیید نشده‌اند. هیچ مورد بررسی‌نشده‌ای موفق گزارش نشده است. T063 و T064 تا فراهم‌شدن شاهد انسانی و نهایی‌سازی پس از آن باز هستند.
