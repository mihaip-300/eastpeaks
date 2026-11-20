"""Quality report: out/qa_report.md (HANDOFF 5.2 step 7).

ERROR lines are blocking ("raportul QA nu are erori noi"); WARN lines are for review.
"""

from __future__ import annotations

from .config import EDITORIAL, GENERATED, OUT, WORK, load_resorts, read_json, setup_logging

KM_DIFF_LIMIT = 0.30
OSM_GRADIENT_DIFF_PP = 8.0  # flag runs where our avg gradient differs from OpenSkiMap's by more than this


def pct(part: int, whole: int) -> str:
    return f"{(100 * part / whole):.0f}%" if whole else "–"


def resort_section(resort, lines: list[str], issues: list[str]) -> None:
    work_path = WORK / f"{resort.slug}.json"
    gen_path = GENERATED / f"{resort.slug}.json"
    lines.append(f"## {resort.name} (`{resort.slug}`)\n")
    if not work_path.exists() or not gen_path.exists():
        issues.append(f"ERROR {resort.slug}: no processed data (ski area not matched or no runs)")
        lines.append("No data.\n")
        return

    work, gen = read_json(work_path), read_json(gen_path)
    runs = [f["properties"] for f in work["runs"]]
    if not runs:
        issues.append(f"ERROR {resort.slug}: resort has no runs")

    unnamed = sum(1 for r in runs if not r["name"])
    unknown = sum(1 for r in runs if r["difficulty"] == "unknown")
    suspect = [r for r in runs if r["suspect"]]
    km = gen["runs"]["km_total"]

    lines += [
        "| | |",
        "| --- | --- |",
        f"| Runs (after merging) | {len(runs)} (from {work['segments_in']} segments) |",
        f"| Km of runs | {km} |",
        f"| By difficulty (km) | {', '.join(f'{k} {v}' for k, v in gen['runs']['km_by_difficulty'].items() if v)} |",
        f"| Lifts | {gen['lifts']['count']} ({', '.join(f'{k} {v}' for k, v in gen['lifts']['by_type'].items())}) |",
        f"| Elevation (m) | {gen['elevation_m']['min']}–{gen['elevation_m']['max']} |",
        f"| Runs without name | {unnamed} ({pct(unnamed, len(runs))}) |",
        f"| Runs without difficulty | {unknown} ({pct(unknown, len(runs))}) |",
        f"| Suspect gradients | {len(suspect)} |",
        f"| Skipped OSM features | {work['skipped']} |",
        "",
    ]

    official = None
    editorial = EDITORIAL / f"{resort.slug}.json"
    if editorial.exists():
        official = read_json(editorial).get("official_km")
    if official:
        diff = abs(km - official) / official
        line = f"Computed {km} km vs official {official} km ({diff:.0%} difference)."
        lines.append(line + "\n")
        if diff > KM_DIFF_LIMIT:
            issues.append(f"WARN {resort.slug}: {line}")
    else:
        lines.append("No `official_km` in the editorial file yet.\n")

    if suspect:
        lines += ["**Suspect runs**\n", "| Run | Difficulty | Length | Drop | Avg % | Max % | Flags |", "| --- | --- | --- | --- | --- | --- | --- |"]
        for r in sorted(suspect, key=lambda r: -r["length_m"]):
            lines.append(
                f"| {r['name'] or '_(unnamed)_'} | {r['difficulty']} | {r['length_m']:.0f} m | {r['drop_m']:.0f} m "
                f"| {r['avg_gradient_pct']} | {r['max_gradient_100m_pct']} | {', '.join(r['suspect'])} |"
            )
        lines.append("")
        issues.append(f"WARN {resort.slug}: {len(suspect)} runs with suspect gradients")

    mismatched = [
        r for r in runs
        if r["osm_avg_gradient_pct"] is not None and r["length_m"] >= 150
        and abs(r["avg_gradient_pct"] - r["osm_avg_gradient_pct"]) > OSM_GRADIENT_DIFF_PP
    ]
    if mismatched:
        lines += [
            f"**Average gradient differs from OpenSkiMap's elevations by more than {OSM_GRADIENT_DIFF_PP:.0f} points**\n",
            "| Run | Length | Ours % | OpenSkiMap % |", "| --- | --- | --- | --- |",
        ]
        for r in sorted(mismatched, key=lambda r: -abs(r["avg_gradient_pct"] - r["osm_avg_gradient_pct"])):
            lines.append(f"| {r['name'] or '_(unnamed)_'} | {r['length_m']:.0f} m | {r['avg_gradient_pct']} | {r['osm_avg_gradient_pct']} |")
        lines.append("")
        issues.append(f"WARN {resort.slug}: {len(mismatched)} runs differ from OpenSkiMap elevations (check DEM / forest)")

    lines.append("**Steepest runs** (≥150 m, not suspect)\n")
    lines += ["| Run | Difficulty | Length | Drop | Avg % | Max 100 m % |", "| --- | --- | --- | --- | --- | --- |"]
    for r in gen["steepest_runs"]:
        lines.append(f"| {r['name'] or '_(unnamed)_'} | {r['difficulty']} | {r['length_m']} m | {r['drop_m']} m | {r['avg_gradient_pct']} | {r['max_gradient_100m_pct']} |")
    lines.append("")


def main() -> None:
    setup_logging()
    lines: list[str] = []
    issues: list[str] = []
    for resort in load_resorts():
        resort_section(resort, lines, issues)

    errors = [i for i in issues if i.startswith("ERROR")]
    header = [
        "# QA report",
        "",
        f"Errors: {len(errors)} · Warnings: {len(issues) - len(errors)}",
        "",
        *(f"- {i}" for i in issues),
        "",
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "qa_report.md").write_text("\n".join(header + lines) + "\n", encoding="utf-8", newline="\n")
    print("\n".join(header))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
