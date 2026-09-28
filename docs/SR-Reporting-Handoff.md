# SR Reporting System — layihə xülasəsi (Claude Code üçün)

> Tarix: 28.09.2026 · Sahibi: SR Group Co, Head of Digital Marketing
> Bu fayl repo kökündə `CLAUDE.md` kimi saxlanıla bilər. İstifadəçi ilə yazışma dili: **Azərbaycan dili**.

## 1. Məqsəd

Mövcud **"SR Auto Satış Paneli"** (tək HTML fayl, datanı açıq paylaşılmış Google Sheet-dən brauzerdə oxuyur) → **şirkətdaxili, professional reporting sisteminə** köçürülür:

- ayrıca domen (məs. `report.srgroupco.com`, 5-ci mərhələdə);
- öz data bazası (PostgreSQL);
- **login səhifəsi** (email + şifrə);
- **analytics səhifəsi** — köhnə panelin 3 bölməsi birə-bir (dizayn, filtrlər, hesablamalar eyni).

Əsas lazım olan cəmi 2 səhifədir: **Login** və **Analytics**. İstifadəçi idarəsi ayrıca admin panel deyil — analytics səhifəsində yalnız adminə görünən kiçik "İstifadəçilər" pəncərəsi (əlavə et / sil / şifrəni sıfırla).

## 2. Qəbul olunmuş qərarlar

| Mövzu | Qərar |
|---|---|
| Hosting | Bulud: **Vercel** (sayt) + idarə olunan **PostgreSQL** (Neon, Vercel Marketplace vasitəsilə) |
| Stack | **Next.js (App Router) + TypeScript**; ORM — Drizzle və ya Prisma |
| Login | **Email + şifrə**; sərbəst qeydiyyat yoxdur, istifadəçiləri admin yaradır; şifrələr hash-lənir (argon2/bcrypt); səhv cəhdlərə limit; httpOnly session cookie |
| Giriş hüququ | Login olan **hər kəs bütün paneli görür** (brend üzrə məhdudiyyət yoxdur). Rollar: `admin`, `viewer` |
| Data girişi | 1-ci mərhələdə **Google Sheet qalır** (komanda ora yazır). Server Sheet-i **Google Sheets API + servis hesabı** ilə oxuyur, **hər 15 dəq** avtomatik sync (Vercel Cron) + "Yenilə" düyməsi. Sonra Sheet-in "linki olan hər kəs" paylaşımı bağlanır |
| Data çatdırılması | Server datanı `build.py` qaydaları ilə cəmləyib **kompakt formatda yalnız login olmuş istifadəçiyə** verir; çarpaz filtrləmə köhnə panel kimi **brauzerdə** gedir (sürət eyni qalır) |
| Kod | GitHub repo `sr-reporting` (private). Sessiyaya qoşulu GitHub hesabı: `mehemmedeliyev` |

**Köçürülməyəcək hissələr** (köhnə data yolunun "workaround"-larıdır): gviz/CSV fetch, snapshot/`__DATA__` inject, claude.ai `window.claude`/MCP Google Drive kodu, `build.py` pipeline-ı, `sr_dashboard_browser_pack.js`, Chrome ilə hissə-hissə oxuma.

## 3. Mənbə faylları (spesifikasiya)

Bu 3 fayl yeni sistemin spesifikasiyasıdır — repoda `docs/legacy/` qovluğuna qoyulmalıdır (istifadəçidə var, claude.ai "Murad" layihəsində də saxlanılıb):

1. `sr_dashboard_template.html` — **son versiya (patch6)**, tam HTML sənədi (~154 KB, ~2036 sətir). Bütün UI, CSS tokenləri və hesablama JS-i buradadır. **Əsas istinad.**
2. `sr_dashboard_build.py` — datanın cəmlənmə/normallaşdırma qaydaları (server tərəfdə eynilə təkrarlanmalıdır).
3. `sr-dashboard-yenileme.md` — bütün iterasiyaların təlimatı, yoxlama rəqəmləri.

Köhnə panel (müqayisə üçün): claude.ai artifact `https://claude.ai/artifact/L7PEHNVyFg6kqy2bUVteS4`.

