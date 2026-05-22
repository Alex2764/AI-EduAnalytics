"""
Unit tests for DocumentService._build_context — group correct-answer template keys.
"""

import unittest
from pathlib import Path
import sys

# Allow imports from backend root when running as script or via unittest discovery
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.document_service import DocumentService  # noqa: E402


def _three_question_test_data():
    """Test with 3 questions, each with two groups (group1 / group2)."""
    return {
        "class_name": "7а",
        "subject": "История",
        "test": {
            "name": "Тест две групи",
            "questions": [
                {
                    "text": "Въпрос 1",
                    "group1": {"text": "I група — въпрос 1", "correctAnswer": "а1"},
                    "group2": {"text": "II група — въпрос 1", "correctAnswer": "б1"},
                },
                {
                    "text": "Въпрос 2",
                    "group1": {"text": "I група — въпрос 2", "correctAnswer": "а2"},
                    "group2": {"text": "II група — въпрос 2", "correctAnswer": "б2"},
                },
                {
                    "text": "Въпрос 3",
                    "group1": {"text": "I група — въпрос 3", "correctAnswer": "а3"},
                    "group2": {"text": "II група — въпрос 3", "correctAnswer": "б3"},
                },
            ],
        },
        "q1_success": "90%",
        "q2_success": "75%",
        "q3_success": "60%",
    }


class TestBuildContextGroupCorrectAnswers(unittest.TestCase):
    """g{i}_q1_correct / g{i}_q2_correct map question i → group1 / group2 correctAnswer."""

    @classmethod
    def setUpClass(cls):
        cls.service = DocumentService()

    def test_three_questions_two_groups_fills_correct_answer_keys(self):
        context = self.service._build_context(_three_question_test_data(), {})

        self.assertEqual(context["total_questions"], 3)

        expected = {
            "g1_q1_correct": "а1",
            "g1_q2_correct": "б1",
            "g2_q1_correct": "а2",
            "g2_q2_correct": "б2",
            "g3_q1_correct": "а3",
            "g3_q2_correct": "б3",
        }
        for key, value in expected.items():
            with self.subTest(key=key):
                self.assertEqual(context[key], value)

    def test_slots_beyond_question_count_are_empty(self):
        context = self.service._build_context(_three_question_test_data(), {})

        for i in range(4, 25):
            with self.subTest(question_index=i):
                self.assertEqual(context[f"g{i}_q1_correct"], "")
                self.assertEqual(context[f"g{i}_q2_correct"], "")

    def test_missing_group_answers_default_to_empty_string(self):
        test_data = {
            "test": {
                "questions": [
                    {
                        "text": "Само I група",
                        "group1": {"text": "I", "correctAnswer": "верен"},
                        "group2": {"text": "II", "correctAnswer": ""},
                    },
                    {
                        "text": "Без групи",
                    },
                    {
                        "text": "Липсва group1",
                        "group2": {"text": "II", "correctAnswer": "б3"},
                    },
                ],
            },
        }
        context = self.service._build_context(test_data, {})

        self.assertEqual(context["g1_q1_correct"], "верен")
        self.assertEqual(context["g1_q2_correct"], "")
        self.assertEqual(context["g2_q1_correct"], "")
        self.assertEqual(context["g2_q2_correct"], "")
        self.assertEqual(context["g3_q1_correct"], "")
        self.assertEqual(context["g3_q2_correct"], "б3")


if __name__ == "__main__":
    unittest.main()
