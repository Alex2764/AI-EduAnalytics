"""
Gemini AI Service for generating test analysis
"""

import re
import logging
from typing import Dict, Any, Optional, List
import time

try:
    import google.generativeai as genai
except ImportError:
    raise ImportError("google-generativeai not installed. Run: pip install google-generativeai")

# Import settings
from config import get_settings, get_effective_gemini_api_key, CONFIG_FILE_PATH
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# gemini-1.5-flash removed from Google API (v1beta) — use 2.x models
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
PREFERRED_GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-preview-05-20",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro-latest",
]
MAX_MODEL_FALLBACK_ATTEMPTS = 4
GEMINI_EDIT_MAX_OUTPUT_TOKENS = 800
GEMINI_EDIT_PROMPT_PREFIX = (
    "Редактирай следния анализ на български за качество и стил. "
    "Запази всички секции и структурата. "
    "Запази задължително заглавията LOWEST_RESULTS:, HIGHEST_RESULTS:, GAPS_ANALYSIS:, "
    "RESULTS_ANALYSIS:, IMPROVEMENT_MEASURES: непроменени. "
    "НЕ използвай имена на отделни ученици — ако има такива, замени ги с общи формулировки "
    "(напр. „учениците“, „част от класа“, „ученици с по-ниски резултати“). "
    "Върни само редактирания текст:\n\n"
)

ANALYSIS_SECTION_KEYS = [
    "lowest_results_analysis",
    "highest_results_analysis",
    "gaps_analysis",
    "results_analysis",
    "improvement_measures",
]


class GeminiAPIError(Exception):
    """Custom exception for Gemini API errors"""
    def __init__(
        self,
        message: str,
        is_rate_limit: bool = False,
        retry_after: Optional[int] = None,
        all_keys_exhausted: bool = False,
        model_not_found: bool = False,
    ):
        super().__init__(message)
        self.is_rate_limit = is_rate_limit
        self.retry_after = retry_after  # seconds
        self.all_keys_exhausted = all_keys_exhausted
        self.model_not_found = model_not_found


class ParsingError(Exception):
    """Custom exception for AI response parsing errors"""
    pass


