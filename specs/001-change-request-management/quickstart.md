# راهنمای عملی اجرای ChangeFlow

**تاریخ**: 2026-11-17 | **محدوده**: Development/Test روی یک میزبان محلی

مراحل نصب، تنظیمات، Migration و کاربران نمونه در [README](../../README.md) آمده‌اند. قبل از درخواست HTTP، برنامه باید با npm.cmd start در نشست دیگری اجرا شود. این راهنما نیازمند Frontend نیست.

## ایجاد، اصلاح و ارسال

در PowerShell، از ریشهٔ مخزن و بدون چاپ توکن‌ها:

```powershell
$baseUrl = 'http://127.0.0.1:3000'
$requesterToken = (npm.cmd run --silent dev:token -- --subject requester-a).Trim()
$reviewerToken = (npm.cmd run --silent dev:token -- --subject reviewer-b).Trim()
$requesterHeaders = @{ Authorization = "Bearer $requesterToken" }
$reviewerHeaders = @{ Authorization = "Bearer $reviewerToken" }
$content = @{ title = 'اصلاح فرایند انتشار'; description = 'افزودن بررسی پیش از انتشار'; reason = 'کاهش خطاهای انتشار' }
$payload = [Text.Encoding]::UTF8.GetBytes(($content | ConvertTo-Json -Compress))
$created = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$baseUrl/api/change-requests" -Headers $requesterHeaders -ContentType 'application/json; charset=utf-8' -Body $payload
$change = $created.Content | ConvertFrom-Json
$requestUrl = "$baseUrl/api/change-requests/$($change.id)"
$ownerView = Invoke-WebRequest -UseBasicParsing -Uri $requestUrl -Headers $requesterHeaders
$writeHeaders = @{ Authorization = "Bearer $requesterToken"; 'If-Match' = $ownerView.Headers['ETag'] }
$edited = Invoke-WebRequest -UseBasicParsing -Method Put -Uri $requestUrl -Headers $writeHeaders -ContentType 'application/json; charset=utf-8' -Body $payload
$submitHeaders = @{ Authorization = "Bearer $requesterToken"; 'If-Match' = $edited.Headers['ETag'] }
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$requestUrl/submit" -Headers $submitHeaders -ContentType 'application/json' -Body '{}'
```

نتیجهٔ ایجاد 201 و Draft است؛ اصلاح 200 و ETag تازه می‌دهد و ارسال 204 دارد. شناسه و مالک در اصلاح و انتقال ثابت می‌مانند. ارسال موفق را با GET مالک بررسی کنید؛ ETag پاسخ قدیمی برای نوشتن بعدی معتبر نیست.

## بررسی، برگشت و ارسال مجدد

```powershell
$reviewView = Invoke-WebRequest -UseBasicParsing -Uri $requestUrl -Headers $reviewerHeaders
$decisionHeaders = @{ Authorization = "Bearer $reviewerToken"; 'If-Match' = $reviewView.Headers['ETag'] }
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$requestUrl/request-changes" -Headers $decisionHeaders -ContentType 'application/json' -Body '{}'
$returned = Invoke-WebRequest -UseBasicParsing -Uri $requestUrl -Headers $requesterHeaders
$revisionHeaders = @{ Authorization = "Bearer $requesterToken"; 'If-Match' = $returned.Headers['ETag'] }
$content.description = 'افزودن بررسی و آزمون پیش از انتشار'
$payload = [Text.Encoding]::UTF8.GetBytes(($content | ConvertTo-Json -Compress))
$revision = Invoke-WebRequest -UseBasicParsing -Method Put -Uri $requestUrl -Headers $revisionHeaders -ContentType 'application/json; charset=utf-8' -Body $payload
$fresh = Invoke-WebRequest -UseBasicParsing -Uri $requestUrl -Headers $requesterHeaders
$resubmitHeaders = @{ Authorization = "Bearer $requesterToken"; 'If-Match' = $fresh.Headers['ETag'] }
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$requestUrl/submit" -Headers $resubmitHeaders -ContentType 'application/json' -Body '{}'
$reviewAgain = Invoke-WebRequest -UseBasicParsing -Uri $requestUrl -Headers $reviewerHeaders
$approveHeaders = @{ Authorization = "Bearer $reviewerToken"; 'If-Match' = $reviewAgain.Headers['ETag'] }
Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$requestUrl/approve" -Headers $approveHeaders -ContentType 'application/json' -Body '{}'
$finalView = Invoke-WebRequest -UseBasicParsing -Uri $requestUrl -Headers $requesterHeaders
$finalView.Content
```

