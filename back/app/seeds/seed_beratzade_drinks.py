"""Import the owner's drink list without overwriting existing products.

Run explicitly: python -m app.seeds.seed_beratzade_drinks
Prices are the owner's per-item TRY amounts, stored in kurus.
Unidentified brands/flavours remain unidentified; no substitute images are used.
"""

from copy import deepcopy
import hashlib
import json
from pathlib import Path

from sqlmodel import Session, select

from app import models


PUBLIC_SLUG = "beratzade-kebap-kahvalti-salonu"
CATEGORY = "İçecekler"
SUBCATEGORY = "Soğuk"
PHOTO_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "beratzade-drinks"
UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"


def photo_sources() -> dict[str, Path]:
    """Validate the packaged originals before making any database changes."""
    result = {}
    for record in json.loads((PHOTO_DIR / "photos.json").read_text(encoding="utf-8")):
        path = PHOTO_DIR / record["file"]
        if path.parent != PHOTO_DIR or not path.is_file():
            raise ValueError("Missing or invalid drink photo")
        if hashlib.sha256(path.read_bytes()).hexdigest() != record["sha256"]:
            raise ValueError(f"Drink photo checksum mismatch: {path.name}")
        if record["product"]:
            result[record["product"]] = path
    return result

# Name (including size/packaging), price in kurus, packaging / uncertainty.
DRINKS = (
    ("Pepsi Slim Kutu 330 ml", 8000, "Slim kutu, 330 ml."),
    ("Coca-Cola Kutu 330 ml", 8000, "Kutu, 330 ml."),
    ("Coca-Cola Zero Kutu 330 ml", 8000, "Siyah-kırmızı kutu, 330 ml."),
    ("Coca-Cola Cam Şişe 250 ml", 8000, "Cam şişe, 250 ml."),
    ("Coca-Cola Plastik Şişe 1 L", 10000, "Plastik şişe, 1 L."),
    ("Fanta Portakal Plastik Şişe 1 L", 10000, "Plastik şişe, 1 L."),
    ("Sprite Kutu 330 ml", 8000, "Kutu, 330 ml."),
    ("Yedigün Portakal Kutu 250 ml", 8000, "Kutu, 250 ml."),
    ("Fanta / Meyveli Gazoz Kutu 330 ml", 8000, "Sarı-turuncu kutu, 330 ml. Marka ve aroma teyit bekliyor."),
    ("Sırma Gazoz Cam Şişe 200 ml", 5000, "Cam şişe, 200 ml."),
    ("Niğde Gazozu Cam Şişe 200 ml", 5000, "Cam şişe, 200 ml."),
    ("Lipton Ice Tea Limon 330 ml", 7000, "Kutu, 330 ml."),
    ("Lipton Ice Tea Şeftali 330 ml", 7000, "Kutu, 330 ml."),
    ("Lipton Ice Tea Kırmızı Meyve 330 ml", 7000, "Pembe kutu, 330 ml."),
    ("Lipton Sparkling Ice Tea Limon 330 ml", 7000, "Kutu, 330 ml."),
    ("Dimes Şeftali 250 ml", 7000, "Kutu, 250 ml."),
    ("Dimes Vişne 250 ml", 7000, "Kutu, 250 ml."),
    ("Dimes Karışık / Portakal 200 ml", 7000, "Karton kutu, 200 ml. Aroma teyit bekliyor."),
    ("Meyöz Karışık 200 ml", 3000, "Karton kutu, 200 ml."),
    ("Meyöz Şeftali (Karışık Meyve) 200 ml", 3000, "Karton kutu, 200 ml."),
    ("Capri-Sun Multivitamin 200 ml", 3500, "Poşet, 200 ml."),
    ("Capri-Sun Mystic Dragon 200 ml", 3500, "Poşet, 200 ml."),
    ("Doğanay Şalgam 300 ml", 7000, "Plastik şişe, 300 ml."),
    ("Sütaş Ayran 170 ml", 4000, "Mavi-beyaz bardak, 170 ml."),
    ("Sütaş Ayran 200 ml", 5000, "Büyük bardak, 200 ml."),
    ("Naneli Ayran 200 ml", 8000, "Küçük şişe, 200 ml."),
    ("Ekşili Ayran 200–250 ml", 8000, "Küçük cam şişe. Marka ve kesin hacim teyit bekliyor."),
    ("Acılı Ayran 200 ml", 8000, "200 ml."),
    ("Su 500 ml", 2500, "Plastik şişe, 500 ml."),
    ("Bardak Su 200 ml", 1000, "Kapaklı bardak, 200 ml."),
)