class GeminiService:
    """Service for interacting with Google Gemini AI"""
    
    def __init__(self, api_key: Optional[str] = None):
        settings = get_settings()
        if not api_key:
            api_key = get_effective_gemini_api_key(settings)
        
        if not api_key:
            logger.error("Gemini API key not configured (.env or AI settings)")
            raise ValueError(
                "Gemini API ключ не е настроен. Добавете GEMINI_API_KEY в .env "
                "или нов ключ в AI настройки."
            )
        
        try:
            genai.configure(api_key=api_key)
            self.settings = settings
            self.max_retries = 2
            self.retry_delay = 2
            self._max_output_tokens, self._temperature = self._read_generation_params()
            model_name = self._resolve_working_model(settings.gemini_model)
            self.model_name = model_name
            self.model = self._build_generative_model(model_name)
            logger.info(
                "Gemini ready: model=%s, max_output_tokens=%s",
                model_name,
                self._max_output_tokens,
            )
        except GeminiAPIError:
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
            raise GeminiAPIError(f"Failed to initialize Gemini: {e}")
    
    def _read_generation_params(self) -> tuple:
        max_tokens = 1200
        temperature = 0.7
        if CONFIG_FILE_PATH.exists():
            try:
                with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                    ai = (json.load(f).get("ai_settings") or {})
                max_tokens = int(ai.get("max_output_tokens", max_tokens))
                temperature = float(ai.get("temperature", temperature))
            except Exception as e:
                logger.debug("Using default generation params: %s", e)
        return min(max(max_tokens, 400), 2048), max(0.0, min(temperature, 1.0))

    def _build_generative_model(self, model_name: str):
        return genai.GenerativeModel(
            model_name,
            generation_config={
                "max_output_tokens": self._max_output_tokens,
                "temperature": self._temperature,
            },
        )

    def _resolve_working_model(self, configured: Optional[str] = None) -> str:
        """Pick first model that supports generateContent (API list or preferred fallbacks)."""
        preferred: List[str] = []
        if configured and configured.strip():
            preferred.append(configured.strip())
        for name in PREFERRED_GEMINI_MODELS:
            if name not in preferred:
                preferred.append(name)

        available_short: List[str] = []
        try:
            for model in genai.list_models():
                methods = getattr(model, "supported_generation_methods", []) or []
                if "generateContent" not in methods:
                    continue
                short = model.name.replace("models/", "") if model.name else ""
                if short:
                    available_short.append(short)
            logger.info("Gemini API reports %d generateContent models", len(available_short))
        except Exception as e:
            logger.warning("Could not list Gemini models: %s — using preferred defaults", e)
            return preferred[0]

        if not available_short:
            return preferred[0]

        for candidate in preferred:
            if candidate in available_short:
                logger.info("Using configured/preferred Gemini model: %s", candidate)
                return candidate
            for api_name in available_short:
                if candidate.lower() in api_name.lower():
                    logger.info("Using matched Gemini model: %s (wanted %s)", api_name, candidate)
                    return api_name

        for api_name in available_short:
            if "flash" in api_name.lower() and "2." in api_name:
                logger.info("Using first available flash model: %s", api_name)
                return api_name

        logger.info("Using first available Gemini model: %s", available_short[0])
        return available_short[0]

    @staticmethod
    def _is_model_not_found_error(exc: Exception) -> bool:
        name = type(exc).__name__.lower()
        msg = str(exc).lower()
        return (
            "notfound" in name
            or "404" in msg
            or "is not found" in msg
            or "not supported for generatecontent" in msg
        )

    @staticmethod
    def _is_daily_quota_exhausted(error_details: str) -> bool:
        """Only true for daily free-tier limits — not per-minute bursts."""
        d = error_details.replace("_", " ").lower()
        return (
            "perday" in d.replace(" ", "")
            or "per day" in d
            or "generaterequestsperday" in d.replace(" ", "")
        )

    @staticmethod
    def _is_per_minute_quota(error_details: str) -> bool:
        d = error_details.replace("_", " ").lower()
        return "perminute" in d.replace(" ", "") or "per minute" in d

    def generate_analysis(
        self, 
        test_data: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Generate AI-powered analysis for test results
        
        Args:
            test_data: Test information and statistics
        
        Returns:
            Dict with 5 analysis sections
        
        Raises:
            GeminiAPIError: If API call fails
            ParsingError: If parsing fails
        """
        
        logger.info(f"Generating analysis for class: {test_data.get('class_name', 'Unknown')}")
        
        # Extract data with defaults
        class_name = test_data.get("class_name", "Unknown")
        subject = test_data.get("subject", "Unknown")
        total_students = test_data.get("total_students", 0)
        avg_points = test_data.get("avg_points", 0)
        avg_grade = test_data.get("avg_grade", 0)
        min_points = test_data.get("min_points", 0)
        max_points = test_data.get("max_points", 100)
        
        # Extract detailed student data if available
        students = test_data.get("students", [])
        results = test_data.get("results", [])
        
        logger.debug(f"Test data: students={total_students}, avg={avg_points}/{max_points}")
        logger.debug(f"Student details available: {len(students)} students, {len(results)} results")
        
        prompt = self._build_prompt_from_test_data(test_data)
        ai_text = self._call_gemini_with_model_fallback(prompt)
        logger.info(f"Received AI response: {len(ai_text)} characters")
        return parse_and_validate_analysis(ai_text)

    def edit_analysis_text(self, draft_text: str) -> str:
        """
        Stage 2: polish Groq draft (short prompt, max 800 output tokens).
        """
        if not draft_text or not draft_text.strip():
            raise GeminiAPIError("Празен текст за редакция от Gemini")
        prompt = GEMINI_EDIT_PROMPT_PREFIX + draft_text.strip()
        logger.info("Gemini: editing Groq draft (%d chars in)", len(draft_text))
        return self._call_gemini_with_model_fallback(
            prompt,
            max_output_tokens=GEMINI_EDIT_MAX_OUTPUT_TOKENS,
        )

    @staticmethod
    def _build_anonymous_performance_summary(
        students: Optional[List[Dict[str, Any]]],
        results: Optional[List[Dict[str, Any]]],
        test_max_points: float,
    ) -> str:
        """
        Build aggregate result lines for the prompt — no student names.
        """
        if not students or not results:
            return ""

        try:
            if not isinstance(students, list) or not isinstance(results, list):
                return ""

            scores: List[Dict[str, Any]] = []
            for student in students:
                if not isinstance(student, dict):
                    continue
                student_id = student.get("id") or student.get("student_id")
                student_result = None
                for result in results:
                    if not isinstance(result, dict):
                        continue
                    result_student_id = result.get("student_id") or result.get("student")
                    if result_student_id == student_id or result.get("student") == student_id:
                        student_result = result
                        break
                if not student_result or not student_result.get("participated", True):
                    continue
                points = float(
                    student_result.get("points") or student_result.get("total_points") or 0
                )
                grade = student_result.get("grade", 0)
                percentage = student_result.get("percentage")
                if percentage is None and test_max_points > 0:
                    percentage = round((points / test_max_points) * 100, 1)
                gender = student.get("gender", "")
                if gender in ("male", "М", "м"):
                    gender_label = "момчета"
                elif gender in ("female", "Ж", "ж"):
                    gender_label = "момичета"
                else:
                    gender_label = ""
                scores.append({
                    "points": points,
                    "grade": grade,
                    "percentage": percentage,
                    "gender_label": gender_label,
                })

            if not scores:
                return ""

            scores.sort(key=lambda x: x["points"], reverse=True)
            lines = ["\n\nОБОБЩЕНИ РЕЗУЛТАТИ (без имена на ученици):"]
            lines.append(
                f"- Най-висок резултат: {scores[0]['points']}т., оценка {scores[0]['grade']}"
            )
            lines.append(
                f"- Най-нисък резултат: {scores[-1]['points']}т., оценка {scores[-1]['grade']}"
            )

            top_n = min(3, len(scores))
            bottom_n = min(3, len(scores))
            top_pts = ", ".join(f"{s['points']}т." for s in scores[:top_n])
            bottom_pts = ", ".join(f"{s['points']}т." for s in scores[-bottom_n:])
            lines.append(f"- Три най-високи резултата: {top_pts}")
            if len(scores) > 3:
                lines.append(f"- Три най-ниски резултата: {bottom_pts}")

            boys = [s["points"] for s in scores if s["gender_label"] == "момчета"]
            girls = [s["points"] for s in scores if s["gender_label"] == "момичета"]
            if boys:
                lines.append(f"- Средно при момчетата (взели теста): {round(sum(boys) / len(boys), 1)}т.")
            if girls:
                lines.append(f"- Средно при момичетата (взели теста): {round(sum(girls) / len(girls), 1)}т.")

            return "\n".join(lines) + "\n"
        except Exception as e:
            logger.warning(f"Error building anonymous performance summary: {e}")
            return ""

    def _build_prompt_from_test_data(self, test_data: Dict[str, Any]) -> str:
        return self._build_prompt(
            test_data.get("class_name", "Unknown"),
            test_data.get("subject", "Unknown"),
            test_data.get("total_students", 0),
            test_data.get("avg_points", 0),
            test_data.get("avg_grade", 0),
            test_data.get("min_points", 0),
            test_data.get("max_points", 100),
            test_data.get("students", []),
            test_data.get("results", []),
            test_data,
        )
    
    def _build_prompt(
        self,
        class_name: str,
        subject: str,
        total_students: int,
        avg_points: float,
        avg_grade: float,
        min_points: float,
        max_points: float,
        students: Optional[List[Dict[str, Any]]] = None,
        results: Optional[List[Dict[str, Any]]] = None,
        test_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build comprehensive prompt for test analysis
        
        Args:
            class_name: Name of the class
            subject: Subject name
            total_students: Total number of students in the class
            avg_points: Average points achieved
            avg_grade: Average grade
            min_points: Minimum points achieved
            max_points: Maximum points achieved
            students: Optional list of student dictionaries
            results: Optional list of test result dictionaries
            test_data: Optional dictionary with additional test data
        
        Returns:
            Formatted prompt string for AI analysis
        """
        
        students = students or []
        results = results or []
        test_data = test_data or {}
        
        # Extract additional important data
        test_name = test_data.get("test_name", "Тест")
        test_max_points = test_data.get("test", {}).get("max_points") or test_data.get("max_points_test", 100)
        total_questions = test_data.get("total_questions", 0)
        mc_questions = test_data.get("mc_questions", 0)
        short_questions = test_data.get("short_questions", 0)
        boys_count = test_data.get("boys_count", 0)
        girls_count = test_data.get("girls_count", 0)
        
        # Get participated count from test_data (already calculated in programmatic analysis)
        participated_count = test_data.get("participated_count", 0)
        
        # Calculate statistics by gender
        gender_stats = {"М": [], "Ж": [], "male": [], "female": []}
        if isinstance(results, list) and isinstance(students, list):
            for result in results:
                if result.get("participated", True):
                    points = result.get("points") or result.get("total_points", 0)
                    # Find matching student
                    result_student_id = result.get("student_id") or result.get("student")
                    for student in students:
                        if not isinstance(student, dict):
                            continue
                        student_id = student.get("id") or student.get("student_id")
                        if student_id == result_student_id:
                            gender = student.get("gender", "")
                            if gender in gender_stats:
                                gender_stats[gender].append(points)
                            break
        
        # Extract calculated statistics from test_data (from programmatic analysis)
        grade_distribution_stats = test_data.get("grade_distribution", {})
        grade_percentages_stats = test_data.get("grade_percentages", {})
        good_grades_percentage = test_data.get("good_grades_percentage", 0)
        pass_rate = test_data.get("pass_rate", 0)
        avg_percentage = test_data.get("avg_percentage", 0)
        non_participating_count = test_data.get("non_participating_count", 0)
        
        # Build grade distribution text (use calculated statistics from programmatic analysis)
        grade_dist_text = ""
        if grade_distribution_stats and isinstance(grade_distribution_stats, dict):
            grade_dist_text = "\n- Разпределение по оценки: "
            dist_items = []
            for grade in sorted(grade_distribution_stats.keys(), reverse=True):
                try:
                    count = grade_distribution_stats.get(grade, 0)
                    percentage = grade_percentages_stats.get(grade, 0) if grade_percentages_stats else 0
                    if count > 0:
                        dist_items.append(f"{count} ученика с оценка {grade} ({percentage}%)")
                except (KeyError, TypeError, AttributeError) as e:
                    logger.warning(f"Error processing grade {grade} in distribution: {e}")
                    continue
            if dist_items:
                grade_dist_text += ", ".join(dist_items)
            else:
                grade_dist_text = ""  # Don't show empty distribution
        
        # Add calculated statistics from programmatic analysis
        statistics_text = ""
        if good_grades_percentage > 0 or pass_rate > 0:
            statistics_text = "\n\nСТАТИСТИКИ (изчислени с формули):\n"
            statistics_text += f"- Процент на добри оценки (5-6): {good_grades_percentage}%\n"
            statistics_text += f"- Процент на успеваемост (≥3.00): {pass_rate}%\n"
            if avg_percentage > 0:
                statistics_text += f"- Среден процент: {avg_percentage}%\n"
            if non_participating_count > 0:
                statistics_text += f"- Ученици, които НЕ са участвали: {non_participating_count}\n"
        
        # Build gender statistics
        gender_stats_text = ""
        if boys_count > 0 or girls_count > 0:
            gender_stats_text = f"\n- Ученици: {boys_count} момчета, {girls_count} момичета"
        
        # Gender performance stats
        boys_list = (gender_stats.get("М", []) or []) + (gender_stats.get("male", []) or [])
        girls_list = (gender_stats.get("Ж", []) or []) + (gender_stats.get("female", []) or [])
        
        boys_avg = None
        if boys_list and len(boys_list) > 0:
            try:
                boys_avg = sum(boys_list) / len(boys_list)
            except (TypeError, ZeroDivisionError) as e:
                logger.warning(f"Error calculating boys average: {e}")
                boys_avg = None
        
        girls_avg = None
        if girls_list and len(girls_list) > 0:
            try:
                girls_avg = sum(girls_list) / len(girls_list)
            except (TypeError, ZeroDivisionError) as e:
                logger.warning(f"Error calculating girls average: {e}")
                girls_avg = None
        
        if boys_avg is not None or girls_avg is not None:
            gender_stats_text += "\n- Средни точки по пол: "
            if boys_avg is not None:
                gender_stats_text += f"Момчета: {round(boys_avg, 1)}т., "
            if girls_avg is not None:
                gender_stats_text += f"Момичета: {round(girls_avg, 1)}т."
        
        # Anonymous aggregate performance (no individual names in prompt or output)
        student_details = self._build_anonymous_performance_summary(
            students, results, test_max_points
        )
        
        # Add question success rates if available
        question_analysis = ""
        if total_questions > 0:
            question_analysis = "\n\nУСПЕХ ПО ВЪПРОСИ (колко % от учениците са отговорили правилно):\n"
            for i in range(1, min(total_questions + 1, 20)):
                q_success_key = f"q{i}_success"
                success_rate = test_data.get(q_success_key, "0%")
                question_analysis += f"- Въпрос {i}: {success_rate}\n"
        
        # Test structure info
        test_structure = ""
        if total_questions > 0:
            test_structure = f"\n- Структура на теста: {total_questions} общо въпроси"
            if mc_questions > 0:
                test_structure += f", {mc_questions} изборни"
            if short_questions > 0:
                test_structure += f", {short_questions} кратки"
        
        return f"""
Ти си опитен учител по {subject}. Направи професионален анализ на резултатите от тест.

ДАННИ ЗА ТЕСТА:
- Име на теста: {test_name}
- Клас: {class_name}
- Предмет: {subject}
- Общ брой точки на теста: {test_max_points}т.
{test_structure}
- Брой ученици в класа: {total_students}
- Ученици, които са взели теста: {participated_count}
{gender_stats_text}
- Резултати: Минимум {min_points}т., Максимум {max_points}т., Средно {avg_points}т.
- Средна оценка: {avg_grade}/6.00{grade_dist_text}{statistics_text}{student_details}{question_analysis}

Генерирай 5 ОТДЕЛНИ кратки анализа (всеки до 80–100 думи, общо компактно):

1. LOWEST_RESULTS: Анализ на най-ниските резултати - защо учениците имат затруднения, 
   конкретни теми с проблеми, възможни причини.

2. HIGHEST_RESULTS: Анализ на най-високите резултати - какво учениците владеят добре,
   силни страни, теми които са усвоени отлично.

3. GAPS_ANALYSIS: Основни пропуски в учебното съдържание - конкретни теми,
   области които се нуждаят от внимание, какво липсва.

4. RESULTS_ANALYSIS: Общ анализ на резултатите - сравнение на силни и слаби,
   разпределение, причини за резултатите, общи тенденции.

5. IMPROVEMENT_MEASURES: Конкретни мерки за подобрение - поне 5 точки,
   практически препоръки, методи за преодоляване на пропуските.

ВАЖНО: 
- Пиши на професионален, но разбираем български език
- Бъди конкретен и конструктивен
- Използвай данните за анализ
- Всеки анализ трябва да е отделен параграф
- НЕ използвай markdown форматиране (**, ##, и т.н.)
- НЕ споменавай имена на отделни ученици (нито реални, нито измислени)
- Говори само общо: „учениците“, „част от класа“, „ученици с по-ниски/по-високи резултати“, „най-слабите/най-силните резултати“

ФОРМАТ НА ОТГОВОРА - ЗАДЪЛЖИТЕЛНО използвай ТОЧНО тези заглавия:
LOWEST_RESULTS:
[текст тук]

HIGHEST_RESULTS:
[текст тук]

GAPS_ANALYSIS:
[текст тук]

RESULTS_ANALYSIS:
[текст тук]

IMPROVEMENT_MEASURES:
[текст тук]
"""
        
    @staticmethod
    def _exception_is_invalid_argument(exc: Exception) -> bool:
        name = type(exc).__name__
        msg = str(exc).lower()
        return "invalidargument" in name.lower() or "invalid argument" in msg

    @staticmethod
    def _exception_is_invalid_api_key(exc: Exception) -> bool:
        msg = str(exc).lower()
        return (
            "api key not valid" in msg
            or "api_key_invalid" in msg
            or "invalid api key" in msg
            or ("api key" in msg and "invalid" in msg)
        )

    def _get_fallback_model_names(self) -> List[str]:
        ordered: List[str] = []
        current = getattr(self, "model_name", None)
        if current:
            ordered.append(current)
        for name in PREFERRED_GEMINI_MODELS:
            if name not in ordered:
                ordered.append(name)
        return ordered[:MAX_MODEL_FALLBACK_ATTEMPTS]

    def _call_gemini_with_model_fallback(
        self,
        prompt: str,
        max_output_tokens: Optional[int] = None,
    ) -> str:
        """Try alternate Gemini models when the active one returns InvalidArgument."""
        saved_tokens = self._max_output_tokens
        saved_model_name = self.model_name
        if max_output_tokens is not None:
            self._max_output_tokens = max_output_tokens
            self.model = self._build_generative_model(self.model_name)
        last_error: Optional[GeminiAPIError] = None
        try:
            for model_name in self._get_fallback_model_names():
                try:
                    if model_name != getattr(self, "model_name", None):
                        logger.info("Switching Gemini model to: %s", model_name)
                        self.model = self._build_generative_model(model_name)
                        self.model_name = model_name
                    return self._call_gemini_with_retry(prompt)
                except GeminiAPIError as e:
                    last_error = e
                    err_text = str(e).lower()
                    if "невалиден gemini api ключ" in err_text or (
                        "api key" in err_text and "invalid" in err_text
                    ):
                        raise
                    if getattr(e, "model_not_found", False) or "is not found" in err_text:
                        logger.warning(
                            "Model %s not found, trying next model...",
                            model_name,
                        )
                        continue
                    if "invalidargument" in err_text or "invalid argument" in err_text:
                        logger.warning(
                            "Model %s returned InvalidArgument, trying next model...",
                            model_name,
                        )
                        continue
                    if e.is_rate_limit and not GeminiService._is_daily_quota_exhausted(
                        err_text
                    ):
                        raise GeminiAPIError(
                            "Временен лимит на Gemini (на минута). Изчакайте ~1 минута и опитайте отново.",
                            is_rate_limit=True,
                            retry_after=15,
                        )
                    if e.is_rate_limit:
                        logger.warning(
                            "Model %s hit daily quota, trying next model...",
                            model_name,
                        )
                        continue
                    raise
            if last_error:
                raise last_error
            raise GeminiAPIError(
                "Неуспешно генериране на AI анализ: няма работещ Gemini модел за този API ключ."
            )
        finally:
            if max_output_tokens is not None:
                self._max_output_tokens = saved_tokens
                self.model_name = saved_model_name
                self.model = self._build_generative_model(self.model_name)

    def _call_gemini_with_retry(self, prompt: str) -> str:
        """
        Call Gemini API with retry logic
        
        Args:
            prompt: The prompt to send
        
        Returns:
            AI generated text
        
        Raises:
            GeminiAPIError: If all retries fail
        """
        
        last_error = None
        
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(f"Calling Gemini API (attempt {attempt}/{self.max_retries})...")
                
                # Call Gemini API (same simple approach as notebook)
                response = self.model.generate_content(prompt)
                
                # Check if response exists
                if not response:
                    raise GeminiAPIError("Empty response from Gemini API")
                
                # Extract text directly (same as notebook: response.text.strip())
                try:
                    ai_text = response.text.strip()
                    if not ai_text:
                        raise GeminiAPIError("Empty text in Gemini response")
                except (AttributeError, Exception) as e:
                    logger.error(f"Error extracting text from response: {e}")
                    logger.error(f"Response type: {type(response)}")
                    # Log response structure for debugging
                    try:
                        if hasattr(response, 'prompt_feedback'):
                            logger.error(f"Prompt feedback: {response.prompt_feedback}")
                        if hasattr(response, 'candidates') and response.candidates:
                            candidate = response.candidates[0]
                            if hasattr(candidate, 'finish_reason'):
                                logger.error(f"Finish reason: {candidate.finish_reason}")
                            if hasattr(candidate, 'safety_ratings'):
                                logger.error(f"Safety ratings: {candidate.safety_ratings}")
                    except Exception as log_error:
                        logger.error(f"Could not log additional info: {log_error}")
                    raise GeminiAPIError(f"Failed to extract text from Gemini response: {str(e)}")
                
                logger.info(f"Successfully received response: {len(ai_text)} characters")
                return ai_text
                
            except Exception as e:
                last_error = e
                error_type = type(e).__name__
                error_details = str(e)
                logger.warning(f"Attempt {attempt} failed: {error_type}: {error_details}")

                if self._is_model_not_found_error(e):
                    raise GeminiAPIError(
                        f"Моделът {getattr(self, 'model_name', '?')} не е наличен в Gemini API. "
                        f"{error_details[:250]}",
                        model_not_found=True,
                    )

                # InvalidArgument is not transient — do not retry the same model 3 times
                if self._exception_is_invalid_argument(e):
                    if self._exception_is_invalid_api_key(e):
                        raise GeminiAPIError(
                            "Невалиден Gemini API ключ. Проверете ключовете в AI настройки "
                            f"или gemini_api_keys.local.json. ({error_details[:200]})",
                            is_rate_limit=False,
                        )
                    raise GeminiAPIError(
                        "Грешка при заявката към Gemini (InvalidArgument). "
                        f"Модел: {getattr(self, 'model_name', 'unknown')}. "
                        f"{error_details[:300]}",
                    )
                
                # Check for ResourceExhausted (rate limit / quota exceeded)
                if "ResourceExhausted" in error_type or "429" in error_details or "quota" in error_details.lower():
                    user_msg = "Квотата за Gemini API е изчерпана. "
                    if "free_tier" in error_details.lower():
                        user_msg += "Безплатният план е изчерпан. "
                    user_msg += "Опитайте отново утре или с друг API ключ."

                    if self._is_daily_quota_exhausted(error_details):
                        logger.warning(
                            "Daily quota for model %s — try next model or key",
                            getattr(self, "model_name", "?"),
                        )
                        raise GeminiAPIError(user_msg, is_rate_limit=True)

                    if self._is_per_minute_quota(error_details):
                        retry_delay = self.retry_delay
                        delay_match = re.search(
                            r"retry.*?(\d+(?:\.\d+)?)\s*s", error_details, re.IGNORECASE
                        )
                        if delay_match:
                            retry_delay = min(int(float(delay_match.group(1))), 15)
                        if attempt < self.max_retries:
                            logger.info("Per-minute limit — retry in %ss", retry_delay)
                            time.sleep(retry_delay)
                            continue
                        raise GeminiAPIError(
                            "Временен лимит на Gemini (на минута). Изчакайте ~1 минута и опитайте отново.",
                            is_rate_limit=True,
                            retry_after=retry_delay,
                        )

                    raise GeminiAPIError(user_msg, is_rate_limit=True)
                
                # Log full traceback for debugging
                import traceback
                logger.debug(f"Full traceback:\n{traceback.format_exc()}")
                
                # If not last attempt, wait and retry
                if attempt < self.max_retries:
                    logger.info(f"Retrying in {self.retry_delay} seconds...")
                    time.sleep(self.retry_delay)
                    continue
        
        # All retries failed
        error_type = type(last_error).__name__ if last_error else "Unknown"
        error_details = str(last_error) if last_error else "No error details"
        
        # Create user-friendly error message
        if "ResourceExhausted" not in error_type and "429" not in error_details:
            error_msg = f"Неуспешно генериране на AI анализ след {self.max_retries} опита: {error_type}"
            if len(error_details) < 200:  # Only include details if not too long
                error_msg += f": {error_details}"
        else:
            error_msg = error_details  # Already formatted above
        
        logger.error(error_msg)
        raise GeminiAPIError(error_msg)
    
    def _parse_ai_response(self, ai_text: str) -> Dict[str, str]:
        """
        Parse AI response into structured sections using flexible regex
        
        Args:
            ai_text: Raw AI response text
        
        Returns:
            Dict with parsed sections
        
        Raises:
            ParsingError: If parsing completely fails
        """
        
        logger.debug("Parsing AI response...")
        sections = {}
        
        # Ensure ai_text is a string and not empty
        if not isinstance(ai_text, str):
            logger.error(f"AI text is not a string: {type(ai_text)}")
            ai_text = str(ai_text) if ai_text else ""
        
        if not ai_text or not ai_text.strip():
            logger.warning("AI text is empty, using default sections")
            return {
                'lowest_results_analysis': 'Анализ на най-ниските резултати.',
                'highest_results_analysis': 'Анализ на най-високите резултати.',
                'gaps_analysis': 'Анализ на пропуските.',
                'results_analysis': 'Общ анализ на резултатите.',
                'improvement_measures': 'Мерки за подобрение.'
            }
        
        try:
            # Extended regex patterns for flexible matching
            # Handles variations like:
            # - "LOWEST_RESULTS:", "LOWEST RESULTS:", "Lowest Results"
            # - With or without colons
            # - With or without extra whitespace
            patterns = {
                'lowest_results_analysis': [
                    r'LOWEST[\s_-]*RESULTS?:?\s*(.*?)(?=\n\s*(?:HIGHEST|GAPS|RESULTS|IMPROVEMENT|$))',
                    r'(?i)най-ниски\s+резултати:?\s*(.*?)(?=\n\s*(?:най-високи|пропуски|общ|мерки|$))'
                ],
                'highest_results_analysis': [
                    r'HIGHEST[\s_-]*RESULTS?:?\s*(.*?)(?=\n\s*(?:GAPS|RESULTS[\s_-]*ANALYSIS|IMPROVEMENT|$))',
                    r'(?i)най-високи\s+резултати:?\s*(.*?)(?=\n\s*(?:пропуски|общ|мерки|$))'
                ],
                'gaps_analysis': [
                    r'GAPS[\s_-]*ANALYSIS:?\s*(.*?)(?=\n\s*(?:RESULTS[\s_-]*ANALYSIS|IMPROVEMENT|$))',
                    r'(?i)пропуски:?\s*(.*?)(?=\n\s*(?:общ|мерки|$))'
                ],
                'results_analysis': [
                    r'RESULTS[\s_-]*ANALYSIS:?\s*(.*?)(?=\n\s*(?:IMPROVEMENT|$))',
                    r'(?i)общ\s+анализ:?\s*(.*?)(?=\n\s*(?:мерки|$))'
                ],
                'improvement_measures': [
                    r'IMPROVEMENT[\s_-]*MEASURES?:?\s*(.*?)$',
                    r'(?i)мерки:?\s*(.*?)$'
                ]
            }
            
            for key, pattern_list in patterns.items():
                for pattern in pattern_list:
                    try:
                        match = re.search(pattern, ai_text, re.IGNORECASE | re.DOTALL)
                        if match:
                            # Safely get group 1 if it exists
                            try:
                                # Check if match has groups and group 1 exists
                                if match.lastindex and match.lastindex >= 1:
                                    group_content = match.group(1)
                                    if group_content is not None and group_content.strip():
                                        sections[key] = group_content.strip()
                                        if sections[key]:
                                            logger.debug(f"Matched section: {key} ({len(sections[key])} chars)")
                                            break
                                else:
                                    logger.debug(f"Pattern matched for {key} but no capture group found")
                            except (IndexError, AttributeError) as group_error:
                                logger.warning(f"Error accessing match group for {key}: {group_error}")
                                continue
                    except Exception as e:
                        logger.warning(f"Error matching pattern for {key}: {e}")
                        continue
            
        except Exception as e:
            logger.error(f"Error in regex parsing: {e}")
            sections = {}
        
        # Fallback if regex parsing didn't get all sections
        if len(sections) < 5:
            logger.warning(f"Regex parsing incomplete ({len(sections)}/5 sections). Trying fallback...")
            try:
                sections = self._fallback_parse(ai_text)
            except Exception as e:
                logger.error(f"Fallback parsing also failed: {e}")
                # Emergency fallback with default texts
                sections = {
                    'lowest_results_analysis': 'Анализ на най-ниските резултати.',
                    'highest_results_analysis': 'Анализ на най-високите резултати.',
                    'gaps_analysis': 'Анализ на пропуските.',
                    'results_analysis': 'Общ анализ на резултатите.',
                    'improvement_measures': 'Мерки за подобрение.'
                }
        
        return sections
    
    def _fallback_parse(self, ai_text: str) -> Dict[str, str]:
        """
        Fallback parsing method if regex fails
        
        Uses line-by-line parsing to extract sections from AI response.
        If that also fails, splits text into 5 equal chunks as emergency fallback.
        
        Args:
            ai_text: Raw AI response text
        
        Returns:
            Dictionary with 5 analysis sections (lowest_results_analysis, etc.)
        """
        
        logger.debug("Using fallback line-by-line parsing...")
        sections = {}
        current_section = None
        current_text = []
        
        # Ensure ai_text is a string
        if not isinstance(ai_text, str):
            logger.error(f"AI text is not a string in fallback: {type(ai_text)}")
            ai_text = str(ai_text) if ai_text else ""
        
        if not ai_text or not ai_text.strip():
            logger.warning("AI text is empty in fallback, using default sections")
            return {
                'lowest_results_analysis': 'Анализ на най-ниските резултати.',
                'highest_results_analysis': 'Анализ на най-високите резултати.',
                'gaps_analysis': 'Анализ на пропуските.',
                'results_analysis': 'Общ анализ на резултатите.',
                'improvement_measures': 'Мерки за подобрение.'
            }
        
        # Split by lines and process
        try:
            lines = ai_text.split('\n')
        except Exception as e:
            logger.error(f"Error splitting text into lines: {e}")
            lines = []
        
        for i, line in enumerate(lines):
            line_stripped = line.strip()
            
            # Check for section headers (case insensitive, flexible)
            if re.match(r'(?i)(LOWEST|най-ниски)[\s_-]*(RESULTS?|резултати):?', line_stripped):
                if current_section and current_text:
                    sections[current_section] = '\n'.join(current_text).strip()
                current_section = 'lowest_results_analysis'
                current_text = []
                logger.debug(f"Found section start: lowest_results_analysis (line {i})")
                
            elif re.match(r'(?i)(HIGHEST|най-високи)[\s_-]*(RESULTS?|резултати):?', line_stripped):
                if current_section and current_text:
                    sections[current_section] = '\n'.join(current_text).strip()
                current_section = 'highest_results_analysis'
                current_text = []
                logger.debug(f"Found section start: highest_results_analysis (line {i})")
                
            elif re.match(r'(?i)(GAPS?|пропуски)[\s_-]*(ANALYSIS|анализ)?:?', line_stripped):
                if current_section and current_text:
                    sections[current_section] = '\n'.join(current_text).strip()
                current_section = 'gaps_analysis'
                current_text = []
                logger.debug(f"Found section start: gaps_analysis (line {i})")
                
            elif re.match(r'(?i)(RESULTS?[\s_-]*ANALYSIS|общ\s+анализ):?', line_stripped):
                if current_section and current_text:
                    sections[current_section] = '\n'.join(current_text).strip()
                current_section = 'results_analysis'
                current_text = []
                logger.debug(f"Found section start: results_analysis (line {i})")
                
            elif re.match(r'(?i)(IMPROVEMENT[\s_-]*MEASURES?|мерки):?', line_stripped):
                if current_section and current_text:
                    sections[current_section] = '\n'.join(current_text).strip()
                current_section = 'improvement_measures'
                current_text = []
                logger.debug(f"Found section start: improvement_measures (line {i})")
                
            elif line_stripped and current_section:
                # Add content line to current section
                current_text.append(line_stripped)
        
        # Add last section
        if current_section and current_text:
            sections[current_section] = '\n'.join(current_text).strip()
        
        logger.info(f"Fallback parsing completed: {len(sections)}/5 sections found")
        
        # Final fallback - use entire text split into chunks
        if len(sections) < 5:
            logger.warning("Fallback parsing also incomplete. Using emergency fallback...")
            
            # Split text into 5 equal parts
            total_chars = len(ai_text)
            chunk_size = max(total_chars // 5, 100)  # At least 100 chars per section
            
            # Create sections with safe indexing
            sections = {
                'lowest_results_analysis': ai_text[0:chunk_size].strip() or "Анализ на най-ниските резултати.",
                'highest_results_analysis': ai_text[chunk_size:chunk_size*2].strip() or "Анализ на най-високите резултати.",
                'gaps_analysis': ai_text[chunk_size*2:chunk_size*3].strip() or "Анализ на пропуските.",
                'results_analysis': ai_text[chunk_size*3:chunk_size*4].strip() or "Общ анализ на резултатите.",
                'improvement_measures': ai_text[chunk_size*4:].strip() or "Мерки за подобрение."
            }
        
        return sections
    
    def _validate_sections(self, sections: Dict[str, str]) -> bool:
        """
        Validate that all required sections are present and non-empty
        
        Args:
            sections: Parsed sections dict
        
        Returns:
            True if valid, False otherwise
        """
        
        required_keys = [
            'lowest_results_analysis',
            'highest_results_analysis',
            'gaps_analysis',
            'results_analysis',
            'improvement_measures'
        ]
        
        for key in required_keys:
            if key not in sections:
                logger.error(f"Missing section: {key}")
                return False
            if not sections[key] or len(sections[key]) < 10:
                logger.error(f"Section too short or empty: {key} ({len(sections.get(key, ''))} chars)")
                return False
        
        logger.info("All sections validated successfully")
        return True
    
    def _is_answer_correct(self, answer: Any) -> bool:
        """
        Check if an answer is correct (handles various data types)
        
        Args:
            answer: Answer value (bool, int, str, etc.)
        
        Returns:
            True if answer is correct, False otherwise
        """
        if answer is None:
            return False
        
        # Handle boolean
        if isinstance(answer, bool):
            return answer
        
        # Handle string
        if isinstance(answer, str):
            answer_lower = answer.lower().strip()
            return answer_lower in ['true', '1', 'yes', 'да', 'правилно', 'correct']
        
        # Handle number (1 = correct, 0 = incorrect)
        if isinstance(answer, (int, float)):
            return bool(answer)
        
        # Default to False for unknown types
        return False


# Create singleton instance
_gemini_service: Optional[GeminiService] = None
_gemini_service_key: Optional[str] = None

def get_gemini_service(api_key: Optional[str] = None) -> GeminiService:
    """
    Get or create Gemini service instance (singleton pattern)
    
    Returns:
        GeminiService instance
    """
    global _gemini_service, _gemini_service_key
    if api_key is None:
        api_key = get_effective_gemini_api_key(get_settings())
    if _gemini_service is None or _gemini_service_key != api_key:
        logger.info(
            "Creating Gemini service (key hint: %s)",
            api_key[-4:] if api_key and len(api_key) >= 4 else "????",
        )
        _gemini_service = GeminiService(api_key=api_key)
        _gemini_service_key = api_key
    return _gemini_service


def reset_gemini_service() -> None:
    """Drop cached Gemini client so the next call uses the latest API key."""
    global _gemini_service, _gemini_service_key
    _gemini_service = None
    _gemini_service_key = None


def build_analysis_prompt(test_data: Dict[str, Any]) -> str:
    """Full Bulgarian analysis prompt (shared by Groq stage 1 and Gemini-only fallback)."""
    helper = GeminiService.__new__(GeminiService)
    return helper._build_prompt_from_test_data(test_data)


def parse_and_validate_analysis(ai_text: str) -> Dict[str, str]:
    """Parse raw LLM text into five required sections."""
    helper = GeminiService.__new__(GeminiService)
    try:
        sections = helper._parse_ai_response(ai_text)
    except (IndexError, KeyError, AttributeError) as e:
        logger.error("%s parsing AI response: %s", type(e).__name__, e)
        sections = _default_analysis_sections()
    except Exception as e:
        logger.error("Error parsing AI response: %s", e)
        sections = _default_analysis_sections()

    if not helper._validate_sections(sections):
        for section_key in ANALYSIS_SECTION_KEYS:
            if (
                section_key not in sections
                or not sections[section_key]
                or len(sections[section_key]) < 10
            ):
                sections[section_key] = _default_analysis_sections()[section_key]
    return sections


def _default_analysis_sections() -> Dict[str, str]:
    return {
        "lowest_results_analysis": "Анализ на най-ниските резултати.",
        "highest_results_analysis": "Анализ на най-високите резултати.",
        "gaps_analysis": "Анализ на пропуските.",
        "results_analysis": "Общ анализ на резултатите.",
        "improvement_measures": "Мерки за подобрение.",
    }