# گزارش اجرای فاز اول ChangeFlow

**تاریخ**: 2026-11-16  
**دامنهٔ مجاز**: فقط مرحلهٔ ۱، آماده‌سازی مشترک، شامل T001 تا T005  
**نتیجه**: پنج Task این فاز با نصب، Build، بررسی نوع و آزمون واقعی تکمیل شدند؛ فاز دوم آغاز نشده است.

## فازها و وابستگی‌ها

| فاز در tasks.md | Taskها | پیش‌نیاز شروع | وضعیت |
| --- | --- | --- | --- |
| آماده‌سازی مشترک | T001 تا T005 | ندارد | تکمیل شد |
| زیرساخت پایه | T006 تا T021 | T005 و تأیید صریح کاربر | آغاز نشده |
| داستان ۱ | T022 تا T032 | T021 و تأیید صریح کاربر | آغاز نشده |
| داستان ۲ | T033 تا T037 | T032 و تأیید صریح کاربر | آغاز نشده |
| داستان ۳ | T038 تا T044 | T037 و تأیید صریح کاربر | آغاز نشده |
| داستان ۴ | T045 تا T049 | T044 و تأیید صریح کاربر | آغاز نشده |
| داستان ۵ | T050 تا T057 | T049 و تأیید صریح کاربر؛ سپس harness در T050 | آغاز نشده |
| بازبینی و پذیرش نهایی | T058 تا T064 | T057 و تأیید صریح کاربر | آغاز نشده |

در فاز اول، T002 و T003 پس از T001 مستقل‌اند؛ T004 به T003 و T005 به T002، T003 و T004 وابسته است.

## محیط و نسخه‌های واقعی

| مورد | مقدار مشاهده‌شده |
| --- | --- |
| محیط | Windows؛ win32؛ x64 |
| Node.js و npm | v24.18.0 و 11.16.0 |
| NestJS و ابزار CLI | 12.5.0 و 12.0.13 |
| TypeScript | 6.0.3 |
| Jest و ts-jest | 30.5.2 و 29.4.15 |
| Supertest | 7.3.2 |
| better-sqlite3 | 13.2.0 |
| SQLite بارگذاری‌شده | 3.54.1 |
| SHA-256 فایل package-lock.json | 47AEC7AF21E0642CC65405A12C0CD95EF79F04604BB5BCA2979B381244E1BC10 |

نسخه‌های مستقیم و غیرمستقیم در lockfile تثبیت شده‌اند؛ npm ls --depth=0 در پایان با خروج صفر و بدون وابستگی مفقود اجرا شد.

## کار انجام‌شده

| Task | خروجی و شاهد |
| --- | --- |
| T001 | اسکلت Nest بدون Endpoint محصول؛ ساختار پوشه‌ها، manifest، lockfile، تنظیم TypeScript و Build موفق |
| T002 | چهار تنظیم Jest و نگاشت نام‌های دستورهای quickstart؛ تولید گزارش JSON؛ اجرای Unit و Integration و بررسی فهرست خالی دو مجموعهٔ آینده |
| T003 | تنظیمات با خطای صریح فارسی؛ رد production محلی و مسیرهای شبکه‌ای صریح؛ کنارگذاشتن کلید، Database و خروجی محلی از Git |
| T004 | کلید تصادفی ۳۲بایتی با randomBytes در فایل محلی .env خارج از Git؛ نوشتن انحصاری و عدم بازنویسی فایل موجود؛ بدون چاپ کلید |
| T005 | نصب قفل‌شده و آزمون ثبت، بستن، بازکردن مجدد و بازیابی متن Unicode در فایل SQLite موقت با Driver واقعی |

## فرمان‌ها و نتیجهٔ واقعی

