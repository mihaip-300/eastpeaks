import numpy as np
import pytest

from src.slope import copernicus_tile_name, densify, max_window_gradient, run_stats, tiles_for_bbox


def linear_slope(top: float = 1000.0, grade: float = 0.2):
    """Elevation falls by `grade` per metre of x."""
    return lambda pts: top - grade * pts[:, 0]


def test_gradient_on_synthetic_line():
    # 1,000 m horizontal, 200 m drop -> 20 %.
    xy = np.array([[0.0, 0.0], [1000.0, 0.0]])
    stats = run_stats(xy, linear_slope())
    assert stats.length_m == pytest.approx(1000.0)
    assert stats.drop_m == pytest.approx(200.0)
    assert stats.avg_gradient_pct == pytest.approx(20.0)
    assert stats.max_gradient_100m_pct == pytest.approx(20.0)
    assert stats.suspect == ()


def test_reversed_line_gives_same_result():
    xy = np.array([[0.0, 0.0], [400.0, 300.0], [1000.0, 300.0]])
    forward = run_stats(xy, linear_slope())
    backward = run_stats(xy[::-1].copy(), linear_slope())
    assert forward == backward
    assert forward.top_m > forward.bottom_m


def test_max_gradient_finds_steep_section():
    # 500 m at 10 %, then 200 m at 50 %, then 300 m at 10 %.
    dist = np.arange(0, 1001, 10.0)
    slope = np.where((dist > 500) & (dist <= 700), 0.5, 0.1)
    z = 2000 - np.concatenate([[0.0], np.cumsum(slope[1:] * 10.0)])
    assert max_window_gradient(dist, z) == pytest.approx(50.0, abs=0.5)


def test_short_run_uses_average_gradient():
    xy = np.array([[0.0, 0.0], [60.0, 0.0]])
    stats = run_stats(xy, linear_slope(grade=0.3))
    assert stats.max_gradient_100m_pct == pytest.approx(30.0)


def test_suspect_flags():
    flat = run_stats(np.array([[0.0, 0.0], [300.0, 0.0]]), linear_slope(grade=0.01))  # 3 m drop
    assert "gradient_under_2pct" in flat.suspect
    assert "drop_under_5m" in flat.suspect
    cliff = run_stats(np.array([[0.0, 0.0], [200.0, 0.0]]), linear_slope(grade=1.5))
    assert "gradient_over_100pct" in cliff.suspect


def test_densify_spacing_and_end():
    dist, pts = densify(np.array([[0.0, 0.0], [25.0, 0.0]]), step=10.0)
    assert dist.tolist() == [0.0, 10.0, 20.0, 25.0]
    assert pts[-1].tolist() == [25.0, 0.0]


def test_copernicus_tile_names():
    assert copernicus_tile_name(45, 25) == "Copernicus_DSM_COG_10_N45_00_E025_00_DEM"
    assert copernicus_tile_name(41, 23) == "Copernicus_DSM_COG_10_N41_00_E023_00_DEM"
    assert tiles_for_bbox((25.5, 45.5, 25.6, 45.7)) == ["Copernicus_DSM_COG_10_N45_00_E025_00_DEM"]
    assert len(tiles_for_bbox((24.9, 44.9, 25.1, 45.1))) == 4
