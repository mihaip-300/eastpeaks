import numpy as np

from src.clean import DIFFICULTY_MAP, Segment, merge_runs, normalize_difficulty
from src.config import DIFFICULTIES


def seg(id_, coords, name="Lupului", difficulty="advanced"):
    return Segment([id_], name, difficulty, "test", np.asarray(coords, dtype=float))


def test_all_known_osm_difficulties_map_to_the_seven_categories():
    for value in DIFFICULTY_MAP:
        assert normalize_difficulty(value) in DIFFICULTIES
    assert normalize_difficulty("extreme") == "expert"
    assert normalize_difficulty(" Intermediate ") == "intermediate"
    assert normalize_difficulty(None) == "unknown"
    assert normalize_difficulty("double_black") == "unknown"
    assert set(normalize_difficulty(v) for v in DIFFICULTY_MAP) | {"unknown"} == set(DIFFICULTIES)


def test_connected_segments_merge_into_one_run():
    a = seg("a", [[0, 0], [100, 0]])
    b = seg("b", [[300, 0], [110, 0]])  # drawn the other way, 10 m gap
    c = seg("c", [[300, 5], [500, 0]])
    merged = merge_runs([a, c, b])
    assert len(merged) == 1
    assert sorted(merged[0].ids) == ["a", "b", "c"]
    assert merged[0].xy[0].tolist() in ([0, 0], [500, 0])


def test_same_name_but_not_connected_stays_separate():
    a = seg("a", [[0, 0], [100, 0]])
    b = seg("b", [[1000, 0], [1100, 0]])
    assert len(merge_runs([a, b])) == 2


def test_different_difficulty_or_unnamed_is_not_merged():
    a = seg("a", [[0, 0], [100, 0]], difficulty="easy")
    b = seg("b", [[100, 0], [200, 0]], difficulty="intermediate")
    c = seg("c", [[200, 0], [300, 0]], name=None)
    d = seg("d", [[300, 0], [400, 0]], name=None)
    assert len(merge_runs([a, b, c, d])) == 4


def test_branching_group_is_left_alone():
    trunk = seg("t", [[0, 0], [100, 0]])
    left = seg("l", [[100, 0], [200, 100]])
    right = seg("r", [[100, 0], [200, -100]])
    assert len(merge_runs([trunk, left, right])) == 3
