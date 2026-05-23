"""Prompt must not include individual student names."""

import unittest
from pathlib import Path
import sys

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.gemini_service import (  # noqa: E402
    GeminiService,
    build_analysis_prompt,
)


class TestAnonymousAnalysisPrompt(unittest.TestCase):
    def test_summary_has_no_names(self):
        students = [
            {"id": "s1", "first_name": "Иван", "last_name": "Петров", "gender": "male"},
            {"id": "s2", "first_name": "Мария", "last_name": "Георгиева", "gender": "female"},
        ]
        results = [
            {"student_id": "s1", "participated": True, "points": 4, "grade": 6},
            {"student_id": "s2", "participated": True, "points": 1.5, "grade": 3},
        ]
        summary = GeminiService._build_anonymous_performance_summary(students, results, 4)
        self.assertIn("Най-висок резултат", summary)
        self.assertNotIn("Иван", summary)
        self.assertNotIn("Мария", summary)
        self.assertNotIn("Unknown", summary)

    def test_full_prompt_forbids_names(self):
        prompt = build_analysis_prompt(
            {
                "class_name": "9А",
                "subject": "Информатика",
                "test_name": "Тест",
                "total_students": 2,
                "avg_points": 2.75,
                "avg_grade": 4.5,
                "min_points": 1.5,
                "max_points": 4,
                "participated_count": 2,
                "total_questions": 1,
                "students": [
                    {"id": "s1", "first_name": "Иван", "last_name": "Петров", "gender": "male"},
                ],
                "results": [
                    {"student_id": "s1", "participated": True, "points": 4, "grade": 6},
                ],
                "test": {"max_points": 4},
                "max_points_test": 4,
            }
        )
        self.assertIn("НЕ споменавай имена", prompt)
        self.assertNotIn("ДЕТАЙЛИ ЗА УЧЕНИЦИТЕ", prompt)
        self.assertNotIn("Иван", prompt)
        self.assertIn("ОБОБЩЕНИ РЕЗУЛТАТИ", prompt)


if __name__ == "__main__":
    unittest.main()
