from src.translit import to_latin


def test_bulgarian_streamlined_system():
    assert to_latin("Алберто Томба", "BG") == "Alberto Tomba"
    assert to_latin("Шилигарник 1", "BG") == "Shiligarnik 1"
    assert to_latin("Чалин валог 2", "BG") == "Chalin valog 2"
    assert to_latin("Тодорка", "BG") == "Todorka"
    assert to_latin("София", "BG") == "Sofia"
    assert to_latin("Щърбанов", "BG") == "Shtarbanov"


def test_latin_or_other_countries_unchanged():
    assert to_latin("Bunderitsa", "BG") == "Bunderitsa"
    assert to_latin("Lupului", "RO") == "Lupului"
    assert to_latin(None, "BG") is None
    assert to_latin("Шилигарник", "RO") == "Шилигарник"
