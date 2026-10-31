# BERATZADE üç panel işlev doğrulaması

## Aynı restoran ve veritabanı

Tek Angular uygulaması ve aynı API korunur. Yönetim `/settings`, personel `/staff/pos`, sipariş takibi `/staff/orders`, mutfak `/kitchen`, rapor `/reports`, müşteri `/public-menu/:slug` ve masa QR `/menu/:token` adreslerindedir. Yönetim ve personel oturum gerektirir; public menü oturumsuzdur. Aktif masa siparişi masa PIN'iyle korunur.

`owner` tam yönetim yetkisine sahiptir. `admin` kullanıcı oluşturabilir/güncelleyebilir ancak hesap silme owner'a ayrılmıştır. Garson yönetim ayarlarına, kullanıcı yönetimine veya raporlara erişemez; mutfak sipariş kalemi durumunu değiştirebilir ancak POS satış veya tahsilat işlemi yapamaz. API izinleri ve route guard'ları ayrı ayrı sınanır.

## Yalnızca izole ortamda mutasyon yapan uçtan uca test

`front/scripts/test-three-panel-operations.mjs` üretim hostname'lerini reddeder. Sentetik verilerle ayrı owner/admin/garson/mutfak/müşteri tarayıcı bağlamları kullanır. Çalıştırma: `npm run test:three-panel-operations` (`front/` içinde).

Gerekli ortam isimleri: `BASE_URL` (yalnız localhost/127.0.0.1), `SMOKE_CREDENTIALS_PATH`, `PUPPETEER_EXECUTABLE_PATH`. Fixture JSON'unda `tenant_id`, `table_token`, `owner`, `admin`, `waiter`, `kitchen` alanları gerekir; hesap nesneleri yalnızca izole hesapların `email`/`password` alanlarını içerir. Fixture ve TLS anahtarları Git dışında tutulur; üretim hesabı veya token kullanılmaz. Test kendi geçici ürününü, personelini, kat/masasını yalnızca bu izole API'de oluşturur.

Doğrulanan akış:

1. Dört rol gerçek parola formundan giriş yapar; Secure/HttpOnly/SameSite cookie denetlenir.
2. Owner restoran ayarı, kategori/alt kategori, ürün ve fiyat değiştirir. Ürün yönetim UI'si ve public API aynı veriyi/fiyatı gösterir. Personel ve masa yönetimi UI/API birlikte kontrol edilir.
3. Garson/mutfak/müşteri için yetkisiz yönetim, rol yükseltme ve ödeme istekleri reddedilir; admin hesap silemez.
4. Garson POS ekranından yeni yerel masayı açar, ürün ekler ve siparişi gönderir.
5. Müşteri QR ekranından aynı ürünü ekler, gerçek test masa PIN'ini girer; siparişi aynı masa hesabına eklenir. Kalem sayısı ve toplam doğrulanır.
6. Mutfak ekranında aynı sipariş görülür; mutfak rolü hazırlık/hazır durumlarına geçirir, garson görüp teslim eder.
7. Parçalı nakit kaydı, aynı ödeme anahtarının tekrarında çoğalmama, POS ekranındaki terminal tahsilat düğmesi, sıfır kalan bakiye ve masa kapatma kontrol edilir. Gerçek banka/terminal işlemi tetiklenmez.
8. Owner raporunda satışın yansıması ve pasife alınan ürünün müşteri menüsünden kalkması kontrol edilir.
9. WebSocket bağlantı girişimi, sunucu 5xx ve tarayıcı çalışma hatası olmaması beklenir.

## Bulunan ve düzeltilen hatalar

- Redis ayarlanmamışken limiter varsayılan Redis bağlantısını deniyor ve ilk public istekte SlowAPI header hatasıyla 500 üretebiliyordu. Redis tanımlı değilse memory storage seçilir; limitler kapatılmaz. Ayrı test 200/200/429 davranışını doğrular. Açık Redis ayarı korunur.
- İstasyon bulunmayan mutfak ekranı yalnız `Main Course` kategorisini kabul ediyor, Kahvaltı gibi kategorileri gizliyordu. Backend'in `kitchen_station_route` değeri kullanılır; eski veride beverage/bar ve diğer/kitchen fallback'i, seçili istasyon filtresi korunur.
- Ürün PUT isteği `is_active` alanını yok sayıyordu. İsteğe bağlı görünürlük alanı eklenip False dahil doğru uygulanır. Fiyat korunarak public ve masa QR menülerinde kapatma/açma regresyonu test edilir. Yeni DB migration gerekmez.

## Canlı ortamın operasyon sınırları

Bu testler üretimde ürün/sipariş/ödeme oluşturma veya masa açma yetkisi vermez. Onaylı 23 üretim kaydı korunmalıdır. Canlıda yalnız iki owner var; pasif personeller aktarılmadı. 16 masa kapalı, Poğoça pasif ve DEMO ürünler yoktur; yayınlanan ürün sayısı sıfırdır. Bu koşullarda gerçek servis operasyonu tamamen hazır ilan edilemez.

Gerçek yönetici parolası bilinmediğinden canlı parola giriş testi yapılamadı; mevcut hash korunur, parola sıfırlanmaz. Gerçek ürün/fiyat onayı, hangi masaların açılacağı ve hangi yetkili personel hesabının kullanılacağı ayrıca belirlenip kullanıcı tarafından onaylanmalıdır.

HTTP-only yayında WebSocket kapalıdır. Mutfak 15 saniyelik HTTP yenilemesini sürdürür; WebSocket'e dayanan diğer ekranlarda yenileme gerekebilir. Nakit/terminal akışı ortak ödeme defterine tahsilat kaydeder; terminal düğmesi fiziksel cihazda banka tahsilatı yapmaz.