## 4. Data mənbəyi

**Google Sheet "data baza"** — id `1epakBxb8J4NxdN7yFrq_6VeNPynD9m6j-gEPfrFugP8` (sahibi şəxsi Gmail hesabıdır; şirkət hesabına köçürülməsi tövsiyə olunur).

### 4.1 Main Data (gid=0)
Sütunlar: `Date` (format `d-Mon-yy`, məs. `2-Jan-26`), `Brend`, `Model`, `Növ`, `Kanal`, `Müraciət növü`, `Haradan Gəlib`, `Satış kanalı`, `Cash/Credit`.
- `Növ` dəyərləri: `Müraciət`, `Trafik`, `Sales`, **`Market Sales Split`**.
- `Növ = Market Sales Split` sətirləri **bazar datasıdır** (hər sətir = 1 satılmış avtomobil) — ana panelə düşmür, Market Share bölməsinə gedir (aylıq cəmlənir: ay × Brend × Model → say). Ayrıca "Market Sales Split" vərəqi artıq yoxdur.
- `Müraciət növü` və `Cash/Credit` paneldə **istifadə olunmur**.
- Həcm (28.09.2026): **229,687** CRM sətri (Müraciət 200,016 · Trafik 25,980 · Satış 3,691), **21,610** bazar sətri; CSV ~12.6 MB.

### 4.2 Real Stock (gid=1048230805)
Başlıqlar (alternativ yazılışlar da oxunmalıdır): `Brend adı`, `Model adı`, `Model növü`, `İstehsal ili`, `Nağd qiymət`, `Faiz`, `İlkin ödəniş`, `Müddət`, `Aylıq ödəniş`, `Stok sayı`, `Real Stok` (alt: `Real stok`/`Real stock`), `Hədəf`, `Actual Satış` (alt: `Actual satış`/`Satış`), `Beh Sayı` (alt: `Beh`), `Qeyd` (ola da bilər, olmaya da).

### 4.3 Normallaşdırma qaydaları (`build.py` + template ilə eyni)
- `norm(s)`: `İ→I`, `ı→i`, trim, lowercase, çoxlu boşluq → bir boşluq. Eyni `norm` açarlı yazılışlar birləşir (`E CLASS` = `E Class`); ekranda **ən çox işlənən yazılış** göstərilir.
- Başlıq tanıma (`hnorm`): `norm` + `ə→e, ş→s, ç→c, ğ→g, ö→o, ü→u`. Sinonimlər: date/tarix; brend/brand/marka; nov/type/tip; kanal/channel; "haradan gelib"/"traffic channel"; "satis kanali"/"sales channel".
- Kanal sütunları öz Növ-ünə aiddir; öz Növ-ündə boşdursa `"(boş)"` yazılır: `Kanal`↔Müraciət, `Haradan Gəlib`↔Trafik, `Satış kanalı`↔Sales. Başqa Növ-lərdə boş qalır və kartlarda sayılmır.
- CRM datası **gün × Brend × Model × Növ × Kanal × Satış kanalı × Haradan Gəlib** üzrə sayla cəmlənir.
- Real Stock: `Brend adı`/`Model adı` yalnız qrupun ilk sətrindədir → **yuxarıdan doldurulur**; model yoxdursa və ya (versiya da, rəqəmlər də boşdursa) sətir atılır. Rəqəm parseri həm `28,900.00 ₼`, həm `65.900.00 ₼` oxuyur (sonuncu ayırıcıdan sonra 1–2 rəqəm = onluq hissə). `Müddət` → `"48 ay"` / `"Cash"`. İl yalnız 4 rəqəmdirsə.
- Market: model boşdursa `"(model yoxdur)"`; brend boşdursa sətir atılır.

## 5. Analytics səhifəsi — funksional spesifikasiya

Ardıcıllıq: **SALES OVERVIEW → MARKET SHARE ANALYSIS → STOCK OVERVIEW**. Hər bölmənin başında qara fonlu başlıq (böyük şrift + kiçik alt-yazı). Başlıqlar **literal böyük hərflə** yazılır (CSS `uppercase` türk "İ" verir). İzahedici hint/marketinq mətnləri yoxdur, yalnız xəbərdarlıqlar görünür.