# Additional variants supplied as photos. No selling price was supplied;
# keep these records inactive until the owner prices them in the product editor.
DRAFT_DRINKS = (
    ("Uludağ Limonata", 0, "Plastik şişe. Hacim ve satış fiyatı bekleniyor."),
    ("SEK Ayran 1 L", 0, "Plastik şişe, 1 L. Satış fiyatı bekleniyor."),
    ("Sırma Limonlu Soda", 0, "Limon aromalı maden suyu. Hacim ve satış fiyatı bekleniyor."),
    ("Sırma Elmalı Soda", 0, "Elma aromalı maden suyu. Hacim ve satış fiyatı bekleniyor."),
    ("Beypazarı Sade Maden Suyu", 0, "Cam şişe. Hacim ve satış fiyatı bekleniyor."),
    ("Meyöz Karışık 1 L", 0, "Karton kutu, 1 L. Satış fiyatı bekleniyor."),
    ("Niğde Gazozu Cam Şişe 250 ml", 0, "Cam şişe, 250 ml. Satış fiyatı bekleniyor."),
    ("Acılı Ayran 270 ml", 0, "By Ayrancı, şişe, 270 ml. Satış fiyatı bekleniyor."),
    ("Yedigün Portakal Kutu 330 ml", 0, "Kutu, 330 ml. Satış fiyatı bekleniyor."),
)


def seed(session: Session, *, uploads_dir: Path = UPLOADS_DIR,
         category: str = CATEGORY, static_images: bool = False) -> int:
    photos = photo_sources()
    tenant = session.exec(
        select(models.Tenant).where(models.Tenant.public_slug == PUBLIC_SLUG)
    ).one_or_none()
    if tenant is None:
        raise RuntimeError("Beratzade işletmesi bulunamadı; hiçbir ürün eklenmedi.")
    if tenant.currency_code != "TRY":
        raise RuntimeError("İşletmenin para birimi TRY olmalı; hiçbir ürün eklenmedi.")

    # Lock the tenant so simultaneous imports cannot create duplicate rows.
    session.exec(
        select(models.Tenant).where(models.Tenant.id == tenant.id).with_for_update()
    ).one()
    existing = {product.name: product for product in session.exec(
        select(models.Product).where(models.Product.tenant_id == tenant.id)
    ).all()}
    custom = deepcopy(tenant.custom_subcategories or {})
    subcategories = custom.setdefault(category, [])
    if SUBCATEGORY not in subcategories:
        subcategories.append(SUBCATEGORY)
    tenant.custom_subcategories = custom
    session.add(tenant)

    created = 0
    for name, price_cents, description in (*DRINKS, *DRAFT_DRINKS):
        product = existing.get(name)
        if product is None:
            product = models.Product(
                tenant_id=tenant.id, name=name, price_cents=price_cents,
                description=description, category=category,
                subcategory=SUBCATEGORY, is_active=price_cents > 0,
            )
            created += 1
        if name in photos and not product.image_filename:
            source = photos[name]
            if static_images:
                product.image_filename = f"menu-images/beratzade/drinks/{source.name}"
                session.add(product)
                continue
            data = source.read_bytes()
            filename = f"beratzade-{hashlib.sha256(data).hexdigest()[:20]}{source.suffix}"
            destination = uploads_dir / str(tenant.id) / "products" / filename
            destination.parent.mkdir(parents=True, exist_ok=True)
            if not destination.exists():
                destination.write_bytes(data)
            elif destination.read_bytes() != data:
                raise ValueError("Existing drink image has unexpected content")
            product.image_filename = filename
        session.add(product)
    session.commit()
    return created


def run() -> None:
    from app.db import engine

    with Session(engine) as session:
        created = seed(session)
        print(f"İçecek aktarımı tamamlandı: {created} yeni ürün; {len(DRINKS)} fiyatlı, {len(DRAFT_DRINKS)} fiyat bekleyen ürünlük liste.")


if __name__ == "__main__":
    run()
