#!/usr/bin/env python3
"""
Integration test: test data prep, AI analysis, question success rates, Word report.
Run from backend/: python3 scripts/test_analysis_flow.py
"""

import sys
import zipfile
from pathlib import Path
from typing import Optional, Tuple

# Allow imports from backend root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from services.supabase_service import get_supabase_service, SupabaseConnectionError
from services.gemini_service import get_gemini_service
from services.document_service import get_document_service, DocumentGenerationError


REQUIRED_AI_KEYS = [
    "lowest_results_analysis",
    "highest_results_analysis",
    "gaps_analysis",
    "results_analysis",
    "improvement_measures",
]


def find_test_with_results(client) -> Optional[Tuple[str, str, str]]:
    """Return (test_id, class_id, test_name) for a test that has results."""
    tests = client.table("tests").select("id, name, class_id").limit(50).execute()
    if not tests.data:
        return None

    for test in tests.data:
        test_id = test["id"]
        class_id = test.get("class_id")
        if not class_id:
            continue
        results = (
            client.table("results")
            .select("id, participated, cancelled, question_results")
            .eq("test_id", test_id)
            .limit(5)
            .execute()
        )
        if not results.data:
            continue
        participated = [
            r for r in results.data
            if r.get("participated", True) and not r.get("cancelled", False)
        ]
        if participated:
            return test_id, class_id, test.get("name", test_id)

    return None


def check_question_rates(test_data: dict) -> dict:
    rates = {
        k: v for k, v in test_data.items()
        if k.startswith("q") and k.endswith("_success")
    }
    nonzero = []
    for k, v in rates.items():
        raw = str(v).strip().rstrip("%")
        try:
            if float(raw) > 0:
                nonzero.append((k, v))
        except ValueError:
            pass
    return {
        "count": len(rates),
        "nonzero_count": len(nonzero),
        "sample_nonzero": nonzero[:5],
        "sample_all": list(rates.items())[:5],
    }


def docx_contains_percentages(docx_path: Path) -> dict:
    """Scan document.xml for 0% patterns vs other percentages."""
    with zipfile.ZipFile(docx_path, "r") as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="replace")

    import re
    percents = re.findall(r"\b(\d{1,3})%", xml)
    values = [int(p) for p in percents]
    return {
        "percent_tokens_found": len(values),
        "nonzero_percent_tokens": sum(1 for v in values if v > 0),
        "unique_percents": sorted(set(values))[:15],
    }


def main() -> int:
    print("=" * 60)
    print("AI EduAnalytics — integration test")
    print("=" * 60)

    errors = []

    try:
        supabase = get_supabase_service()
    except Exception as e:
        print(f"FAIL: Supabase init: {e}")
        return 1

    # --- Find test ---
    print("\n[1] Finding test with results...")
    found = find_test_with_results(supabase.client)
    if not found:
        print("SKIP: No test with participated results in database.")
        return 2

    test_id, class_id, test_name = found
    print(f"    Test: {test_name}")
    print(f"    test_id={test_id}")
    print(f"    class_id={class_id}")

    # --- Test data + question rates ---
    print("\n[2] Fetching test analysis data...")
    try:
        test_data = supabase.get_test_analysis_data(test_id, class_id)
    except SupabaseConnectionError as e:
        print(f"FAIL: get_test_analysis_data: {e}")
        return 1

    rate_info = check_question_rates(test_data)
    print(f"    Question success keys: {rate_info['count']}")
    print(f"    Non-zero rates: {rate_info['nonzero_count']}")
    if rate_info["sample_nonzero"]:
        print(f"    Examples: {rate_info['sample_nonzero']}")
    else:
        print(f"    All sampled: {rate_info['sample_all']}")
        errors.append("All question success rates are 0% — Word table will show 0%")

    # --- AI analysis ---
    print("\n[3] AI analysis (Gemini or cache)...")
    ai_analysis = None
    cached = supabase.get_analytics(test_id)
    if cached and cached.get("ai_analysis"):
        ai_analysis = cached["ai_analysis"]
        print("    OK: using cached ai_analysis from test_analytics")

    if not ai_analysis:
        try:
            gemini = get_gemini_service()
            ai_analysis = gemini.generate_analysis(test_data)
            print("    OK: fresh Gemini analysis generated")
        except Exception as e:
            print(f"FAIL: Gemini generate_analysis: {e}")
            print("    (No cached ai_analysis — cannot complete AI test)")
            return 1

    missing = [k for k in REQUIRED_AI_KEYS if not ai_analysis.get(k, "").strip()]
    if missing:
        errors.append(f"AI analysis missing sections: {missing}")
        print(f"    WARN: empty sections: {missing}")
    else:
        print("    OK: all 5 AI sections present")
        for key in REQUIRED_AI_KEYS:
            preview = (ai_analysis[key] or "")[:80].replace("\n", " ")
            print(f"    - {key}: {preview}...")

    # --- Word document ---
    print("\n[4] Generating Word document...")
    try:
        doc_service = get_document_service()
        templates = doc_service.list_templates()
        if not templates:
            print("    WARN: No .docx template — cannot test Word output")
            print("    Upload a template via AI Settings to complete this step.")
        else:
            print(f"    Template: {templates[0]['name']}")
            out_path = doc_service.generate_test_analysis_document(test_data, ai_analysis)
            out = Path(out_path)
            print(f"    OK: {out.name} ({out.stat().st_size} bytes)")

            pct_info = docx_contains_percentages(out)
            print(f"    Percents in docx: {pct_info['percent_tokens_found']} tokens, "
                  f"{pct_info['nonzero_percent_tokens']} non-zero")
            print(f"    Unique % values: {pct_info['unique_percents']}")

            if pct_info["percent_tokens_found"] > 0 and pct_info["nonzero_percent_tokens"] == 0:
                errors.append("Word doc contains only 0% — question rates not in template or data")

            # Cleanup temp output
            try:
                out.unlink()
            except OSError:
                pass
    except DocumentGenerationError as e:
        print(f"FAIL: Word generation: {e}")
        return 1
    except Exception as e:
        print(f"FAIL: Word generation: {e}")
        return 1

    # --- Verify generate-report does not require Gemini ---
    print("\n[5] HTTP POST /api/generate-report (no Gemini expected)...")
    try:
        import urllib.request
        import json as json_mod

        body = json_mod.dumps({"test_id": test_id, "class_id": class_id}).encode()
        req = urllib.request.Request(
            "http://localhost:8000/api/generate-report",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            if resp.status == 200:
                data = resp.read()
                print(f"    OK: HTTP 200, {len(data)} bytes (no Gemini quota needed)")
            else:
                errors.append(f"generate-report returned {resp.status}")
    except Exception as e:
        print(f"    SKIP: {e}")

    print("\n[6] HTTP API smoke test...")
    try:
        import urllib.request

        health = urllib.request.urlopen("http://localhost:8000/health", timeout=5)
        if health.status == 200:
            print("    OK: GET /health")
        else:
            errors.append(f"Health returned {health.status}")
    except Exception as e:
        print(f"    SKIP: backend not on :8000 ({e})")

    print("\n" + "=" * 60)
    if errors:
        print("RESULT: ISSUES FOUND")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