### 5.1 Yuxarı zolaq
- Logo "SR AUTO" + brend düymələri: Mercedes-Benz(→`Mercedes`), Changan, Xpeng, Avatr, Skoda, Lynk & Co (klik = Brend filtri).
- `Last update date` = datadakı son gün; `Next update date` = son gün + 2 gün (**açıq sual**, §8).
- "Yenilə" düyməsi + 15 dəq avto-yeniləmə.

### 5.2 SALES OVERVIEW (CRM: Müraciət/Trafik/Sales)
- **Filtrlər**: Tarix (popover: presetlər `Bütün dövr, Son gün, Son 7/30/90 gün, Bu ay, Keçən ay, Bu rüb, Bu il, Keçən il` — datadakı son günə nisbətən; ay şəbəkəsi, 2 kliklə aralıq, il düyməsi, dəqiq tarixlər, Sıfırla/Bağla/Tətbiq et), Brend, Model, Növ (axtarışlı, tək seçim). Seçilmiş filtrlər çip kimi; "Sıfırla".
- **6 KPI**: Total Trafik · Total Satış · Conversion Rate (= Satış ÷ Trafik, 2 onluq) · Total Müraciət · Total Satış from Marketing · Total Traffic from Marketing.
  - Marketinq tagları (böyük/kiçik hərf fərqsiz): `Facebook, Instagram, Whatsapp, Tiktok, Call, Call Center, Sosial Şəbəkə, Changan.az, Skoda.az, Avatr.az, İnternet, Youtube, Google, Tv`.
  - Satış from Marketing = Növ=Sales və `Satış kanalı` siyahıda; Traffic from Marketing = Növ=Trafik və `Haradan Gəlib` siyahıda.
- **6 Looker tipli kart** (6 sütun yanaşı; heatmap xanası; səhifədə 100 sətir; "Təmizlə"): Type(Növ) · Brand · Model split (axtarışlı) · Channel split(Kanal) · Sales channel(Satış kanalı) · Traffic channel(Haradan Gəlib).
  - Hər kartda **tək seçim** (yeni klik köhnəni əvəz edir, təkrar klik götürür); kartların seçimləri AND ilə birləşir.
  - **Çarpaz filtr semantikası**: kart *i*-nin sayları bütün filtrlərdən keçən sətirlər + **yalnız öz filtrindən** keçməyən sətirlərdən hesablanır (Looker/crossfilter qaydası — template-dəki `compute()`).
  - Type kartının altında "Keçid nisbətləri": Müraciət→Trafik, Trafik→Satış, Müraciət→Satış.
- **Qrafik "Daily live data tracking"**: göstərici `Hamısı/Müraciət/Trafik/Satış`; detallıq `Gün/Həftə(bazar ertəsindən)/Ay`; qrafik başlığında axtarışlı Brend filtri (ana Brend filtri ilə sinxron); `Bazarla müqayisə`; `Cədvəl`; `Sıfırla`.
  - Brush (sürüşdürmə) → tarix aralığı. Nöqtəyə klik → tarix filtri həmin gün/həftə/aya, avtomatik günlük rejim; eyni dövrə təkrar klik → əvvəlki aralıq/rejim.
  - **Bazarla müqayisə** (aylıq): mavi xətt = CRM satışı (Növ=Sales, bütün ana filtrlər); narıncı qırıq xətt = bazar. Bazar xətti ana Brend/Model filtrinə tabedir (ad `norm` ilə uyğunlaşır); filtr yoxdursa default "bizim brendlər", "Bütün bazar" düyməsi ilə bütün bazar. Brend/model bazarda yoxdursa qeyd, xətt yoxdur. Tooltip: bizim satış, bazar, bazar payımız.

