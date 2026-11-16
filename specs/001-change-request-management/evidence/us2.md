# گزارش اجرای فاز چهارم ChangeFlow

**تاریخ**: 2026-11-16  
**دامنهٔ تأییدشده**: فقط فاز چهارم، داستان دوم، T033 تا T037  
**نتیجه**: هر پنج Task این فاز با شواهد واقعی تکمیل شدند؛ فاز پنجم آغاز نشده است.

## مبنا و پیش‌نیاز

مبنا، [قانون اساسی](../../../.specify/memory/constitution.md)، [Specification](../spec.md)، [Plan](../plan.md)، [Research](../research.md)، [قرارداد HTTP](../contracts/http-api.md) و [Taskها](../tasks.md) است.

کاربر فاز سوم را تأیید و اجرای فاز چهارم را مجاز کرد. در آغاز، T001 تا T032 تکمیل‌شده بودند؛ تغییرات ثبت‌نشدهٔ فاز سوم در Git وجود داشتند و حفظ شدند. Build، Typecheck و ۹۳ آزمون Unit پایه دوباره اجرا و موفق شدند. گزارش‌های قبلی فاز سوم ۱۰۲ Integration و ۶ Contract موفق داشتند؛ خواندن این گزارش‌ها به‌عنوان اجرای مجدد گزارش نشد. چک‌لیست requirements.md دارای ۱۶ مورد تأییدشده و صفر مورد باز بود و تغییر نکرد.

## ترتیب اجرا و خروجی‌ها

| Task | پیش‌نیاز | خروجی و نتیجه |
| --- | --- | --- |
| T033 | T032 | ۲۱ آزمون مستقل Application بدون HTTP با fixture واقعی SQLite؛ مالک، نقش جاری، وضعیت، تکرار، نسخه و Rollback |
| T034 | T032 | ۲۱ آزمون HTTP و قرارداد Submit با دادهٔ آماده؛ 204، خطاها، عدم تغییر درخواست و نبود لغو |
| T035 | T033 و T034 | کاربرد Submit با بازخوانی مجوز و درخواست در IMMEDIATE و انتقال مشروط Draft به PendingReview |
| T036 | T035 | Controller نازک و ثبت Provider در AppModule؛ POST /api/change-requests/{id}/submit |
| T037 | T036 | بررسی واقعی Build، Typecheck، Unit، Integration، Contract و این گزارش |

ابتدا آزمون‌ها و فقط اسکلت importپذیر Submit نوشته شدند. شکست اولیهٔ assertionهای AC-201 در هر دو فایل ثبت شد؛ سپس منطق کاربرد و اتصال Endpoint تکمیل شد. هیچ آزمون به ایجاد درخواست از Endpoint وابسته نیست؛ وضعیت‌های لازم با fixture دارای Migration واقعی آماده می‌شوند.

## رفتار پیاده‌شده

- مالک دارای مجوز فعلی Requester می‌تواند Draft را با If-Match معتبر به PendingReview منتقل کند؛ داشتن هر دو نقش نیز مانع Submit درخواست خود نمی‌شود و مجوز Self-Approval ایجاد نمی‌کند.
- عملیات در واحد کار IMMEDIATE، به‌ترتیب هویت، visibility، مجوز و مالکیت، وضعیت فعلی، بدنه و نسخهٔ مشاهده‌شده را بررسی می‌کند. تصمیم نهایی به نتیجهٔ Guard یا نقش توکن وابسته نیست.
- فقط status و version تغییر می‌کنند؛ id، محتوا و requesterId ثابت می‌مانند. Store موجود، نوشتن مشروط به id و version و نتیجهٔ دقیقاً یک ردیف را اعمال می‌کند.
- بدنه باید غایب یا شیء JSON خالی باشد. null، آرایه، مقدار غیرشیء، JSON نامعتبر و هر خصوصیت اضافی، از جمله status و requesterId، خطای ورودی دارند و چیزی بی‌صدا حذف یا اعمال نمی‌شود.
- موفقیت پس از Commit با 204، بدون Body، ETag یا Location اعلام می‌شود؛ no-store برقرار است. مالک برای نسخهٔ تازه می‌تواند GET انجام دهد.
- Submit تکراری مالک در PendingReview، حتی با نسخهٔ قدیمی یا JSON نامعتبر، پیش از بررسی ورودی و نسخه با INVALID_STATE و 409 رد می‌شود؛ موفقیت قبلی بازپخش نمی‌شود.
- برای Draft، نبود If-Match برابر 428، قالب نامعتبر برابر 400 و نسخهٔ قدیمی برابر 412 است؛ هیچ‌یک درخواست را تغییر نمی‌دهند.
- انقضای هویت پیش از Commit و شکست پس از UPDATE موجب Rollback می‌شوند؛ retry یا refresh خودکار نسخه وجود ندارد.
- ارسال ChangesRequested طبق T048 برای فاز ششم باقی مانده و فعلاً 409 دارد؛ این محدودیت مرحله‌ای تغییر Specification نیست.

