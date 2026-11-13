"""Product photo choices for the approved Beratzade menu."""

from __future__ import annotations

import re
import unicodedata


def _key(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.casefold())
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


# One primary photo per sellable menu product; alternates remain in the static
# asset folder and are listed separately in its manifest.
PHOTO_BY_PRODUCT = {
    _key("Sigara Böreği (Adet)"): "sigara-boregi-1111.avif",
    _key("Muska Böreği (Adet)"): "muska-borek.webp",
    _key("Avcı Böreği (Adet)"): "avc-boregi.png",
    _key("Gözleme"): "gozleme1111.jpg",
    _key("Pankek"): "pankekbu.jpg",
    _key("Krep"): "krep11111.avif",
    _key("Poğaça"): "pogoca.jpg",
    _key("Simit"): "simit-orjinal.jpg",
    _key("Açma"): "acma.jpg",
    _key("Kaşarlı Tost"): "kasarl-tost.png",
    _key("Sucuklu Tost"): "sucuklu-tost.png",
    _key("Kavurmalı Tost"): "kavurmal-tost.png",
    _key("Hellimli Tost"): "hellimli-tost.png",
    _key("Sucuklu Kaşarlı Tost"): "sucuklu-kasarl-tost.png",
    _key("Sucuklu Kavurmalı Kaşarlı Tost"): "kavurmal-kasarl-sucuklu-tost.png",
    _key("Normal Sandviç"): "sandvic-tam.png",
    _key("Çeyrek Sandviç"): "ceyrek-sandvic.png",
    _key("Sade Menemen"): "sade-menemen.png",
    _key("Kaşarlı Menemen"): "kasarl-menemen.avif",
    _key("Sucuklu Menemen"): "sucuklu-kasarl-menemen.jpg",
    _key("Karışık Menemen"): "kar-s-k-menemen.png",
    _key("Sade Omlet"): "sade-omlet.png",
    _key("Kaşarlı Omlet"): "kasarl-omlet.png",
    _key("Sucuklu Omlet"): "sucuklu-omlet.png",
    _key("Kavurmalı Omlet"): "kavurmal-omlet.png",
    _key("Karışık Omlet"): "kar-s-k-omlet.png",
    _key("Sahanda Göz Yumurta"): "goz-yumurta.png",
    _key("Kahvaltı Tabağı"): "kahvalt-tabag.png",
    _key("Serpme Kahvaltı (Minimum 2 Kişilik)"): "serpme-kahvalt.png",
    _key("Adana Dürüm"): "adana-durum.png",
    _key("Urfa Dürüm"): "urfa-durum.png",
    _key("Ciğer Dürüm"): "ciger-durum.png",
    _key("Et Dürüm"): "et-durum.png",
    _key("Köfte Ekmek"): "izgara-kofte-sandvic-ziyafeti.png",
    _key("Adana Kebap Servis"): "geleneksel-adana-kebab-tabag.png",
    _key("Urfa Kebap Servis"): "urfa-kebab-ile-rustik-sofra.png",
    _key("Et Şiş Servis"): "bak-r-tabakta-izgara-sis-ziyafeti.png",
    _key("Tavuk Şiş Servis"): "izgara-tavuk-sis-ve-akdeniz-sofras.png",
    _key("Tavuk Kanat Servis"): "turk-usulu-izgara-tavuk-kanatlar.png",
    _key("Tavuk Pirzola Servis"): "tavuk-pirzola.png",
    _key("Köfte Servis"): "izgarada-turk-kofte-tabag.png",
    _key("Ciğer Servis"): "ciger-servis.png",
    _key("Tavuklu Pilav"): "tavuk-pilav.png",
    _key("Tavuk Fajita Dürüm"): "tavuk-fajita-duruo.png",
    _key("Kavurmalı Kaşarlı Dürüm"): "kavurmal-kasarl-durum.png",
    _key("Çıtır Tavuk"): "c-t-r-tavuk.png",
    _key("Viyana Usulü Tavuk Şnitzel"): "viyana-usulu-tavuk-sinitz.png",
    _key("Çıtır Peynir Çubukları"): "peynir-cubuklar.png",
    _key("Soğan Halkası"): "c-t-r-sogan-halkalar-ve-patates-tabag.png",
    _key("Patates Kroket"): "c-t-r-kroketler-ve-patates-tabag.png",
    _key("Hamburger"): "brger.png",
    _key("Fırın Sütlaç"): "f-st-kl-f-r-n-sutlac-close-up.png",
    _key("Taze Sıkılmış Portakal Suyu"): "portakal-suyu.jpg",
    _key("Küçük Çay"): "kucuk-cay.png",
    _key("Büyük Çay"): "buyuk-cay.png",
    _key("Nescafe"): "nescafe.png",
    _key("Oralet Çeşitleri"): "oralet-cesitleri.png",
}


def menu_image_filename(product_name: str) -> str | None:
    filename = PHOTO_BY_PRODUCT.get(_key(product_name))
    return f"menu-images/beratzade/{filename}" if filename else None
