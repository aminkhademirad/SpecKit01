# گزارش اجرای فاز هفتم ـ حفظ نتیجهٔ معتبر هنگام تعارض

**تاریخ گزارش**: 2026-11-17، به وقت تهران

**محدودهٔ مجاز**: فقط T050 تا T057، داستان US5. کاربر فاز ششم را تأیید کرد. در شروع، مخزن تغییر ثبت‌نشده نداشت؛ T001 تا T049 تکمیل و چک‌لیست requirements.md دارای ۱۶ مورد تأییدشده و صفر مورد باز بود. پیش‌نیازها قابلیت 001-change-request-management را مشخص کردند و چک‌لیست تغییر نکرد.

## ترتیب Taskها و فایل‌ها

| Task | پیش‌نیاز مستقیم | خروجی |
| --- | --- | --- |
| T050 | T049 | test/fixtures/concurrency-worker.ts و test/fixtures/concurrency-coordinator.ts؛ اتصال‌های مستقل، گیت‌های صریح، پاک‌سازی worker و ثبت نتیجه |
| T051 | T050 | test/integration/concurrency/content-races.spec.ts؛ ۴ آزمون رقابت ویرایش و Submit |
| T052 | T050 | test/integration/concurrency/decision-races.spec.ts؛ ۲ آزمون دو تصمیم متناقض |
| T053 | T050 | test/integration/concurrency/permission-races.spec.ts؛ ۴ آزمون ترتیب لغو مجوز و دو تصمیم |
| T054 | T050 | test/integration/concurrency/rollback-and-busy.spec.ts؛ ۴ آزمون Rollback و یک آزمون قفل واقعی و HTTP 503 |
| T055 | T050 | test/integration/concurrency/version-and-errors.spec.ts؛ ۱۳ آزمون نسخه، خطا، محرمانگی و تغییر بین Guard و Application |
| T056 | T051 تا T055 | [بازبینی Concurrency](concurrency-review.md)؛ کد محصول به اصلاح نیاز نداشت |
| T057 | T056 | اجرای واقعی Suiteها، بررسی شواهد و همین گزارش |

Taskهای [P] پس از آماده‌شدن harness در فایل‌های مستقل نوشته شدند؛ نیازی به عامل موازی نبود. هر worker همان Application و Store محصول را روی فایل موقت مشترکِ آماده‌شده با Migration واقعی اجرا می‌کند. Coordinator شروع، اخذ قفل و ادامه پیش از Commit را با پیام و SharedArrayBuffer کنترل می‌کند؛ sleep تصادفی یا فرض رقابت براساس Promiseها وجود ندارد.

## نتیجهٔ هشت معیار پذیرش

| سناریو | ترتیب کنترل‌شده و نتیجهٔ واقعی |
| --- | --- |
| AC-501 | دو worker نسخهٔ مشترک Draft را مشاهده کردند؛ ویرایش اول پیش از Commit متوقف، رقیب آغاز و سپس اولی آزاد شد. اولی OK، دومی CONCURRENCY_CONFLICT؛ فقط محتوای اول و version تازه ماند. |
| AC-502 | هر یک از Approve و RequestChanges یک بار برنده تعیین شد؛ Reviewer دوم اقدام متناقض داشت. فقط انتقال نخست Commit شد؛ رقیب REQUEST_UNAVAILABLE گرفت، زیرا دیگر حق مشاهده نداشت. پاسخ عمومی این حالت در آزمون‌های HTTP برابر 404 منبع ناموجود بود. |
| AC-503 | با برنده‌شدن Submit، ویرایش قدیمی INVALID_STATE گرفت و محتوای قبلی در PendingReview ماند. با برنده‌شدن ویرایش، Submit قدیمی CONCURRENCY_CONFLICT گرفت و محتوای تازه در Draft ماند. |
| AC-504 | دو ویرایش ChangesRequested از نسخهٔ مشترک اجرا شدند؛ فقط ویرایش نخست ماند، status همان ChangesRequested و نسخه تازه بود. |
| AC-505 | همهٔ اقدامات رقیب ردشده دادهٔ برنده را حفظ کردند. خطای تزریق‌شده پس از نوشتن واقعی در هر چهار کاربرد نیز تمام تغییر را Rollback کرد؛ نسخهٔ قبلی باقی ماند و پیام committed صادر نشد. |
| AC-506 | لغو مجوز پیش از Commit متوقف شد، اقدام تصمیم آغاز شد و سپس لغو آزاد شد؛ هر دو نوع تصمیم پس از Commit لغو رد شدند. درخواست و نسخهٔ قبلی ثابت و نقش Reviewer غیرفعال بود. |
| AC-507 | تصمیم معتبر پیش از Commit متوقف شد، لغو آغاز و سپس تصمیم آزاد شد؛ هر دو عملیات موفق شدند. Approved یا ChangesRequested معتبر و version تازه حفظ شدند و نقش Reviewer در پایان غیرفعال بود. |
| AC-508 | پس از Commit ویرایش مستقل، HTTP با نسخهٔ قدیمی در Draft و ChangesRequested پاسخ 412 با دستهٔ «تعارض هم‌زمان» و پیام فارسی داد؛ دادهٔ تازه حفظ و نسخهٔ تازه افشا نشد. |

