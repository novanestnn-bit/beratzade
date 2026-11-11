from app.menu_product_rules import is_beratzade_demo_product, is_non_sellable_menu_heading
from app import models
from app.delivery_order_service import _resolve_product_lines
from unittest.mock import Mock


def test_daily_meals_heading_is_recognized_without_relying_on_product_id():
    assert is_non_sellable_menu_heading("G\u00fcnl\u00fck Sulu Yemekler", "G\u00fcn\u00fcn Yemekleri")
    assert is_non_sellable_menu_heading("G\u00dcNL\u00dcK SULU YEMEKLER", "G\u00dcN\u00dcN YEMEKLER\u0130")
    assert not is_non_sellable_menu_heading("G\u00fcnl\u00fck Sulu Yemekler", "Tavuk Yemekleri")
    assert not is_non_sellable_menu_heading("G\u00fcn\u00fcn Yeme\u011fi", "G\u00fcn\u00fcn Yemekleri")


def test_order_line_resolver_rejects_heading_without_database_access():
    heading = models.Product(
        id=620,
        tenant_id=89,
        name="G\u00fcnl\u00fck Sulu Yemekler",
        price_cents=100,
        category="G\u00fcn\u00fcn Yemekleri",
    )
    session = Mock()
    session.get.side_effect = lambda model, product_id: (
        None if model is models.TenantProduct else heading
    )

    lines, error = _resolve_product_lines(
        session,
        tenant_id=89,
        lines=[{"product_id": 620, "quantity": 1}],
    )

    assert lines is None
    assert error == {"status": "error", "detail": "non_sellable_menu_heading"}


def test_demo_products_are_suppressed_only_for_beratzade_menus():
    beratzade = "Beratzade Kebap & Kahvaltı Salonu"
    assert is_beratzade_demo_product("DEMO — Menemen", beratzade)
    assert is_beratzade_demo_product("Enchiladas", beratzade)
    assert is_beratzade_demo_product("Tecate Roja", beratzade)
    assert not is_beratzade_demo_product("Enchiladas", "Demo Restaurant")
    assert not is_beratzade_demo_product("Normal Sandviç", beratzade)