### 5.3 MARKET SHARE ANALYSIS (Market Sales Split + CRM rəsmi satış)
- **Sol qrup "Müqayisə edilən brend / model"**: Brend (qruplar: `Bizim brendlər (7)` — default, `Bütün brendlər`; sonra 32 brend, bizimkilər "BİZ" nişanı), Model; altında sarı **Satış növü** filtri.
- **Sağ qrup "Rəqib brend / model"**: Rəqib brend (`Bütün rəqib brendlər` — default, `Bütün brendlər`, sonra hər brend), Rəqib model; altında sarı **Satış növü** filtri + Sıfırla.
- **Satış növü** (hər tərəf ayrıca): `Total` (bazar) | `Rəsmi` (CRM Növ=Sales, həmin brend/model/ay; adlar `norm` ilə uyğunlaşır) | `Grey` (= max(0, bazar − rəsmi)). "Rəsmi / Grey" seçimi **yoxdur**.
- **Dövr** popover: `Bütün dövr, Son ay, Son 3 ay, Son 6 ay, Bu il, Keçən il` + ay şəbəkəsi, 2 kliklə aralıq, il, Sıfırla, Bağla.
- **Ölçü**: `Bazar payı %` (yalnız faizlər) | `Satış sayı` (yalnız ədədlər) — qarışmır.
- **Məxrəc**: hər iki tərəf Grey → 100% = **grey bazar** (bütün bazar − bütün rəsmi satışlar); qalan bütün hallarda 100% = **bütün bazar**. Qalan hissə: Total/Total → "Digər brend/modellər"; Grey/Grey → "Digər brend/modellər (grey)"; qarışıq → "Bazarın qalanı" (≤0.05% olanda gizlənir).
- Rəsmi datası olmayan tərəf: Rəsmi → 0, Grey → bazarın hamısı; sarı xəbərdarlıq.
- KPI (pay): sol tərəf %, rəqib %, Fərq (`+/-x.x%`, **pp yox**), Digər/Bütün bazar, Ən yüksək pay (ay), Ən aşağı pay (ay). KPI (say): sol, rəqib, fərq, bütün/grey bazar, ən yaxşı ay, rəqibin ən yaxşı ayı.
- Pay zolağı (100%), aylıq xətt qrafiki (sol=mavi, rəqib=narıncı), aya klik → göstəricilər həmin aya ("ayı götür"), cədvəl görünüşü, Sıfırla düymələri.

### 5.4 STOCK OVERVIEW (Real Stock)
- Filtrlər: brend tabları (Sheet-dəki ardıcıllıqla), axtarış (model/versiya), il, süzgəc (`Hamısı / Stokda var / Hədəfi olan / Hədəfdən geri`), sıralama (`Hədəf %` default, Real Stok, Hədəf, Satış, Qiymət, Ad), Sıfırla.
- 6 KPI: Hədəf · Actual Satış · Hədəf % · Beh sayı · Stok sayı · Real Stok.
- Cədvəl sütunları: **Model · İl · Nağd qiymət · Faiz · İlkin ödəniş · Müddət · Aylıq ödəniş · Stok · Real Stok · Hədəf · Satış · Beh · Hədəf %** (meter). Hər brendin başında cəm sətri; model sətri (min il, min qiymət/ilkin/aylıq, faiz aralığı, müddətlər, cəmlər) → klik → versiyalar → versiyaya klik → bütün sahələr + Qeyd.
- Cədvəl öz konteynerində sürüşür (max 72vh), başlıq sticky; "Real Stok — ilk 10 model" paneli (≥1700px sağda, dar ekranda altda).

### 5.5 Dizayn
IBM Plex Sans + IBM Plex Sans Condensed; açıq/qaranlıq rejim tokenləri; qara başlıq zolağı; kateqorik rənglər `--s1…--s8`; tək ox, 2px xətt, hər qrafikdə tooltip və cədvəl görünüşü. Rəqəm formatı `229,687` (en-US), ay adları Azərbaycan dilində. Bütün tokenlər template-in `:root` blokundadır.

## 6. Qəbul testləri (yeni sistem eyni datada eyni rəqəmləri verməlidir)