قفل واقعی به‌صورت جداگانه بررسی شد: worker اول قفل IMMEDIATE را نگه داشت و worker دوم نتوانست قفل بگیرد. مقدار busy_timeout هر دو اتصال ۱۰۰۰ میلی‌ثانیه بود؛ تلاش دوم پس از ۱۱۵۹ میلی‌ثانیه SERVICE_UNAVAILABLE گرفت. HTTP روی همان Database قفل‌شده نیز 503 فنی داد، بدون ETag یا تغییر داده؛ اشغال Database به stale version تعبیر نشد. پس از آزادشدن گیت، holder بدون تغییر درخواست Commit کرد.

آزمون‌های T055 شامل نبود If-Match با 428، قالب ضعیف/چندمقداری/wildcard/نامعتبر با 400، Submit تکراری مالک با 409 و مقایسهٔ منبع پنهان/ناموجود در پنج عملیات و سه حالت Header بودند. همچنین پس از موفقیت بررسی اولیهٔ visibility و پیش از اجرای کاربرد، یک بار مجوز لغو و یک بار وضعیت توسط Reviewer دیگر تغییر کرد؛ Application دادهٔ جاری را دوباره خواند و 404 عمومی داد. این دو حالت با فراخوانی واقعی تغییر روی اتصال مستقل fixture و یک نقطهٔ تزریق آزمونی در بازگشت بررسی اولیه اجرا شدند؛ جای رقابت worker را نگرفته‌اند.

## شواهد داده و نسخهٔ نهایی

[رد کامل اجرا](../../../test-results/us5/races.jsonl) شامل ۱۹ رکورد سناریو، پیام‌های هر worker، threadId، نسخهٔ مشاهده‌شده، نتیجه، status، محتوا و version نهایی واقعی است. ready، attempt، locked، written، committed و result نقاط مشاهده‌اند؛ written به معنی Commit نیست. ترتیب پیام‌های دو نخ به‌تنهایی ترتیب سراسری Commit محسوب نمی‌شود؛ گیت‌ها و نتیجهٔ Database شاهد ترتیب انتخاب‌شده هستند.

جدول زیر از همان خروجی واقعی استخراج شده است. شناسه‌های ردیف و نسخه‌ها مختص Database موقت آزمون‌اند و مقدار پیکربندی یا دادهٔ محصول نیستند.