| فرمان یا بررسی | کد خروج | نتیجه |
| --- | --- | --- |
| npm.cmd install --no-audit --no-fund --foreground-scripts | ۰ | نصب اولیه و تولید lockfile؛ به‌تنهایی شاهد صحت Driver محسوب نشد. |
| npm.cmd ci --no-audit --no-fund --foreground-scripts؛ اجرای نخست | ۱ | ورود به node-gyp و نبود Python؛ شکست ثبت شد. |
| npm.cmd install --package-lock-only --no-audit --no-fund --ignore-scripts | ۰ | هماهنگ‌سازی lockfile پس از تثبیت تنظیم نصب |
| npm.cmd ci --no-audit --no-fund --foreground-scripts؛ پس از تنظیم نصب | ۰ | نصب دقیق ۵۰۳ بسته و استفاده از باینری رسمی همراه Driver |
| npm.cmd run build؛ اجرای نهایی | ۰ | ساخت واقعی dist/main.js با Nest CLI |
| npm.cmd run typecheck؛ اجرای نهایی | ۰ | بررسی نوع src، tools و test |
| npm.cmd run test:unit -- --json --outputFile=test-results/setup/unit.json | ۰ | یک مجموعه؛ ۱۸ آزمون موفق؛ صفر ناموفق |
| npm.cmd run test:integration -- --json --outputFile=test-results/setup/integration.json؛ اجرای نهایی | ۰ | سه مجموعه؛ ۵ آزمون موفق؛ صفر ناموفق |
| npm.cmd run dev:init؛ دو اجرای نهایی | ۰ در هر دو | ایجاد فایل محلی و سپس حفظ آن؛ هش فایل پیش و پس از اجرای دوم یکسان بود؛ کلید چاپ نشد. |
| npm.cmd run test:concurrency -- --listTests --json | ۰ | فهرست خالی؛ هیچ آزمون Concurrency اجرا یا موفق اعلام نشد. |
| npm.cmd run test:contract -- --listTests --json | ۰ | فهرست خالی؛ هیچ آزمون Contract اجرا یا موفق اعلام نشد. |
| npm.cmd start و درخواست HTTP واقعی | راه‌اندازی موفق؛ بررسی HTTP با خروج ۰ | GET /api/change-requests روی 127.0.0.1:3000 پاسخ 404 داد؛ سپس فرایند متوقف و توقف آن بررسی شد. |
| بررسی git check-ignore | مطابق انتظار | .env، node_modules، dist و test-results نادیده گرفته می‌شوند؛ .env.example نادیده گرفته نمی‌شود. |

گزارش‌های ماشین‌خوان [Unit](../../../test-results/setup/unit.json) و [Integration](../../../test-results/setup/integration.json) در محیط محلی موجود و توسط Git نادیده گرفته می‌شوند؛ در checkout تازه باید با فرمان‌های بالا تولید شوند. نتیجهٔ ناموفق اولیهٔ Integration در test-results/setup/integration-initial.json حفظ شد. زمان شروع ثبت‌شده در گزارش‌های نهایی به‌ترتیب 2026-11-16T18:22:56.559Z و 2026-11-16T18:22:18.776Z است.

## خطاهای مشاهده‌شده و رفع آن‌ها

۱. دسترسی محدود اولیه به cache یا شبکهٔ npm مانع بررسی نسخه‌ها شد؛ عملیات لازم با دسترسی مجاز دوباره اجرا شد.

۲. npm ci اولیه به node-gyp رسید و به دلیل نبود Python شکست خورد. بستهٔ رسمی better-sqlite3 نسخهٔ 13.2.0، باینری prebuilds/win32-x64.node را همراه دارد و در manifest خود gypfile را false تعیین کرده است. در package.json پروژه، allowScripts برای همین نسخهٔ Driver برابر false شد تا ساخت خودکار جای استفاده از باینری همراه بسته را نگیرد؛ اسکریپت‌های مشخص @parcel/watcher و esbuild با نسخهٔ ثابت مجاز ماندند. حداقل npm برابر 11.16.0 و packageManager ثبت شدند. نصب قفل‌شدهٔ بعدی و بارگذاری واقعی Driver موفق شدند؛ نسخهٔ Driver یا معماری تغییر نکرد و ابزار ساخت سراسری نصب نشد.

۳. Build اولیه به علت تفسیر Node16 از واردکردن بسته‌های ESM در CommonJS و نوع مقدار parseEnv شکست خورد. تنظیم module به Node20، با حفظ type برابر commonjs و خروجی CommonJS، اصلاح شد؛ نوع تنظیمات محلی نیز با خروجی parseEnv سازگار شد. Build و Typecheck نهایی موفق بودند.