| Yoxlama | Gözlənilən |
|---|---|
| Main Data (23–28.09) | 229,687 sətir · Müraciət 200,016 · Trafik 25,980 · Satış 3,691 |
| Marketinq | Satış from Marketing 398 · Traffic from Marketing 5,890 |
| Bazar | 21,610 sətir |
| Bazarla müqayisə (yan–avq 2026) | bizim brendlər CRM 1,241 / bazar 12,476 → 9.9% · Changan 946 / 11,780 → 8.0% · Changan UNI-Z 190 / 3,681 → 5.2% |
| Market Share (bütün dövr) | Total/Total 57.7% / 42.3% (bizim: rəsmi 5.7% / grey 52.0%) · Grey/Grey 55.2% / 44.8% (grey bazar 20,369 = 21,610 − 1,241) · Changan Rəsmi vs Changan Grey 4.4% / 50.1%, qalan 45.5% · Changan UNI-Z 17.0% vs BYD 15.1%, digər 67.8% |
| Real Stock (25.09.2026) | 53–54 sətir · 31 model · Hədəf 337 · Satış 160 · Beh 101 · Stok 686 · Real Stok 418 |

(Sheet yenilənibsə rəqəmlər dəyişə bilər — müqayisə eyni snapshot üzərində aparılmalıdır.)

## 7. Mərhələlər

0. **Hazırlıq (istifadəçi)**: GitHub-da boş private repo `sr-reporting`; Vercel hesabı (GitHub ilə). Vercel Hobby planı qeyri-kommersiya üçündür — şirkət istifadəsi üçün Pro (~20 $/ay) lazım olacaq.
1. **Skelet + Login**: Next.js layihəsi, Postgres, `users` cədvəli, `/login`, session, ilk admin (istifadəçinin özü), admin üçün istifadəçi idarəsi, Vercel-də test linki.
2. **Data körpüsü**: Google Cloud servis hesabı (istifadəçiyə addım-addım izah olunacaq), Sheet yalnız servis hesabı ilə paylaşılır; sync job (15 dəq) → Main Data + Real Stock oxunur, §4.3 qaydaları tətbiq olunur, DB-yə yazılır; sync loqu; Real Stock snapshot-ları tarixi ilə saxlanılır.
3. **Analytics səhifəsi**: §5 birə-bir; data yalnız auth-lu API-dən; §6 testləri.
4. **İstifadəçi yoxlaması**: köhnə və yeni panel yan-yana; düzəlişlər; istifadəçilərin əlavəsi.
5. **Domen + canlı**: domen seçimi, IT-yə DNS qeydi, HTTPS; Sheet-in açıq link paylaşımı bağlanır.

İş axını: istifadəçi istəyi yazır → Claude kodu dəyişir, test edir, GitHub-a push → Vercel test linkini yeniləyir → istifadəçi təsdiq edir.

## 8. Açıq suallar (3-cü mərhələyə qədər cavab lazımdır)

1. **"Bizim brendlər" 7-dir, yoxsa 8?** Template-də `ourBrands` = Changan, Lynk & Co, Mercedes, Skoda, Xpeng, Avatr, Leap, Deepal (8), UI-da isə "(7)" yazılıb.
2. **"Next update date"** — köhnə qayda (son data günü + 2) qalsın, yoxsa real son sync vaxtı göstərilsin?
3. **"Yenilə" düyməsi** — hər istifadəçiyə, yoxsa yalnız adminə?
4. (Sonra) Domen adı və DNS-i kim idarə edir; CRM datasının əsl mənbəyi (Sheet-ə haradan gəlir, CRM-in API-si varmı).

## 9. Bilinən məhdudiyyətlər / qeydlər
- Digər brendlərin rəsmi (CRM) satış datası hələ Main Data-da yoxdur — gələndə Rəsmi/Grey avtomatik işləməlidir (istənilən brend üçün).
- Changan bazar rəqəmi (11,780) CRM rəsmi satışından (946) xeyli böyükdür — grey payı böyükdür; bu mənbə fərqidir, səhv deyil.
- Real Stock başlıqları vaxtaşırı dəyişir — parser alias-larla işləməli, tanınmayan başlıqda sync loqunda xəbərdarlıq verməlidir.
