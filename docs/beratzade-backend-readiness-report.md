# Beratzade backend üretim hazırlığı - ilk aşama

Bu aşama PostgreSQL, SQLAlchemy f405, migration ve Render backend başlangıcı kapsamındadır. Uygulama bütünüyle üretime hazır ilan edilmemiştir. Render veya Vercel dağıtımı yapılmamıştır. Proje dosyaları yalnızca `pos-beratzade-integration` içinde değiştirilmiştir; `pos-master` kullanılmamıştır. Git worktree metaverisi mevcut ortak Git dizininde tutulmaktadır.

## Düzeltilen hatalar

- `DATABASE_URL` desteği, `DB_*` alanlarına göre öncelik, psycopg 3 URL normalizasyonu ve özel karakterli parola desteği eklendi. SSL URL seçenekleri korunuyor.
- Boş PostgreSQL üzerinde eski `create_all()` çağrısının `staff_contract_kind` türü eksikliğiyle SQLSTATE 42704 / ProgrammingError (f405) verdiği testle yeniden üretildi. Bu, Render'daki bildirilen hatanın kesin tanısı değildir; o ortamın asıl logu henüz incelenmedi.
- Uygulama başlangıcındaki `create_all()` kaldırıldı. Sürümlenmiş başlangıç şeması 68 model tablosunu, enum türlerini, indeksleri ve döngüsel foreign key ilişkilerini oluşturuyor; mevcut tabloları yeniden oluşturmuyor.
- DB bağlantısı veya migration başarısızsa uygulama trafik kabul etmeden duruyor. Migration hataları artık gizlenmiyor.
- Eşzamanlı migration çalışmaları PostgreSQL advisory lock ile sıraya alınıyor. Hatalı dosya rollback oluyor ve uygulanmış olarak işaretlenmiyor. Çift sürüm numarası ve eksik migration dizini açıkça reddediliyor.
- `--check` şema/history yazmıyor. `--sync-idempotent` başarısız SQL'i atlamak yerine durup ilgili dosyayı rollback yapıyor.
- Tarihsel sipariş silme migration'ı, mevcut sipariş varsa operatör incelemesi için durduruluyor. Otomatik history değişikliğiyle bu kontrol aşılmıyor.
- Bağlantı havuzu sınırları, recycle ve bağlantı zaman aşımı ayarlanabiliyor. SQL parametreleri ve hassas bağlantı ayrıntıları hata yanıtında gösterilmiyor.
- Backend başlangıcı `python -m app.start` oldu: `0.0.0.0`, Render `PORT` desteği, varsayılan 8020, reload kapalı.

## Değiştirilen dosyalar

| Alan | Dosyalar |
| --- | --- |
| Yapılandırma | `back/app/settings.py`, `back/app/db.py`, `config.env.example` |
| Başlangıç | `back/app/main.py`, `back/app/start.py`, `back/Dockerfile` |
| Migration | `back/app/migrate.py`, `back/migrations/000_initial_schema.sql`, `back/migrations/README.md` |
| Testler | `back/tests/test_database_startup.py`, `back/tests/test_migration_postgres.py` |
| Belgeler | `docs/beratzade-render-backend.md`, bu rapor, `CHANGELOG.md` |

## Backend test sonuçları

Mevcut backend imajıyla, ayrı Docker ağı ve geçici PostgreSQL 18 konteyneri kullanıldı. Mevcut uygulama/üretim DB'si test hedefi yapılmadı; veritabanı silme veya sıfırlama komutu kullanılmadı. Her entegrasyon testi ayrı ve benzersiz test veritabanı oluşturdu.

