# SR Auto dashboard — "yenilə" qaydası

Mənbə: Google Sheet **“data baza”** — vərəqlər: **Main Data** (gid=0), **Real Stock**, **Market Sales Split**
`1epakBxb8J4NxdN7yFrq_6VeNPynD9m6j-gEPfrFugP8`, “Linki olan hər kəs — baxa bilər”.
Sütunlar: Date (d-Mon-yy), Brend, Model, Növ (Müraciət/Trafik/Sales/Market Sales Split), Kanal, Müraciət növü, Haradan Gəlib, Satış kanalı, Cash/Credit.
Artifact: “SR Auto Satış Paneli” (claude.ai artifact, URL sabit: https://claude.ai/artifact/L7PEHNVyFg6kqy2bUVteS4). HTML fayl (SR_Auto_Dashboard.html) Sheet-i açılanda özü canlı oxuyur.
HTML faylda yuxarıda görünən **Yenilə** düyməsi var: bir kliklə Main Data + Real Stock + Market Sales Split yenidən oxunur (Claude lazım deyil); səhifə açıq qalanda hər 15 dəqiqədən bir özü də yeniləyir (CFG.autoRefreshMinutes).

Fayllar: `claude/sr_dashboard_template.html` (səhifə, `__DATA__` yeri), `claude/sr_dashboard_build.py`, `claude/sr_dashboard_browser_pack.js`.

## Niyə belə
- Google Drive konnektoru 10 MB-dan böyük Sheet-i export etmir (CSV ~12.6 MB) → konnektorla oxumaq olmur.
- Konteyner Google-a çıxa bilmir; Chrome eklentisi uzun nəticəni kəsir və URL parametrli çıxışı bloklayır.
- İşləyən yol: Chrome-da (Sheet açıq linklidir) datanı cəmləyib kompakt payload hazırlamaq → `get_page_text` ilə 4 hissədə oxumaq (browser_batch nəticəsi fayla yazılır) → konteynerdə birləşdirmək.
- **Şablon faylı (28.09.2026, patch6):** `sr_dashboard_template.html` tam HTML sənədidir (doctype/head ilə) və build.py onu birbaşa oxuyur (`template.html` yoxdursa `sr_dashboard_template.html` götürülür, `<body>` içi çıxarılır). Build-siz açılanda (`__DATA__` doldurulmayıb) səhifə çökmür: data Google Sheet-dən canlı yüklənir (Sheet “linki olan hər kəs” rejimində olmalıdır); alınmasa KPI yerində aydın izah və həll yolu göstərilir, digər bölmələr gizlənir. GitHub Pages üçün build-in `*_standalone.html` çıxışı (və ya hazır `SR_Auto_Dashboard.html`) `index.html` kimi qoyulur. Canlı oxuma alınmayanda snapshot bildirişi 10 saniyəyə bağlanır və mənbə “snapshot” göstərilir.
- **Ən sadə yol (28.09.2026):** istifadəçi bütün vərəqlərin mətn exportunu göndərir (`data_baza.txt` — hər vərəq `## Sheet name: Main Data` / `## Sheet name: Real Stock` başlığı ilə CSV kimi). `python3 sr_dashboard_build.py --export data_baza.txt <modifiedTime> sr-dashboard.html` — ana data, Market Sales Split (Main Data-dakı Növ=Market Sales Split sətirlərindən aylıq cəmlənir → `market_split.csv`) və Real Stock (→ `real_stock.csv`) hamısı bir addımda yenilənir. 28.09.2026 exportu 24–25.09 snapshot-u ilə tam eyni çıxdı (229,687 CRM sətri, 21,610 bazar sətri, Real Stock 54 sətir) — dəyişiklik olmadı.
- Alternativ (yalnız template dəyişəndə, data eyni qalanda): `Artifact read` ilə dərc olunmuş səhifəni oxu → `dash-data` JSON-unu çıxar → `python3 sr_dashboard_build.py --json data.json sr-dashboard.html` (24.09.2026-da belə edildi).

## Addımlar
1. `get_file_metadata` → `modifiedTime` (Last update date üçün).
2. Chrome: yeni tab → `https://example.com` → `sr_dashboard_browser_pack.js` məzmununu işlət, amma nəticəni qaytarmaq əvəzinə `window.__srpack`-da saxla və yalnız qısa xülasə qaytar (URL-siz!).
3. Payload-u səhifəyə 44 000 simvolluq hissələrlə yaz: `HEAD {start,ndays,n,records,skipped,dims}\nBLOB\n<base64url, 120 simvolluq sətirlər>`; `window.__srshow(k)` hər hissəni `<pre id=srpayload>` içində `SRCHUNK-k-BEGIN … SRCHUNK-k-END` kimi göstərir.
4. Bir `browser_batch`: hər k üçün `javascript_tool(__srshow(k))` + `get_page_text` → nəticə tool-results JSON faylına yazılır.
5. Konteynerdə: hissələri regex ilə çıxar, birləşdir, base64url → base64, gzip açıb `len == n*11` və Növ cəmlərini yoxla, `payload_full.json` yaz (`{start,ndays,n,records,skipped,dims,blob}`).
6. `python3 sr_dashboard_build.py --payload payload_full.json <modifiedTime> "data baza" sr-dashboard.html` → artifact-ı eyni URL ilə yenidən dərc et (`url` parametri); `sr-dashboard_standalone.html`-i `SR_Auto_Dashboard.html` adı ilə istifadəçiyə göndər.
7. Test üçün xlsx-dən build: `python3 sr_dashboard_build.py --xlsx test_data.xlsx out.html` (Növ=Market Sales Split sətirləri avtomatik `mk` lövhəsinə gedir, ana panelə düşmür).

## Real Stok lövhəsi (ikinci board)
Vərəq: **Real Stock** (gviz `sheet=Real Stock` ilə oxunur; HTML fayl açılanda özü yeniləyir).
Sütunlar: Brend adı, Model adı, Model növü, İstehsal ili, Nağd qiymət, Faiz, İlkin ödəniş, Müddət, Aylıq ödəniş, Stok sayı, Real Stok, Hədəf, Actual Satış, Beh Sayı, Qeyd.
- Brend adı və Model adı yalnız qrupun ilk sətrindədir → yuxarıdan doldurulur; qalan sətirlər həmin modelin versiyalarıdır (Model növü).
- Cədvəl sütunları (25.09.2026): Model · İl · Nağd qiymət · **Faiz** (ilkin ödəniş faizi) · **İlkin ödəniş** · **Müddət** (kredit ayı) · **Aylıq ödəniş** · Stok · Real Stok · Hədəf · Satış · Beh · Hədəf %. Qrup başlığı: minimal il, minimal qiymət/ilkin/aylıq, faiz (fərqlidirsə aralıq), müddət, Stok/Real Stok/Hədəf/Satış/Beh cəmləri, Hədəf % meter. Cədvəl genişdir — “ilk 10 model” paneli 1700px-dən dar ekranda cədvəlin altına keçir. Cədvəl öz konteynerində sürüşür (max 72vh), başlıq sətri sabit qalır (sticky). Açılanda versiyalar; versiyaya klik → bütün sahələr + Qeyd (ayrıca sütun kimi yox).
- Filtrlər lövhəyə məxsusdur: brend, axtarış, il, süzgəc (stokda var / hədəfi olan / hədəfdən geri), sıralama.
- Sıralama həmişə brend üzrə qruplaşır: brendlər Sheet-dəki ardıcıllıqla (Changan, Lynk&Co, XPENG, AVATR, SKODA), brend daxilində seçilmiş meyar (default: Hədəf % yuxarıdan aşağı). Hər brendin başında öz cəmləri olan başlıq sətri var.
- Qiymət parseri həm "28,900.00 ₼", həm "65.900.00 ₼" yazılışını oxuyur; Müddət "48 ay/60 ay/Cash" kimi normallaşır.
- Yoxlama (23.09.2026): 60 sətir · 38 model · Hədəf 332 · Satış 137 · Beh 125 · Stok 700 · Real Stok 459.
- Yoxlama (25.09.2026, Sheet 13:04 UTC): 53 sətir · 31 model · Hədəf 337 · Satış 160 · Beh 101 · Stok 686 · Real Stok 418. Başlıqlar dəyişib: “Real stok”, “Actual satış”, **“Beh”** (əvvəl “Beh Sayı”), “Qeyd” sütunu yoxdur — parser (template RS_ALT, build.py _norm) hər iki yazılışı oxuyur.
- Real Stock-u tez oxumaq yolu: daxili brauzerdə `…/gviz/tq?tqx=out:html&sheet=Real%20Stock` aç (docs.google.com üçün icazə lazımdır), `javascript_tool` ilə `table tr` sətirlərini JSON kimi götür → `real_stock.csv` yaz → `python3 sr_dashboard_build.py --json artifact_data.json <modifiedTime> sr-dashboard.html` (artifact_data.json = dərc olunmuş səhifənin `dash-data` JSON-u; real_stock.csv varsa `rs` avtomatik əvəz olunur). Google Drive konnektoru bu faylı export edə bilmir (sessiya düşür).
- Snapshot üçün: `real_stock.csv` faylı build qovluğunda olmalıdır, `--payload` rejimi onu avtomatik oxuyur.

## Bazarla müqayisə (əsas qrafikdə, 25.09.2026)
Qrafik başlığında **Brend** filtri (axtarışlı, ana paneldəki Brend filtri ilə eyni vəziyyət — kartlar, KPI-lar da dəyişir) və **“Bazarla müqayisə”** düyməsi:
- Aylıq rejim; **mavi xətt = bizim CRM satışı** (Növ=Sales, bütün ana filtrlər), **narıncı qırıq xətt = Market Sales Split**; hər iki xəttin üstündə rəqəmlər (toqquşanda bazar rəqəmi aşağı sürüşür).
- Bazar xətti ana Brend/Model filtrinə tabedir: brend seçilibsə həmin brendin bazarı, model seçilibsə həmin modelin (ad normallaşdırılıb müqayisə olunur — CRM və bazar model adları üst-üstə düşür: UNI-Z, Q07, X5 Plus, CS55, Lynk900…). Filtr yoxdursa bazar xətti **bizim 7 brendin cəmi**; “Bütün bazar” düyməsi ilə bütün bazara keçir. Brend/model bazar datasında yoxdursa qeyd yazılır, xətt çəkilmir.
- Tooltip: bizim satış, bazar, bazar payımız. Cədvəl rejimi: ay × (satış | bazar | pay).
- Yoxlama (yan–avq 2026): 7 brend CRM 1,241 vs bazar 12,476 → 9.9%; Changan 946 / 11,780 → 8.0%; Changan UNI-Z 190 / 3,681 → 5.2%.
- Köhnə variantlar (brend paneli ilə 7 brendin xətləri, “brend panelləri”, biz-vs-rəqiblər sütunlu lövhə, brend çipləri, top-model kartları, brend cədvəli) 25.09.2026-da istifadəçinin istəyi ilə çıxarıldı.

## Market Share Analysis (ikinci bölmə, 25.09.2026 — v4)
Vərəq: **Market Sales Split** — gviz sorğusu ilə cəmlənmiş: `select A, B, C, count(A) where D = 'Market Sales Split' group by A, B, C` → Date(ay), Brend, Model, say. Ana panel gid=0-dan oxunur; buildFromCSV və build.py `Market Sales Split` sətirlərini ana datadan atır (SKIP_NOV / MARKET_NOV).
- Filtrlər (axtarışlı, tək seçim): **Brend** — qrup seçimləri “Bizim brendlər (7)” (default) və “Bütün brendlər”, sonra bütün 32 brend (bizimkilər BİZ nişanı ilə); **Model** — seçilmiş brendin (ya qrupun) bütün bazar modelləri; **Rəqib brend** — “Bütün rəqib brendlər” (default), “Bütün brendlər”, sonra hər brend; **Rəqib model**; **Dövr** (presetlər + ay aralığı + Sıfırla); ölçü **Bazar payı % | Satış sayı**; satış növü **Total | Rəsmi | Grey**; Sıfırla.
- **Pay tərifi:** pay = tərəf ÷ bütün bazar (həmin ay / seçilmiş dövr). Zolaq: [sol tərəf] + rəqib + “Digər brend/modellər” = 100%; sol tərəf bizim brend(lər)dirsə zolaq rəsmi (dolu mavi) və grey (ştrixli mavi) hissələrinə bölünür. Biz (7) vs bütün rəqib brendlər seçiləndə “digər” yoxdur.
- **Satış növü — hər tərəf üçün ayrıca filtr (28.09.2026 v6):** sol qrupda `fb-mkSrcL` (müqayisə edilən brendin altında), sağ qrupda `fb-mkSrcR` (rəqib brendin altında, yanında Sıfırla); sarı rəngli açılan filtrlər, seçimlər **Total | Rəsmi | Grey** (hər seçimin altında qısa izah; “Rəsmi / Grey” seçimi yoxdur — brend daxilində bölgü üçün hər iki tərəfə eyni brend seçilib bir tərəfə Rəsmi, o birinə Grey verilir). Rəsmi = CRM (Növ=Sales) həmin brend/modelin həmin aydakı satışı (adlar normallaşdırılaraq uyğunlaşdırılır; istənilən brend üçün işləyir). Grey = bazar − rəsmi (mənfi olarsa 0).
  - Məxrəc: **hər iki tərəf Grey olanda 100% = grey bazar (bütün bazar − bütün rəsmi satışlar)**, digər bütün kombinasiyalarda 100% = bütün bazar. Qalan hissə: Total/Total → “Digər brend/modellər”, Grey/Grey → “Digər brend/modellər (grey)”, qarışıq → “Bazarın qalanı”.
  - Rəsmi datası olmayan tərəf Rəsmi seçiləndə 0 sayılır, Grey seçiləndə bazar satışının hamısı grey sayılır; sarı xəbərdarlıq (`#mkWarn`) çıxır. Qrafik başlığı: “Aylıq bazar payı — rəsmi / grey” (tərəflərin növləri).
- Yoxlama (bütün dövr): Total/Total 57.7% / 42.3%; Grey/Grey 55.2% / 44.8% (grey bazar 20,369 = 21,610 − 1,241); Changan Rəsmi vs Changan Grey: 4.4% / 50.1%, bazarın qalanı 45.5%.
- Fərq faizlə (%), pp yox. Qrafikdə aya klik → göstəricilər həmin aya görə; “ayı götür”. Cədvəl: ay × (sol tərəf [+ rəsmi, grey] | rəqib | fərq | digər / bütün bazar).
- Görünüşlər qarışmır: pay görünüşündə yalnız faizlər, say görünüşündə yalnız ədədlər.
- Yoxlama (bütün dövr): bizim 7 brend 57.7% (rəsmi 5.7% / grey 52.0%) vs rəqiblər 42.3%; Changan UNI-Z 17.0% (rəsmi 0.9% / grey 16.2%) vs BYD 15.1%, digər 67.8%.
- Diqqət: Changan bazar rəqəmi (11,780) CRM rəsmi satışından (946) xeyli böyükdür — grey bazar payı böyükdür; mənbə fərqi rəhbərliyə izah edilməlidir.

## Səhifə strukturu (25.09.2026)
Sıra: **SALES OVERVIEW** (CRM) → **MARKET SHARE ANALYSIS** (Market Sales Split) → **STOCK OVERVIEW** (Real Stock). Hər bölmənin başında qara fonlu `.sec-head` başlığı var: böyük şriftlə bir ad + kiçik alt-yazı (mənbə vərəqi · məzmun); sətir sayı / snapshot kimi texniki mətnlər yazılmır (gizli span-larda qalır). İzahat mətnləri (brush-hint, mk-note, footer-dəki marketinq tag siyahısı) production üçün çıxarılıb; yalnız xəbərdarlıq (məs. “Bazar datasında bu model yoxdur”) qrafik altında görünür. Build: `patch3.py` → `patch4.py` (template.orig.html-dən) — proyektdəki `sr_dashboard_template.html` artıq hazır nəticədir.

## Əsas qrafikdə klik (25.09.2026)
Qrafikdə nöqtəyə (gün/həftə/ay) klik → tarix filtri həmin dövrə qoyulur (bütün panel: KPI, kartlar ona görə); həftə/ay və ya “Bazarla müqayisə” rejimindəydisə avtomatik günlük rejimə keçir ki, seçilmiş dövrün günlük canlı datası görünsün. Eyni dövrə təkrar klik əvvəlki aralığa/rejimə qaytarır (S.clickPrev). Sürüşdürmə (brush) əvvəlki kimi aralıq seçir.

## Sıfırla düymələri (25.09.2026)
Hər filtr qrupunun və qrafikin yanında kiçik `.rst` düyməsi: ana filtrlər (`resetMain` — tarix/brend/model/növ), əsas qrafik (`resetChart` — göstərici, detallıq, müqayisə, cədvəl, tarix), Market Share filtrləri (`mkReset`) və qrafiki (`mkChartReset` — seçilmiş ay, ölçü, cədvəl), Real Stok (`rsReset`). Tarix pəncərələrinin içində də Sıfırla var. Build sırası: `patch3.py` → `patch4.py` → `patch5.py`.

## Qaydalar (səhifədə)
- Hər kartda/filtrdə tək seçim; fərqli kartların seçimləri birləşir.
- Yazılış variantları birləşir (E CLASS = E Class); kanal sütunu öz Növ-ündə boşdursa “(boş)”.
- Conversion = Satış ÷ Trafik.
- “from Marketing” tagları (istifadəçi, 23.09.2026; böyük/kiçik hərf fərq etmir): Facebook, Instagram, Whatsapp, Tiktok, Call, Call Center, Sosial Şəbəkə, Changan.az, Skoda.az, Avatr.az, İnternet, Youtube, Google, Tv. (Other və Təkrar 23.09.2026-da istifadəçi tərəfindən çıxarıldı.) Traffic from Marketing = Növ=Trafik və Haradan Gəlib siyahıda; Satış from Marketing = Növ=Sales və Satış kanalı siyahıda. Kənarda qalanlar: Other, Təkrar, Personal Referral, Street Traffic, Turbo.az, Old Customer, Qarabağ FK, AutoMall, Badamdar Dillər.
- Yoxlama (23.09.2026): Satış from Marketing 398 · Traffic from Marketing 5,890.
- Yoxlama (23.09.2026): Main Data 229,687 sətir · Trafik 25,980 · Satış 3,691 · Müraciət 200,016.
- Qrafik qaydaları (dataviz): tək ox, kateqorik rənglər sabit sırada (--s1…--s8, validator keçib), 2px xətt, rəqəmlər seçmə, hər qrafikdə hover/tooltip və cədvəl görünüşü.
