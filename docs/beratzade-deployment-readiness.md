# BERATZADE POS - dağıtım öncesi doğrulama

Bu çalışma yalnızca `pos-beratzade-integration` içindeki yerel hazırlıktır. Push, merge, deploy veya üretim migration işlemi yapılmadı. `origin` reposuna değişiklik gönderilmedi; `pos-master` kullanılmadı.

## Git durumu ve gönderim planı

- Backend hazırlık commit'i: `1fe51c5a54411dae7b216d1045865e4a4c6cbcf6`, yerel `development` dalında.
- GitHub `beratzade/integrate/beratzade-pos`: `df8a9e0d00b1bbcb15880f0e056d1f1f7e86d61c`. Beratzade reposunda `development` dalı bulunmuyor.
- Hedef repo yalnızca `novanestnn-bit/beratzade`. `origin` farklı bir repodur; push hedefi yapılmamalıdır.
- Bu aşamadaki hazırlıklar aynı yerel geliştirme dalında ayrı bir commit olarak saklanır. Entegrasyon dalı değiştirilmez.

Onay sonrası önerilen sıra:

1. Render/Vercel hesaplarında mevcut Git bağlantıları ve otomatik dağıtım ayarları okunup doğrulanır. Otomatik dağıtım kapalı olduğundan emin olmadan push yapılmaz.
2. `git fetch beratzade` ile hedef tekrar kontrol edilir. Hedef ilerlemişse farklar yeniden değerlendirilir; force push kullanılmaz.
3. Ayrı onayla yerel `integrate/beratzade-pos` dalı geliştirme dalına `--ff-only` ilerletilir. Mevcut zincirde cherry-pick veya merge commit'i gerekmez.
4. Ayrı onayla yalnızca `git push beratzade integrate/beratzade-pos` yapılır.
5. Üretim şeması ve yedek kontrolünden sonra migration içeren Render dağıtımı, ardından WS ve Vercel dağıtımı açıkça onaylanır.

## Giderilen engeller

- Önceki PostgreSQL URL, enum/f405 ve güvenli migration başlangıcı düzeltmeleri doğrulandı.
- Tam backend testlerindeki bağımlı test verileri giderildi: müşteri ekranı testleri kendi tenant/masasını oluşturuyor; nakit ödeme testleri geçerli kasa oturumu açıyor. Kasa zorunluluğu kaldırılmadı.
- Hızlı satış ve gel-al siparişlerinin listede `Unknown` görünmesi düzeltildi. Siparişi oluşturan personel adı tenant kapsamlı tek sorguyla ekleniyor.
- `/users/me`, mevcut güvenli `UserResponse` modeliyle filtreleniyor; parola özeti, token sürümü ve OTP iç alanları istemciye dönmüyor. Anonim kullanıcı için mevcut `200 null` davranışı korunuyor.
- Production frontend'in açıkça verilen HTTPS API/WSS hostlarını zorla mevcut hosta çevirmesi düzeltildi. HTTPS sayfalarda güvensiz ve kimlik bilgisi içeren URL'ler reddediliyor.
- Vercel static build ve route dosyası eklendi. `/api` Render backend'e yönlendiriliyor; böylece oturum çerezleri tarayıcıda aynı origin üzerinden kullanılıyor. `Secure`, `HttpOnly` ve `SameSite=Lax` gevşetilmedi.
- WebSocket için bağımsız Render Dockerfile ve `PORT` destekli başlangıç eklendi. URL token'larını gösterebilen istek/header logları kaldırıldı. Production servisinde SECRET_KEY, açık CORS listesi, API_URL ve REDIS_URL zorunlu; health Redis'i kontrol ediyor.
- Docker build context'lerinden env/secrets, yerel bağımlılık ve upload dosyaları hariç tutuldu.
- Kopyalanmış eski sunucu deploy workflow'u Beratzade reposunda çalışmayacak şekilde repo koşuluyla sınırlandı.

## Yerel doğrulama sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Tam backend paketi | 556/556 geçti; son backend Docker imajının içinden çalıştırıldı |
| Angular Karma/ChromeHeadless | 18/18 geçti |
| Frontend dağıtım ayar testleri | 8/8 geçti |
| WebSocket servis testleri | 7/7 geçti; Uvicorn handshake log filtresi dahil |
| Angular `production-static` build | Başarılı, `dist/front/browser` üretildi |
| Backend Docker build | Başarılı; son kaynaklar imaja dahil edildi |
| Bağımsız WS Docker build | Başarılı |
| HTTPS browser smoke | Müşteri kategori menüsü, direkt URL/yenileme, 360/390/768/1440 genişlik, anonim erişim engeli, personel POS, admin yetkileri, Secure/HttpOnly/Lax çerez, kimlik doğrulamalı WS handshake ve Redis sipariş mesajı başarılı |
| Uvicorn gerçek handshake logu | Ham log gösterilmeden denetlendi; token maskelemesi başarılı |
| Browser çalışma/ağ hataları | Kontrol edilen yerel origin'de beklenmeyen hata yok |

