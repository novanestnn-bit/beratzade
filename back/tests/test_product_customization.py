"""Unit tests for product customization helpers (issue #50)."""

import pytest

from app.product_customization import (
    choice_options_allowed_list,
    choice_options_is_multi,
    customization_dicts_equal,
    customization_price_delta_cents,
)
from types import SimpleNamespace
from unittest.mock import Mock
from fastapi import HTTPException
from app.models import ProductQuestionType
from app.product_customization import validate_and_normalize_customization_answers


def test_choice_options_single_list():
    assert choice_options_is_multi(["a", "b"]) is False
    assert choice_options_allowed_list(["a", "b"]) == ["a", "b"]


def test_choice_options_multi_dict():
    opts = {"choices": ["x", "y"], "multi": True}
    assert choice_options_is_multi(opts) is True
    assert choice_options_allowed_list(opts) == ["x", "y"]


def test_customization_dicts_equal_multi_order():
    a = {"1": ["b", "a"]}
    b = {"1": ["a", "b"]}
    assert customization_dicts_equal(a, b) is True


def test_customization_dicts_equal_mismatch():
    assert customization_dicts_equal({"1": "x"}, {"1": "y"}) is False


def test_sandwich_price_delta_adds_extra_fillings_and_premium_choices():
    session = Mock()
    session.exec.return_value.all.return_value = [SimpleNamespace(
        id=18,
        options={
            "pricing": {
                "type": "item_count",
                "included": 1,
                "second_item_delta_cents": 3000,
                "additional_item_delta_cents": 3000,
                "choice_surcharges_cents": {"Kavurma": 8000, "Eski kaşar": 4000},
            }
        },
    )]

    delta = customization_price_delta_cents(
        session, 42, 8, {"18": ["Kavurma", "Kaşar", "Eski kaşar", "Domates"]}
    )

    assert delta == 21000


def test_sandwich_price_delta_does_not_trust_unconfigured_questions():
    session = Mock()
    session.exec.return_value.all.return_value = [SimpleNamespace(
        id=18, options={"choices": ["Kavurma"], "multi": True}
    )]

    assert customization_price_delta_cents(session, 42, 8, {"18": ["Kavurma"]}) == 0


def test_serpme_breakfast_keeps_each_person_selection_including_repeats():
    questions = [
        SimpleNamespace(id=1, type=ProductQuestionType.choice, label="Kişi sayısı", required=True,
                        options={"choices": ["2", "3", "4"], "multi": False}),
        SimpleNamespace(id=2, type=ProductQuestionType.choice, label="Ara sıcaklar", required=True,
                        options={"choices": ["Hellim", "Sigara Böreği"], "multi": True,
                                 "min_choices": 2, "max_choices": 2}),
        SimpleNamespace(id=3, type=ProductQuestionType.choice, label="Kişi başı ana sıcak", required=True,
                        options={"choices": ["Sade Omlet", "Kaşarlı Menemen"], "multi": True,
                                 "per_person": True, "selection_count_question_label": "Kişi sayısı"}),
    ]
    session = Mock()
    session.exec.return_value.all.return_value = questions

    answers, summary = validate_and_normalize_customization_answers(
        session, 42, 8,
        {"1": "3", "2": ["Hellim", "Sigara Böreği"],
         "3": ["Sade Omlet", "Sade Omlet", "Kaşarlı Menemen"]},
    )

    assert answers["3"] == ["Sade Omlet", "Sade Omlet", "Kaşarlı Menemen"]
    assert "Kişi sayısı: 3" in summary


def test_serpme_breakfast_requires_one_hot_meal_per_guest():
    questions = [
        SimpleNamespace(id=1, type=ProductQuestionType.choice, label="Kişi sayısı", required=True,
                        options={"choices": ["2", "3", "4"]}),
        SimpleNamespace(id=2, type=ProductQuestionType.choice, label="Kişi başı ana sıcak", required=True,
                        options={"choices": ["Sade Omlet"], "multi": True, "per_person": True,
                                 "selection_count_question_label": "Kişi sayısı"}),
    ]
    session = Mock()
    session.exec.return_value.all.return_value = questions

    with pytest.raises(HTTPException) as error:
        validate_and_normalize_customization_answers(session, 42, 8, {"1": "3", "2": ["Sade Omlet"]})
    assert error.value.status_code == 422
