"""
Unit tests: Groq generates → Gemini edits → five analysis sections present.
"""

import unittest
from pathlib import Path
import sys
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.ai_analysis_pipeline import generate_test_analysis  # noqa: E402
from services.gemini_service import ANALYSIS_SECTION_KEYS  # noqa: E402

SAMPLE_GROQ_OUTPUT = """
LOWEST_RESULTS:
Слаби резултати при задачи с условни оператори.

HIGHEST_RESULTS:
Силни страни при базови понятия.

GAPS_ANALYSIS:
Пропуски в цикли и масиви.

RESULTS_ANALYSIS:
Общо представяне е средно с потенциал за подобрение.

IMPROVEMENT_MEASURES:
1. Допълнителни упражнения 2. Работа в двойки 3. Тестов сценарий
"""

SAMPLE_GEMINI_EDITED = SAMPLE_GROQ_OUTPUT.replace(
    "Слаби резултати", "Слаби, но подобряващи се резултати"
)


def _minimal_test_data():
    return {
        "class_name": "9А",
        "subject": "Информатика",
        "test_name": "Тест",
        "total_students": 10,
        "avg_points": 3.5,
        "avg_grade": 5.0,
        "min_points": 1,
        "max_points": 4,
        "students": [],
        "results": [],
        "participated_count": 8,
        "total_questions": 2,
    }


class TestAIAnalysisPipeline(unittest.TestCase):
    @patch("services.ai_analysis_pipeline.call_gemini_with_key_rotation")
    @patch("services.ai_analysis_pipeline.get_groq_service")
    @patch("services.ai_analysis_pipeline.build_analysis_prompt")
    def test_groq_then_gemini_edit_returns_five_sections(
        self,
        mock_build_prompt,
        mock_get_groq,
        mock_gemini_rotation,
    ):
        mock_build_prompt.return_value = "full prompt"
        groq_svc = MagicMock()
        groq_svc.generate_analysis_text.return_value = SAMPLE_GROQ_OUTPUT
        mock_get_groq.return_value = groq_svc
        mock_gemini_rotation.return_value = SAMPLE_GEMINI_EDITED

        result = generate_test_analysis(_minimal_test_data())

        groq_svc.generate_analysis_text.assert_called_once_with("full prompt")
        mock_gemini_rotation.assert_called_once()
        edit_fn = mock_gemini_rotation.call_args[0][0]
        fake_gemini = MagicMock()
        fake_gemini.edit_analysis_text.return_value = SAMPLE_GEMINI_EDITED
        edit_fn(fake_gemini)

        for key in ANALYSIS_SECTION_KEYS:
            self.assertIn(key, result)
            self.assertGreater(len(result[key]), 10, msg=key)

    @patch("services.ai_analysis_pipeline.call_gemini_with_key_rotation")
    @patch("services.ai_analysis_pipeline.get_groq_service")
    @patch("services.ai_analysis_pipeline.build_analysis_prompt")
    def test_gemini_exhausted_uses_groq_draft(
        self,
        mock_build_prompt,
        mock_get_groq,
        mock_gemini_rotation,
    ):
        from services.gemini_service import GeminiAPIError

        mock_build_prompt.return_value = "prompt"
        groq_svc = MagicMock()
        groq_svc.generate_analysis_text.return_value = SAMPLE_GROQ_OUTPUT
        mock_get_groq.return_value = groq_svc
        mock_gemini_rotation.side_effect = GeminiAPIError(
            "Лимитът е изчерпан. Опитай пак, утре!",
            is_rate_limit=True,
            all_keys_exhausted=True,
        )

        result = generate_test_analysis(_minimal_test_data())

        for key in ANALYSIS_SECTION_KEYS:
            self.assertIn(key, result)
            self.assertGreater(len(result[key]), 10, msg=key)

    @patch("services.ai_analysis_pipeline.call_gemini_with_key_rotation")
    @patch("services.ai_analysis_pipeline.get_groq_service")
    def test_groq_unavailable_gemini_only(self, mock_get_groq, mock_gemini_rotation):
        mock_get_groq.return_value = None
        expected = {k: f"Section {k}" for k in ANALYSIS_SECTION_KEYS}
        mock_gemini_rotation.return_value = expected

        result = generate_test_analysis(_minimal_test_data())

        mock_gemini_rotation.assert_called_once()
        self.assertEqual(result, expected)


if __name__ == "__main__":
    unittest.main()