۴. Integration اولیه دو مجموعهٔ موفق و یک مجموعهٔ ناموفق داشت؛ Jest بستهٔ ESM مربوط به Nest را بارگذاری نمی‌کرد. اجرای Jest با --experimental-vm-modules برای پشتیبانی require(ESM) در Node منتخب تنظیم شد؛ اجرای نهایی هر سه مجموعه موفق بود. هشدار آزمایشی VM Modules همچنان نمایش داده می‌شود.

۵. اجرای اولیهٔ dev:init در محیط محدود، در فراخوانی os.userInfo توسط tsx با uv_os_get_passwd و ENOMEM متوقف شد و فایل ایجاد نشد. اجرای مجاز بعدی دو بار موفق بود؛ خطای محیط اجرا به‌عنوان موفقیت اولیه گزارش نشده است.

منابع فنی: [manifest رسمی Driver](https://github.com/WiseLibs/better-sqlite3/blob/master/package.json)، [سیاست اسکریپت‌های npm](https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts/)، [module در TypeScript](https://www.typescriptlang.org/tsconfig/module.html) و [require برای ESM در Jest](https://jestjs.io/docs/ecmascript-modules#require-of-esm).

## فایل‌های ایجادشده و تغییرکرده

- package.json، package-lock.json، tsconfig.json، tsconfig.test.json و nest-cli.json
- jest.config.cjs، jest.integration.config.cjs، jest.concurrency.config.cjs و jest.contract.config.cjs
- .gitignore و .env.example؛ فایل واقعی .env فقط محلی و نادیده‌گرفته‌شده توسط Git است.
- src/main.ts، src/app.module.ts و src/infrastructure/configuration.ts
- tools/dev-init.ts
- test/unit/configuration.spec.ts
- test/integration/native-driver.spec.ts، test/integration/dev-init.spec.ts و test/integration/setup-bootstrap.spec.ts
- فایل‌های .gitkeep برای مسیرهای خالی Domain، Application، HTTP، Migration، fixture و آزمون Concurrency
- tasks.md برای ثبت تکمیل فقط T001 تا T005 و این گزارش در evidence/setup.md

## محدودیت‌ها و نقطهٔ توقف

- این ۲۳ آزمون، Setup را بررسی می‌کنند؛ قبولی ۵۳ سناریوی پذیرش محصول، Authentication، Authorization، گردش وضعیت یا Concurrency ادعا نمی‌شود.
- هنوز Migration، Store، JWT Guard، قواعد کسب‌وکار یا Endpoint محصول ساخته نشده‌اند. پاسخ 404 مشاهده‌شده صرفاً نبود مسیر محصول در اسکلت است؛ قرارداد فارسی خطاها در T015 ساخته خواهد شد.
- نام‌های db:migrate، dev:seed، dev:token و dev:permissions به مسیرهای مصوب آینده نگاشت شده‌اند؛ فایل آن ابزارها تا T009 و T020 ساخته نشده و این دستورها فعلاً قابل استفاده نیستند.
- نصب، هشدار منسوخ‌بودن glob@10.5.0 را در وابستگی غیرمستقیم ابزار ts-jest نشان داد؛ ممیزی آسیب‌پذیری اجرا نشده و رفع این هشدار ادعا نمی‌شود.
- npm allowScripts و VM Modules در نسخه‌های ثبت‌شده آزموده شده‌اند؛ محیط دیگر باید جداگانه بررسی شود. production در پیکربندی محلی رد می‌شود.
- فاز اول پایان یافته است؛ ۵۹ Task باقی مانده‌اند. مرحلهٔ بعد T006 تا T021 است و فقط پس از تأیید صریح کاربر آغاز می‌شود؛ نخست مدل‌ها، خطاها و Migration آماده می‌شوند.
- فایل .specify/extensions.yml وجود نداشت؛ Hook پیش یا پس از Implement ثبت نشده بود. چک‌لیست requirements.md با ۱۶ مورد تأییدشده و صفر مورد باز بررسی شد و تغییر نکرد.

Build و Test موفق این فاز، پذیرش نهایی محصول نیستند؛ Validation و Acceptance واقعی در فازهای بعد باقی مانده‌اند.
