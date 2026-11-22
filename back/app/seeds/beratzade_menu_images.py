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
    _key("Pepsi Slim Kutu 330 ml"): "drinks/drink-31.jpg",
    _key("Coca-Cola Kutu 330 ml"): "drinks/drink-06.jpg",
    _key("Coca-Cola Zero Kutu 330 ml"): "drinks/drink-05.jpg",
    _key("Coca-Cola Cam Şişe 250 ml"): "drinks/drink-07.jpg",
    _key("Coca-Cola Plastik Şişe 1 L"): "drinks/drink-09.jpg",
    _key("Fanta Portakal Plastik Şişe 1 L"): "drinks/drink-08.jpg",
    _key("Sprite Kutu 330 ml"): "drinks/drink-34.jpg",
    _key("Yedigün Portakal Kutu 250 ml"): "drinks/drink-33.jpg",
    _key("Fanta / Meyveli Gazoz Kutu 330 ml"): "drinks/drink-32.jpg",
    _key("Niğde Gazozu Cam Şişe 200 ml"): "drinks/nigde.png",
    _key("Lipton Ice Tea Limon 330 ml"): "drinks/drink-11.jpg",
    _key("Lipton Ice Tea Şeftali 330 ml"): "drinks/lipton-peach.png",
    _key("Lipton Ice Tea Kırmızı Meyve 330 ml"): "drinks/drink-13.jpg",
    _key("Lipton Sparkling Ice Tea Limon 330 ml"): "drinks/drink-12.jpg",
    _key("Dimes Şeftali 250 ml"): "drinks/drink-29.png",
    _key("Dimes Vişne 250 ml"): "drinks/drink-30.png",
    _key("Dimes Karışık / Portakal 200 ml"): "drinks/dimes-mixed.jpg",
    _key("Meyöz Karışık 200 ml"): "drinks/meyoz-mixed.jpg",
    _key("Meyöz Şeftali (Karışık Meyve) 200 ml"): "drinks/meyoz-peach.jpg",
    _key("Capri-Sun Multivitamin 200 ml"): "drinks/drink-26.jpg",
    _key("Capri-Sun Mystic Dragon 200 ml"): "drinks/drink-27.jpeg",
    _key("Doğanay Şalgam 300 ml"): "drinks/drink-28.jpg",
    _key("Sütaş Ayran 170 ml"): "drinks/drink-25.jpg",
    _key("Sütaş Ayran 200 ml"): "drinks/drink-24.jpg",
    _key("Ekşili Ayran 200–250 ml"): "drinks/drink-18.jpg",
    _key("Acılı Ayran 200 ml"): "drinks/unknown-gazoz.jpg",
    _key("Su 500 ml"): "drinks/drink-23.jpg",
    _key("Uludağ Limonata"): "drinks/drink-01.jpg",
    _key("SEK Ayran 1 L"): "drinks/drink-10.jpg",
    _key("Sırma Limonlu Soda"): "drinks/drink-20.jpg",
    _key("Sırma Elmalı Soda"): "drinks/drink-21.jpg",
    _key("Beypazarı Sade Maden Suyu"): "drinks/drink-22.png",
    _key("Meyöz Karışık 1 L"): "drinks/drink-16.jpg",
    _key("Niğde Gazozu Cam Şişe 250 ml"): "drinks/drink-19.webp",
    _key("Acılı Ayran 270 ml"): "drinks/drink-17.png",
}


def menu_image_filename(product_name: str) -> str | None:
    filename = PHOTO_BY_PRODUCT.get(_key(product_name))
    return f"menu-images/beratzade/{filename}" if filename else None