- Hedefli paket: **25 geçti**, 1 mevcut Starlette/httpx deprecation uyarısı.
- 126 migration temiz DB'de başarıyla uygulandı; son sürüm `20261028190200`.
- Tam SQL repair tekrarı ve history'siz mevcut şemaya yeniden uygulama başarılı.
- Mevcut tenant ve denetim satırı korundu; sipariş silme koruması ayrı testte doğrulandı.
- Eşzamanlı iki runner, rollback, başarısız DB/migration ile başlangıcın durması ve health hata yanıtının gizliliği doğrulandı.
- Production modunda `PORT=10000` ile yerel API başladı. `/health`: **200**; `/health/db`: **200**, DB bağlı, beklenen schema version.
- API logları kontrol edildi. PostgreSQL test loglarındaki eksik enum/tablo hataları, kasıtlı olumsuz regresyon testlerinden kaynaklandı; testler bu hataları bekleyip doğruladı.
- **Tam backend paketi çalıştırılmadı:** araç onayında bu çalıştırma isteği reddedildi. Sonraki onaylanan çalışmalar yalnızca hedefli paket ve yerel smoke kontrolleriydi.

## Frontend test sonuçları

Bu aşamada frontend değiştirilmedi. Frontend derleyicisi, tarayıcı, mobil ve uçtan uca akış testleri çalıştırılmadı.

## Production build sonucu

Yeni Docker imajı ve Angular production build alınmadı. Kod mevcut backend imajına yalnızca entegrasyon kaynak klasörü bağlanarak test edildi; host kurulumu veya bağımlılık kurulumu yapılmadı. Yeni Dockerfile CMD'sinin çağırdığı aynı Python başlangıç modülü production modunda çalıştırıldı. Bu kontrol, yeni imajın tam build doğrulamasının yerini tutmaz.

## Render dağıtım ayarları

Hazırlanan ayarlar: kök dizin `back`, Dockerfile `./Dockerfile`, başlangıç `python -m app.start`, health yolu `/health/db`. `PORT` ortamdan okunur. PostgreSQL Internal URL kullanılmalıdır. Gerçek Render servis ayarları değiştirilmedi.

## Vercel dağıtım ayarları

Bu aşamanın dışında bırakıldı; Vercel yapılandırması değiştirilmedi ve dağıtım yapılmadı.

## Gerekli ortam değişkenleri

`DATABASE_URL`, `PRODUCTION=true`, birbirinden farklı güçlü `SECRET_KEY` ve `REFRESH_SECRET_KEY`, açık `CORS_ORIGINS`, `PUBLIC_APP_BASE_URL`; topolojiye göre `ROOT_PATH`, `REDIS_URL`, `RATE_LIMIT_REDIS_URL`. Render `PORT` sağlar. Havuz seçenekleri ve ayrıntılı ayarlar [Render hazırlık belgesinde](beratzade-render-backend.md) verilmiştir. Gerçek değerler veya sırlar bu raporda yer almıyor.

## Henüz çözülemeyen sorunlar

- Render'ın asıl f405 traceback'i ve mevcut üretim schema/history envanteri henüz alınmadı. Yerelde yeniden üretilen neden, o ortamın kesin nedeni olarak sunulamaz.
- History'si mevcut ama şeması eksik/bozuk DB için otomatik ve sınırsız repair yapılmaz. Eksik kolon/constraint tanısı alınarak ayrıca güvenli migration hazırlanmalıdır.
- Mevcut siparişleri olan ve tarihsel silme migration'ı pending görünen DB, koruma nedeniyle durur; operatör incelemesi gerekir.
- Tam backend paketi ve yeni imaj build'i henüz doğrulanmadı. Frontend/Vercel, kullanıcı akışları, Redis/WebSocket ve kapsamlı güvenlik incelemesi sonraki aşamalardır.

## Canlıya çıkış için kalan işlemler

1. Render traceback'i, mevcut schema/history ve güncel yedek doğrulanmalı.
2. Tam backend paketi, yeni imaj build'i ve frontend production/akış kontrolleri tamamlanmalı.
3. Render/Vercel ortamları ve frontend/backend bağlantıları gerçek alan adlarıyla doğrulanmalı.
4. Kullanıcının açık dağıtım onayı alındıktan sonra dağıtım yapılmalı.