| سناریو | نتیجهٔ اقدامات | شناسهٔ درخواست | وضعیت نهایی | نسخهٔ نهایی |
| --- | --- | --- | --- | --- |
| HTTP نسخهٔ قدیمی Draft | OK / CONCURRENCY_CONFLICT | f1d15a55-c58a-4cc2-aed6-2cdecce2fd52 | Draft | b6572317-9235-4a1b-a538-acac6819d066 |
| HTTP نسخهٔ قدیمی ChangesRequested | OK / CONCURRENCY_CONFLICT | bb4151d7-388e-4bc0-b1dc-5a0443a89c39 | ChangesRequested | 70000605-e8c6-46ba-ab10-d77079743879 |
| تغییر role پس از Guard | REQUEST_UNAVAILABLE | f1cd8d2c-20df-4833-ac9e-03cb275269ac | PendingReview | 0a0335ff-e89f-4fb7-8c35-6ba8fe37c2cf |
| تغییر visibility پس از Guard | REQUEST_UNAVAILABLE | a27cdd23-d9a4-4800-a5da-fb2a2f1b1c32 | ChangesRequested | 683d09e3-7988-438c-8895-21aa8aa2eafe |
| دو ویرایش Draft | OK / CONCURRENCY_CONFLICT | 9a4c2e67-859f-40f0-8191-cd304bc36e69 | Draft | 73d3c8bf-132f-4c90-8bb7-a5a5d308fd1b |
| دو ویرایش ChangesRequested | OK / CONCURRENCY_CONFLICT | 378d5668-e21e-49e3-8467-9fc2eb09eee6 | ChangesRequested | f2b7bbc0-75a5-4447-a1ad-f695e7397f7d |
| ویرایش و Submit با برندهٔ submit | OK / INVALID_STATE | 7a43c9cf-0a70-4fc5-be68-4fa036538e30 | PendingReview | 1f336207-f220-424d-ac94-0dcf98437e19 |
| ویرایش و Submit با برندهٔ edit | OK / CONCURRENCY_CONFLICT | c2571909-9095-4bf3-8298-cb48504b4c0e | Draft | c5e9a41a-8794-4882-997a-84484de946ce |
| Rollback edit | INTERNAL_ERROR | cbfe1c70-a4ce-47d6-90b9-d36dd493c81d | Draft | 06837db8-6b66-4e4e-b4b1-bdf901744a5a |
| Rollback submit | INTERNAL_ERROR | 54309254-7b69-42f9-99a6-99df65f702ec | Draft | 6d729722-a9a4-4fff-ab1a-a0fea576ecc1 |
| Rollback approve | INTERNAL_ERROR | 97f276ec-2ef5-4bbf-9dea-d0a4a57c49a7 | PendingReview | 13da5739-9688-4890-90a6-4c557c20e23e |
| Rollback request-changes | INTERNAL_ERROR | 244aab9e-aca8-4dfc-8d0c-8b4b7be7a332 | PendingReview | 2ee2f323-448b-4e53-a3f1-9ae1634fb3d9 |
| BUSY واقعی و HTTP 503 | OK / SERVICE_UNAVAILABLE | d0ef4f04-9256-4a6d-979f-2c4e479839ca | Draft | c53b9e35-5784-4dd8-8464-186f0fb476f3 |
| approve؛ نخست revoke | OK / REQUEST_UNAVAILABLE | 5266aece-3168-40ee-8b0a-ac1e68b2d25b | PendingReview | cbe97225-a5df-4129-9c6c-cb5cac324d7d |
| approve؛ نخست decision | OK / OK | e62d6b99-e932-406b-994d-108511b2f23d | Approved | cf9067e5-1954-4066-8611-fd4cf163a034 |
| request-changes؛ نخست revoke | OK / REQUEST_UNAVAILABLE | 57cec91f-2106-4781-bfaf-c36ec5dd8704 | PendingReview | 7fc69411-1c37-47d2-80b1-269793626898 |
| request-changes؛ نخست decision | OK / OK | 90cdedba-2266-479c-bc01-84b5a0aa0a42 | ChangesRequested | ab7e8748-a393-4600-976b-e5fa96a1e18b |
| تصمیم نخست approve | OK / REQUEST_UNAVAILABLE | 4247fa18-8704-4143-8bdc-abf7a50eb679 | Approved | 791fb349-e2d9-47b5-9f9a-cf54d31d57d2 |
| تصمیم نخست request-changes | OK / REQUEST_UNAVAILABLE | 2f4f6789-9944-4a48-92a8-559a24450696 | ChangesRequested | 9b566baa-ff52-4182-9aa2-05f89d201c5a |

## فرمان‌ها و نتایج واقعی

