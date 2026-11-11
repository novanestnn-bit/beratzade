"""Assign the supplied Beratzade menu photos to the shared Product catalog.

Run in the backend container after importing the real Beratzade menu:
  ALLOW_BERATZADE_IMAGE_SYNC=1 python -m app.seeds.sync_beratzade_menu_images

The one-shot opt-in is required in every environment. On production, run it
only from the intended Beratzade service after confirming its existing uploads
disk is mounted. The Product image field is shared by the customer QR menu,
staff POS and admin catalog.
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import unicodedata
from pathlib import Path

from sqlmodel import Session, select

from app import models
from app.db import engine
from app.settings import settings

TENANT_SLUG = "beratzade-kebap-kahvalti-salonu"
ASSET_DIR = Path(__file__).resolve().parents[1] / "seed_assets" / "beratzade"
UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"

# Product name -> user supplied image filename. The 37th input file is a byte
# identical duplicate of brger.png, so the single Hamburger row uses that photo.
PRODUCT_IMAGES = {
    "Açma": "açma.jpg",
    "Et Şiş Servis": "Bakır Tabakta Izgara Şiş Ziyafeti.png",
    "Hamburger": "brger.png",
    "Fırın Sütlaç": "Fıstıklı Fırın Sütlaç Close-Up.png",
    "Adana Kebap Servis": "Geleneksel Adana Kebabı Tabağı.png",
    "Gözleme": "gözleme1111.jpg",
    "Et Dürüm": "Izgara Etli Dürüm ve Közlenmiş Sebzeler.png",
    "Köfte Ekmek": "Izgara Köfte Sandviç Ziyafeti.png",
    "Tavuk Şiş Servis": "Izgara Tavuk Şiş ve Akdeniz Sofrası.png",
    "Köfte Servis": "Izgarada Türk Köfte Tabağı.png",
    "Kaşarlı Menemen": "kaşarlı menemen.avif",
    "Sucuklu Kaşarlı Tost": "kaşarlı sucuklu tost.png",
    "Kaşarlı Tost": "kaşarlı tost.png",
    "Krep": "krep11111.avif",
    "Adana Dürüm": "Közde Adana Dürüm ve Köz Sebzeler.png",
    "Ciğer Dürüm": "Közlenmiş Ciğer Dürüm ve Biber.png",
    "Muska Böreği (Adet)": "muska börek.webp",
    "Pankek": "pankekbu.jpg",
    "Kaşarlı Omlet": "Peynirli Omlet ve Taze Sebzeler.png",
    "Poğaça": "poğoca.jpg",
    "Taze Sıkılmış Portakal Suyu": "portakal suyu.jpg",
    "Sade Omlet": "Rustik Omlet ve Peynir Tabağı.png",
    "Kahvaltı Tabağı": "Rustik Türk Kahvaltısı Tabağı.png",
    "Serpme Kahvaltı (Minimum 2 Kişilik)": "serpme kahvaltı.png",
    "Sigara Böreği (Adet)": "sigara böreği 1111.avif",
    "Simit": "simit orjinal.jpg",
    "Karışık Omlet": "Sucuklu Karışık Omlet Tabağı.png",
    "Sucuklu Menemen": "sucuklu kaşarlı menemen.jpg",
    "Sucuklu Omlet": "Sucuklu Peynirli Omlet Tabağı.png",
    "Tavuk Pirzola Servis": "tavuk pirzola.png",
    "Tavuk Kanat Servis": "Türk Usulü Izgara Tavuk Kanatları.png",
    "Urfa Kebap Servis": "Urfa Kebabı ile Rustik Sofra.png",
    "Patates Kroket": "Çıtır Kroketler ve Patates Tabağı.png",
    "Soğan Halkası": "Çıtır Soğan Halkaları ve Patates Tabağı.png",
    "Viyana Usulü Tavuk Şnitzel": "Çıtır Şnitzel ve Patates Tabağı.png",
    "Kavurmalı Omlet": "Kavurmalı Peynirli Omlet Sofrası.png",
    "Oralet Çeşitleri": "oralet çeşitleri.png",
    "Nescafe": "nescafe.png",
    "Büyük Çay": "büyük çay.png",
    "Küçük Çay": "küçük çay.png",
    "Çıtır Peynir Çubukları": "peynir çubukları.png",
    "Çıtır Tavuk": "çıtır tavuk.png",
    "Kavurmalı Kaşarlı Dürüm": "Kaşarlı Kavurmalı Izgara Dürüm.png",
    "Tavuk Fajita Dürüm": "tavuk fajita dürüö.png",
    "Tavuklu Pilav": "tavuk pilav.png",
    "Ciğer Servis": "ciğer servis.png",
    "Urfa Dürüm": "urfa dürüm.png",
    "Sahanda Göz Yumurta": "göz yumurta.png",
    "Sade Menemen": "sade menemen.png",
    "Çeyrek Sandviç": "çeyrek sandviç.png",
    "Normal Sandviç": "sandviç tam.png",
    "Sucuklu Kavurmalı Kaşarlı Tost": "kavurmalı kaşarlı sucuklu tost.png",
    "Hellimli Tost": "hellimli tost.png",
    "Kavurmalı Tost": "kavurmalı tost.png",
    "Sucuklu Tost": "sucuklu kaşarlı tost.png",
    "Avcı Böreği (Adet)": "avcı böreği.png",
}


def normalize_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    asciiish = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", asciiish).strip()


def validate_environment() -> None:
    if os.environ.get("ALLOW_BERATZADE_IMAGE_SYNC") != "1":
        raise RuntimeError("Set ALLOW_BERATZADE_IMAGE_SYNC=1 for an explicit one-shot image sync.")
    if not settings.is_production and (engine.url.host != "db" or engine.url.database != "pos"):
        raise RuntimeError("Refusing non-production sync: expected the local Docker pos database.")


def sync_images(session: Session, tenant: models.Tenant) -> tuple[int, list[str]]:
    products = session.exec(
        select(models.Product).where(models.Product.tenant_id == tenant.id)
    ).all()
    products_by_name: dict[str, list[models.Product]] = {}
    for product in products:
        products_by_name.setdefault(normalize_name(product.name), []).append(product)

    destination = UPLOADS_DIR / str(tenant.id) / "products"
    destination.mkdir(parents=True, exist_ok=True)
    image_by_normalized_name = {
        normalize_name(name): source_name for name, source_name in PRODUCT_IMAGES.items()
    }
    assigned = 0
    ambiguous: list[str] = []
    for normalized_name, source_name in image_by_normalized_name.items():
        matches = products_by_name.get(normalized_name, [])
        if len(matches) != 1:
            if len(matches) > 1:
                ambiguous.append(normalized_name)
            continue
        source = ASSET_DIR / source_name
        if not source.is_file():
            raise FileNotFoundError(f"Beratzade menu image is missing: {source}")
        product = matches[0]
        target_name = f"beratzade-{product.id}{source.suffix.lower()}"
        shutil.copyfile(source, destination / target_name)
        product.image_filename = target_name
        session.add(product)
        assigned += 1

    session.commit()
    # Report every catalog product that still lacks an image after the update.
    session.refresh(tenant)
    missing = [
        product.name for product in products
        if not product.image_filename and not product.name.strip().upper().startswith("DEMO")
    ]
    return assigned, missing


def verify_assets() -> None:
    missing_files = sorted(set(PRODUCT_IMAGES.values()) - {
        path.name for path in ASSET_DIR.iterdir() if path.is_file()
    })
    if missing_files:
        raise FileNotFoundError(f"Missing supplied image assets: {', '.join(missing_files)}")
    burger_files = [ASSET_DIR / "brger.png", ASSET_DIR / "Rustik Tahtada İştah Açıcı Cheeseburger Menüsü (1).png"]
    if all(path.is_file() for path in burger_files):
        hashes = {hashlib.sha256(path.read_bytes()).digest() for path in burger_files}
        if len(hashes) != 1:
            raise RuntimeError("The two supplied burger images differ; assign the second to a product before syncing.")


def run() -> None:
    validate_environment()
    verify_assets()
    with Session(engine) as session:
        tenants = session.exec(select(models.Tenant)).all()
        matches = [tenant for tenant in tenants if normalize_name(tenant.public_slug or "") == normalize_name(TENANT_SLUG)]
        if len(matches) != 1:
            raise RuntimeError(f"Expected exactly one Beratzade tenant; found {len(matches)}.")
        assigned, missing = sync_images(session, matches[0])
        print(f"Beratzade images assigned: {assigned}/{len(PRODUCT_IMAGES)} mapped products")
        print(f"Catalog products missing photos: {len(missing)}")
        for name in missing:
            print(f"- {name}")


if __name__ == "__main__":
    run()