پس از برگشت، وضعیت ChangesRequested و مشاهدهٔ Reviewer ممنوع است. اصلاح وضعیت را تغییر نمی‌دهد؛ ارسال مجدد PendingReview و بررسی نهایی Approved می‌سازند. پس از هر تصمیم Reviewer دوباره دسترسی مشاهده ندارد؛ پاسخ GET او 404 عمومی است. Approved قابل اصلاح یا انتقال خروجی نیست.

## بازبینی خطاها و نتیجهٔ عملیات

PowerShell برای پاسخ ناموفق خطا ایجاد می‌کند؛ کد HTTP و بدنهٔ فارسی باید از پاسخ خطا خوانده شوند. این خطا به معنی پذیرفته‌شدن عملیات نیست. برای آزمون دستی باید از درخواست نمونهٔ آزمایشی استفاده شود.

| نقش | آزمون | نتیجهٔ مورد انتظار |
| --- | --- | --- |
| Requester | ایجاد، اصلاح Draft، ارسال، اصلاح ChangesRequested و ارسال مجدد | وضعیت و داده مطابق گردش بالا؛ حفظ شناسه و مالک |
| Requester | ویرایش PendingReview یا Approved و Submit تکراری | 409؛ بدون تغییر |
| Requester | ویرایش با ETag پیش از آخرین اصلاح | 412؛ دادهٔ تازه باقی بماند |
| Requester | نبود If-Match، فیلد اضافی، متن نامعتبر | 428 یا 400 همراه نام فیلد؛ بدون تغییر جزئی |
| Reviewer | مشاهده و تصمیم روی PendingReview دیگران | 200 و سپس 204؛ وضعیت تازه را مالک ببیند |
| Reviewer | مشاهدهٔ دیگران در سه وضعیت دیگر یا تصمیم تکراری | 404 یکسان با شناسهٔ ناموجود |
| Reviewer | تصمیم با نسخهٔ چرخهٔ قبلی، پس از بازگشت همان درخواست به PendingReview | 412؛ تصمیمی ثبت نشود |
| هر دو نقش | Approve یا RequestChanges روی درخواست خود | 403 با توضیح فارسی؛ بدون تغییر |
| هر نقش | توکن نامعتبر/منقضی یا مجوز جاری لغوشده | رد عملیات؛ نقش توکن یا مشاهدهٔ قبلی کافی نیست |

برای SC-007 نمایندهٔ هر نقش باید نتایج سناریوهای مرتبط را واقعاً مشاهده و وضعیت، موفقیت، رد یا تعارض را تشخیص دهد. اجرای خودکار یا تأیید کلی کدنویسی جای این مشاهده را نمی‌گیرد. نتیجه و استثناها باید در [گزارش پذیرش](evidence/acceptance.md) ثبت شوند.

## اجرای آزمون‌های واقعی

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:concurrency
npm.cmd run test:contract
```

Integration ابزارهای CLI و Database واقعی را نیز بررسی می‌کند. Concurrency از worker و اتصال مستقل استفاده می‌کند؛ Coordinator بدون sleep تصادفی ترتیب را کنترل می‌کند. Contract شامل تطبیق OpenAPI و مرز ۱۳۱۰۷۲ بایت است. خروجی‌های محلی test-results در Git نگهداری نمی‌شوند؛ گزارش‌های evidence نتایج واقعی و محدودیت‌ها را ثبت می‌کنند.

هویت محلی جای راهکار هویت عملیاتی سازمان نیست. نسخهٔ فعلی production، استقرار چندمیزبانی، Frontend و AI را پوشش نمی‌دهد. خطای فنی یا نتیجهٔ نامعلوم نباید باعث ساخت خودکار درخواست جایگزین شود. جزئیات خطاها و رفع مشکل در README و قرارداد HTTP آمده است.