Production build mevcut bağımlılıklarla temiz bir konteyner dizininde çalıştırıldı; host kurulumu yapılmadı. Chrome konteynerde bulunmadığı için Angular birim testleri ve headless browser testi mevcut host Chrome ile yalnızca entegrasyon klasöründen çalıştırıldı. Backend/WS build kurulumları yalnızca Docker içindedir.

İlk tam backend çalıştırmasındaki 7 hata düzeltildi; başarısız sonuçlar geçilmiş gibi sunulmadı. İlk frontend doğrulaması, eski imajda kalmış geliştirme dosyaları ve network kapalı build nedeniyle başarısızdı; temiz kaynak diziniyle gerçek production build başarılı oldu. Browser testindeki ilk ürün beklentisi mevcut kategori ekranına uyarlandı; WS kontrolü gerçek zamanlı bağlantıyı kullanan sipariş ekranında yapıldı.

Mevcut uyarılar: Angular şablonlarında gereksiz optional-chain uyarıları, menü SCSS warning bütçesi (42.14 kB / 40 kB; error sınırının altında), `dijkstrajs` CommonJS uyarısı; backend test bağımlılıklarından Starlette/httpx deprecation uyarıları. Bunlar derleme/test hatası değildir; bütçeler gevşetilmedi.

Log kontrolü sırasında Uvicorn'un `access_log=False` olsa da WebSocket handshake URL'sini yazdığı görüldü; yalnızca izole test token'ı çıktı. Gerçek üretim sırrı kullanılmadı. Uvicorn error/access loglarına ve uygulama handler'larına sorgu/masa-token maskelemesi eklendi. Son doğrulama ham logları göstermeden maskelemenin gerçek handshake üzerinde çalıştığını doğruladı.

Tekrarlanan browser testleri yerel production giriş limitine ulaştığında HTTP 429 doğrulandı. Limit ayarı gevşetilmeden, yalnızca izole test Redis'indeki `LIMITS:*` sayaçları temizlendi; son akış bu koşullarda yeniden başarılı oldu. PostgreSQL veya üretim Redis verisi temizlenmedi.

## Render ayarları

Kullanıcının verdiği API adresi: `https://beratzade.onrender.com`.

- Repo/dal: `novanestnn-bit/beratzade`, `integrate/beratzade-pos`.
- Root Directory `back` seçilirse Dockerfile `./Dockerfile`, context `.` olmalıdır. Repo kökünden yapılandırılırsa Dockerfile `./back/Dockerfile`, context `./back` olmalıdır. Bu iki yolu karıştırmayın.
- CMD: `python -m app.start`; `0.0.0.0:$PORT`, reload kapalı.
- Health: `/health/db`; `PRODUCTION=true`; backend doğrudan root'ta sunulduğundan `ROOT_PATH` boş.
- `DATABASE_URL`: mevcut PostgreSQL'in Internal URL değeri, aynı bölge/ağ. Gerçek değer yalnızca Render secrets içinde tutulmalı.
- Ayrı ve güçlü `SECRET_KEY`, `REFRESH_SECRET_KEY`; kesin Vercel origin'i için `CORS_ORIGINS`, frontend adresi için `PUBLIC_APP_BASE_URL`.
- API ve bridge aynı Redis'i, aynı JWT SECRET_KEY'i ve algoritmayı kullanmalı. `RATE_LIMIT_REDIS_URL` ortak limit depolamasını sağlar.
- Dosya yüklemeleri için kalıcı `/app/uploads` diski gerekir. Mevcut dosyalar yedeklenip taşınmadan yeni boş disk bağlanmamalı; aksi halde veritabanındaki görsel referanslarının dosyaları görünmeyebilir.
- Bridge ayrı servis: context `./ws-bridge`, Dockerfile `./ws-bridge/Dockerfile.render`, CMD `python start.py`, health `/health`. Public adresi belirlendikten sonra frontend `WS_URL` bu servisin `wss://.../ws` adresidir.

[Render şablonu](render-beratzade.yaml) yalnızca hazırlık belgesidir; hesapta uygulanmamıştır. Yeni DB oluşturmaz; mevcut DB bağlantısını secrets üzerinden bekler. Servis/disk/Redis kaynaklarının oluşturulması veya ücretli plan seçimi ayrıca onay gerektirir. Mevcut servisi körlemesine Blueprint'e taşımayın; önce mevcut servis ID/disk/bölge ayarlarını doğrulayın.