Controller فقط دریافت درخواست، تبدیل deferred بدنه و Header، فراخوانی Application و تعیین پاسخ HTTP را انجام می‌دهد. SQL، مالکیت و قواعد وضعیت در Controller قرار ندارند؛ کاربرد Submit به Nest یا HTTP import ندارد. Framework، Database، Driver و تصمیم مهم محصولی یا معماری تغییر نکردند و وابستگی جدیدی نصب نشد.

## فرمان‌ها و نتیجهٔ واقعی

| فرمان | کد خروج | نتیجه |
| --- | --- | --- |
| npm.cmd run test:unit -- --runTestsByPath test/unit/us2-submit.spec.ts --testNamePattern=AC-201 --json --outputFile=test-results/us2/unit-red.json | ۱ | دو assertion ناموفق؛ اسکلت اولیه انتقال موفق انجام نمی‌داد؛ ۱۹ آزمون انتخاب نشده بودند. |
| npm.cmd run test:integration -- --runTestsByPath test/integration/us2-submit-http.spec.ts --testNamePattern=AC-201 --json --outputFile=test-results/us2/http-red.json | ۱ | دو assertion ناموفق؛ پاسخ 404 به‌جای 204 بود؛ ۱۹ آزمون انتخاب نشده بودند. |
| npm.cmd run build | ۰ | Build واقعی موفق بود. |
| npm.cmd run typecheck | ۰ | بررسی نوع src، tools و test موفق بود. |
| npm.cmd run test:unit -- --runTestsByPath test/unit/us2-submit.spec.ts | ۰ | هر ۲۱ آزمون جدید Application موفق شد. |
| npm.cmd run test:integration -- --runTestsByPath test/integration/us2-submit-http.spec.ts | ۰ | هر ۲۱ آزمون جدید HTTP موفق شد. |
| npm.cmd run test:unit -- --json --outputFile=test-results/us2/unit.json | ۰ | ۴ مجموعه؛ ۱۱۴ آزمون موفق؛ صفر ناموفق |
| npm.cmd run test:integration -- --json --outputFile=test-results/us2/integration.json | ۰ | ۹ مجموعه؛ ۱۲۳ آزمون موفق؛ صفر ناموفق |
| npm.cmd run test:contract -- --json --outputFile=test-results/us2/contract.json | ۰ | یک مجموعه؛ ۶ آزمون قبلی US1 موفق؛ قرارداد Submit داخل Integration جدید بررسی شد. |

جمع آزمون‌های نهایی ۲۴۳ است؛ ۴۲ آزمون جدید متعلق به US2 هستند. فایل test/unit/us2-submit.spec.ts مطابق مسیر مصوب Task نوشته شده، اما برای سنجش مستقل Application و تغییر واقعی Database از SQLite فایل‌محور استفاده می‌کند؛ این آزمون‌ها mock صرف یا آزمون HTTP نیستند.

گزارش‌های [Unit](../../../test-results/us2/unit.json)، [Integration](../../../test-results/us2/integration.json) و [Contract](../../../test-results/us2/contract.json) محلی و خارج از Git هستند و در checkout تازه باید تولید شوند. خروجی‌های قرمز نیز در test-results/us2/ حفظ شده‌اند؛ آزمون انتخاب‌نشده موفق محسوب نشده است. الگوی JWT در خروجی‌های نهایی یافت نشد و کلید یا توکن واقعی در این سند ثبت نشده است.

## شواهد شش سناریوی پذیرش

| سناریو | بررسی اجراشده | نتیجهٔ واقعی |
| --- | --- | --- |
| AC-201 | مالک requester-a و مالک دارای دو نقش dual-c در Application؛ بدنهٔ غایب و {} در HTTP | Draft به PendingReview رفت؛ خواندن SQLite برابری تمام فیلدها به‌جز status و version و تازه‌شدن version را تأیید کرد. HTTP برابر 204 بدون Body/ETag بود و GET بعدی ETag تازه داشت. |
| AC-202 | Submit روی Draft شخص دیگر توسط Reviewer و کاربر دارای هر دو نقش | 404 عمومی به علت عدم مشاهده؛ snapshot درخواست‌ها ثابت ماند. در Application ورودی نیز خوانده نشد. |
| AC-203 | ویرایش PendingReview و Approved با fixture مستقل و نسخهٔ موجود | 409؛ محتوا، وضعیت، مالک و version از Database بدون تغییر باقی ماندند. |
| AC-204 | نبود هویت، انقضای هویت در Application، لغو مجوز جاری پس از صدور هویت و نگاشت محلی ناموجود | به‌ترتیب 401، خطای هویت، 403 و 404 عمومی؛ درخواست تغییر نکرد. تغییر عمدی نقش در آماده‌سازی آزمون، با تغییر درخواست اشتباه گرفته نشد. |
| AC-205 | Submit موفق و سپس تکرار با ETag قدیمی و بدنهٔ معتبر یا JSON شکسته | 409 با INVALID_STATE؛ نه 204 تکراری و نه 412؛ snapshot پس از Commit نخست در تلاش‌های بعدی ثابت ماند. |
| AC-206 | تلاش مالک و Reviewer برای POST مسیر cancel روی PendingReview آماده | 404؛ Endpoint لغو وجود ندارد و داده و وضعیت درخواست ثابت ماندند. |