| فرمان | نتیجه |
| --- | --- |
| npm.cmd run build | خروج ۰؛ Build موفق. |
| npm.cmd run typecheck | در نخستین اجرای harness خروج ۱ به علت optional بودن isReviewer؛ پس از اصلاح نوع و ثبت null صریح برای نگاشت ناموجود، خروج ۰. |
| npm.cmd run test:concurrency -- --json --outputFile=test-results/us5/concurrency.json | خروج ۰؛ ۵ مجموعه و هر ۲۸ آزمون موفق؛ صفر ناموفق و صفر انتخاب‌نشده. |
| npm.cmd run test:unit -- --json --outputFile=test-results/us5/unit.json | خروج ۰؛ ۶ مجموعه و هر ۲۱۸ آزمون موفق. |
| npm.cmd run test:integration -- --json --outputFile=test-results/us5/integration.json | خروج ۰؛ ۱۲ مجموعه و هر ۲۴۱ آزمون موفق. |
| npm.cmd run test:contract -- --json --outputFile=test-results/us5/contract.json | خروج ۰؛ یک مجموعه و هر ۶ آزمون موجود موفق. |

جمع نهایی ۴۹۳ آزمون موفق است. چهار گزارش [Concurrency](../../../test-results/us5/concurrency.json)، [Unit](../../../test-results/us5/unit.json)، [Integration](../../../test-results/us5/integration.json) و [Contract](../../../test-results/us5/contract.json) همگی success برابر true و صفر آزمون ناموفق یا انتخاب‌نشده دارند. این فایل‌ها و races.jsonl خارج از Git هستند و در checkout تازه باید با اجرای واقعی دوباره تولید شوند.

زمان اجرا در تاریخ 2026-11-16 به وقت UTC، برابر بامداد 2026-11-17 در تهران:

| مجموعه | شروع | پایان |
| --- | --- | --- |
| Concurrency | 20:55:06.714 | 20:55:17.356 |
| Unit | 20:56:07.018 | 20:56:13.635 |
| Integration | 20:56:09.720 | 20:56:50.963 |
| Contract | 20:56:15.380 | 20:56:17.236 |

آزمون‌های جدید روی مسیر محصول موجود از ابتدا موفق بودند. شکست رفتاری یا اصلاح محصولی برای آن‌ها جعل نشده است؛ T056 صریحاً اجازهٔ ثبت صحت مسیر موجود بدون تغییر را می‌دهد. خطای اولیه فقط در نوع ابزار آزمون بود. ناپایداری مشاهده نشد و Suite رقابت برای رسیدن به موفقیت تکرار نشد.

## تغییرات، محدودیت‌ها و توقف

فقط هفت فایل آزمون و fixture فوق، tasks.md، evidence/concurrency-review.md و همین evidence/us5.md ایجاد یا اصلاح شدند. هیچ فایل src، Controller، Migration، قرارداد، Constitution، Specification، Plan/Research یا وابستگی تغییر نکرد. SHA-256 فایل package-lock.json همچنان 47aec7af21e0642cc65405a12c0cd95ef79f04604bb5bca2979b381244e1bc10 است. کلید یا توکن در گزارش درج نشده و الگوی JWT در خروجی‌های این فاز یافت نشد.

- workerها با اتصال مستقل و tsx/cjs موجود اجرا شدند؛ اجرای Concurrency و Integration با دسترسی لازم محیط برای worker و subprocess انجام شد. هشدار آزمایشی VM Modules باقی است.
- توقف و خطای عمدی داخل worker فقط ابزار آزمون‌اند؛ callback محصول همگام و کوتاه مانده است. هیچ Endpoint آزمونی یا retry کور اضافه نشده است.
- خرابی دیسک/فرایند و نتیجهٔ نامعلوم Commit تزریق نشده‌اند. نبود ایجاد مجدد خودکار با بازبینی مسیرهای موجود بررسی شد؛ آزمون اجرایی این خرابی‌ها ادعا نمی‌شود. همهٔ زمان‌بندی‌ها یا کارایی عملیاتی نیز اثبات نشده‌اند.
- بررسی‌های جامع مرحلهٔ هشتم و پذیرش نهایی MVP باقی مانده‌اند؛ موفقیت Build و Test جایگزین آن‌ها نیست.

T001 تا T057 تکمیل و T058 تا T064، شامل هفت Task، باز هستند. فاز هشتم با پیش‌نیاز T057 آمادهٔ شروع پس از تأیید صریح کاربر است؛ هیچ Task آن آغاز نشده است. فایل .specify/extensions.yml پیش و پس از اجرا وجود نداشت و Hook ثبت‌شده‌ای برای اجرا نبود.
