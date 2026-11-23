"""Field defaults on Settings (no env mutation; uses model metadata only)."""


def test_email_from_default_requires_explicit_configuration() -> None:
    from app.settings import Settings

    default = Settings.model_fields["email_from"].default
    assert default == ""