بررسی‌های مکمل شامل حالت‌های PendingReview، Approved و ChangesRequested پیش از خواندن ورودی/نسخه، Header غایب/نامعتبر/قدیمی، بدنهٔ غیرمجاز، برابری پاسخ منبع پنهان و ناموجود با ورودی خراب، مجوز ناکافی روی منبع قابل مشاهده، شکست تزریق‌شده پس از UPDATE و انقضای هویت پیش از Commit است. در موارد خطا، snapshot واقعی درخواست‌ها یا ردیف مربوط از SQLite مقایسه شد؛ صرف کد HTTP شاهد کافی تلقی نشد.

## خطاها، سازگاری و محدودیت‌ها

- شکست‌های اولیه رفتاری و مورد انتظار بودند؛ خطای نصب یا import به‌عنوان مرحلهٔ قرمز گزارش نشد. پس از پیاده‌سازی، آزمون هدف و رگرسیون کامل موفق شدند.
- انتظار قدیمی آزمون US1 دربارهٔ نبود Submit حذف شد، چون این مسیر اکنون متعلق به همین فاز است؛ بررسی نبود DELETE، PATCH، Approve و RequestChanges حفظ شد. آزمون‌های اختصاصی US2 رفتار Submit را پوشش می‌دهند؛ معیار AC-108 دربارهٔ نبود حذف تضعیف نشد.
- اجرای کامل Integration با دسترسی لازم subprocess برای ابزارهای CLI قبلی انجام شد؛ داده و کلید آزمون موقت بودند. هشدار آزمایشی VM Modules همچنان دیده می‌شود؛ ممیزی نهایی وابستگی‌ها در این فاز انجام نشد.
- آزمون نسخهٔ قدیمی و Rollback، جایگزین آزمون رقابت چند worker در US5 نیست. هیچ موفقیت اجرایی برای سناریوهای اجرا‌نشدهٔ مراحل بعد ادعا نمی‌شود.
- Approve، RequestChanges، لغو، حذف و ارسال مجدد ChangesRequested در این فاز پیاده‌سازی نشده‌اند؛ پذیرش نهایی MVP همچنان به فازهای بعد وابسته است.

## فایل‌های این فاز

| نوع تغییر | مسیر |
| --- | --- |
| کاربرد جدید | src/application/submit-change-request.ts |
| Controller جدید | src/http/controllers/submit-change-request.controller.ts |
| اتصال Provider و Controller | src/app.module.ts |
| آزمون مستقل جدید | test/unit/us2-submit.spec.ts |
| آزمون HTTP جدید | test/integration/us2-submit-http.spec.ts |
| اصلاح انتظار مرحله‌ای | test/integration/us1-http.spec.ts |
| پیگیری و شواهد | tasks.md و همین فایل evidence/us2.md |

تغییرات قبلی فاز سوم که هنوز در Git ثبت نشده بودند حفظ شدند و جزو تغییرات تازهٔ این فاز شمرده نشده‌اند. Constitution، Specification، Plan/Research، قراردادها، Migration، package.json، lockfile و کلید محلی تغییر نکردند. SHA-256 فایل lockfile همچنان 47aec7af21e0642cc65405a12c0cd95ef79f04604bb5bca2979b381244e1bc10 است.

## نقطهٔ توقف

T001 تا T037 تکمیل و T038 تا T064، شامل ۲۷ Task، انجام‌نشده‌اند. فاز بعد، داستان بررسی و تصمیم مجاز در T038 تا T044 است؛ پیش‌نیاز آن T037 و تأیید صریح کاربر است. هیچ Task فاز پنجم آغاز نشده است.

فایل .specify/extensions.yml پیش و پس از اجرا وجود نداشت؛ Hook ثبت‌شده‌ای اجرا نشده است. Build و Test موفق این فاز، پذیرش نهایی محصول یا تأیید موارد بررسی‌نشده نیست.