## Vercel ayarları

- Git repo: yalnızca Beratzade reposu. Production branch, onaydan sonra entegrasyon dalı olarak seçilmeli.
- Root Directory: `front`; Framework Preset: Other (`framework: null`); Node: 22.
- Install: `npm ci --ignore-scripts`.
- Build: `npm run build:vercel`; static output: `dist/front/browser`.
- `/api/...` rewrite hedefi: `https://beratzade.onrender.com/...`. API yanıtları private/no-store; API hataları SPA HTML'ine çevrilmez.
- `/` Beratzade ana sayfasına yönlenir. Statik dosyalar önce sunulur; login/personel/yönetim/müşteri deep link'leri `index.html` ile açılır.
- Tek Angular uygulaması korunur; üç ayrı frontend projesi yoktur.

Vercel build ortamı:

| Ad | Gereksinim |
| --- | --- |
| `WS_URL` | Zorunlu; gerçek bridge `wss://.../ws` adresi. Eksik veya güvensiz değer build'i durdurur. Yerel derleme testi yalnızca sentetik bir WSS adresi kullandı. |
| `STRIPE_PUBLISHABLE_KEY` | İsteğe bağlı, yalnızca public `pk_...` anahtarı. Secret key kabul edilmez. |
| `GOOGLE_ANALYTICS_MEASUREMENT_ID` | İsteğe bağlı public measurement ID |
| `API_URL` | Eklenmesi gerekmez; bu Vercel yapılandırması güvenli aynı-origin `/api` proxy'sini üretir. |

DB parolaları, JWT secret'ları, Stripe secret key veya Render token'ları frontend ortamına eklenmemelidir. Build script'i yalnızca public alanları runtime-config.js'ye aktarır; process.env nesnesini serileştirmez.

## Otomatik deploy riski

- `front/vercel.json` Git deployment'larını kapalı tanımlar. Mevcut projenin doğru root/config dosyasını kullandığı hesap üzerinden doğrulanmadıkça bu dosya tek başına güvence değildir.
- Render şablonunda `autoDeployTrigger: "off"` vardır; bu dosya mevcut hesabın ayarlarını değiştirmez. Render'daki mevcut Auto-Deploy ve Blueprint sync durumu doğrulanmadan push yapılmamalıdır.
- Eski GitHub sunucu deploy işi artık Beratzade reposunda çalışmaz. Başka mevcut webhook veya provider bağlantıları hesap erişimi olmadan dışlanamaz.

## Gerçek ortamda kalan engeller

1. Bu ortamdan Render `/health` ve `/health/db` çağrılarında yanıt alınamadı; son HTTP denemesi zaman aşımı/HTTP 000 verdi. Bu bulgu servisin neden yanıt vermediğini belirlemez. Render'ın gerçek logu ve servis ayarları incelenmeli.
2. Render/Vercel hesap bağlantıları henüz doğrulanmadı. Vercel proje/domain bilgisi ve mevcut bridge adresi verilmedi. Güvenli erişim için ilgili hesap bağlantıları kullanılmalı; sırlar sohbete yapıştırılmamalı.
3. Mevcut PostgreSQL schema/history, güncel yedek ve mevcut upload diski üretimde salt okunur incelenmeli. Başlangıç migration'ı üretimde kendiliğinden çalışacağından Render deploy onayı migration kapsamını açıkça içermeli.
4. Redis ve bridge yoksa oluşturulmaları/planları onaylanmalı; gerçek `WS_URL` girilmeli. Frontend'in gerçek WS adresi olmadan yayınlanması engellendi.
5. Gerçek Vercel edge rewrite, domain/HTTPS ve canlı login/refresh/WS kontrolleri ancak onaylı staging/production dağıtımı sonrasında doğrulanabilir. Yerel proxy testi bunun yerine geçmez.

## Hazırlık kararı

- GitHub gönderimi için kod ve yerel doğrulamalar hazır; entegrasyon dalının ilerletilmesi ve `beratzade` remote'una push için ayrı açık onay beklenir. Önce mevcut otomatik deploy ayarları doğrulanmalıdır.
- Render backend kaynakları ve Docker imajı hazır; gerçek servis/DB/yedek incelemesi ve migration dahil açık dağıtım onayı olmadan canlı işlem yapılamaz.
- Vercel frontend build'i ve route yapılandırması hazır; gerçek proje/domain, WS adresi ve sağlayıcı ayarları tamamlanmadan canlıya hazır ilan edilemez.

Kaynaklar: [Vercel configuration schema](https://openapi.vercel.sh/vercel.json), [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [Render Blueprint reference](https://render.com/docs/blueprint-spec), [Render deploys](https://render.com/docs/deploys), [Angular static deployment](https://angular.dev/tools/cli/deployment).
