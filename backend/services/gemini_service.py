"""
Gemini AI Service for generating test analysis
"""

import os
import re
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import time

try:
    import google.generativeai as genai
except ImportError:
    raise ImportError("google-generativeai not installed. Run: pip install google-generativeai")

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GeminiAPIError(Exception):
    """Custom exception for Gemini API errors"""
    pass


class ParsingError(Exception):
    """Custom exception for AI response parsing errors"""
    pass


class GeminiService:
    """Service for interacting with Google Gemini AI"""
    
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY not found in environment variables")
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        try:
            genai.configure(api_key=api_key)
            
            # First, check which models are available via API
            logger.info("Checking available Gemini models...")
            working_model = None
            try:
                available_models = genai.list_models()
                model_names_list = [model.name for model in available_models 
                                  if 'generateContent' in model.supported_generation_methods]
                logger.debug(f"Found {len(model_names_list)} available models")
                
                # Prefer models with "flash" or "1.5" in the name for speed
                # Try to find a preferred model that's available and test it
                preferred_models = [
                    'gemini-1.5-flash',
                    'gemini-1.5-flash-latest', 
                    'gemini-1.5-pro',
                    'gemini-pro',
                    'gemini-flash-001',
                    'gemini-flash'
                ]
                
                # Try each preferred model by testing if we can create it
                for preferred in preferred_models:
                    # Check if model exists in the list (case insensitive, partial match)
                    matching_models = [name for name in model_names_list if preferred.lower() in name.lower()]
                    if matching_models:
                        # Try the first matching model
                        test_model_name = matching_models[0]
                        # Extract short name for GenerativeModel (it should work with or without models/ prefix)
                        short_test_name = test_model_name.replace('models/', '') if 'models/' in test_model_name else test_model_name
                        try:
                            logger.debug(f"Testing model: {short_test_name}...")
                            test_model = genai.GenerativeModel(short_test_name)
                            working_model = short_test_name
                            logger.info(f"Initialized model: {short_test_name}")
                            break
                        except Exception as test_error:
                            logger.debug(f"Model {short_test_name} failed: {test_error}")
                            continue
                
                # If no preferred found, try first available
                if not working_model and model_names_list:
                    first_model = model_names_list[0]
                    short_first_name = first_model.replace('models/', '') if 'models/' in first_model else first_model
                    try:
                        logger.debug(f"Trying first available model: {short_first_name}...")
                        test_model = genai.GenerativeModel(short_first_name)
                        working_model = short_first_name
                        logger.info(f"Using first available model: {short_first_name}")
                    except Exception as test_error:
                        logger.warning(f"First model {short_first_name} failed: {test_error}")
                
            except Exception as e:
                logger.warning(f"Could not list models via API: {e}")
                logger.info("Falling back to manual model list...")
                working_model = None
            
            # If API listing failed, try manual list
            if not working_model:
                model_names = [
                    'gemini-1.5-flash',
                    'gemini-1.5-flash-latest',
                    'gemini-flash',
                    'gemini-1.5-pro',
                    'gemini-pro',
                    'gemini-flash-001'
                ]
                
                self.model = None
                last_error = None
                
                for model_name in model_names:
                    try:
                        logger.debug(f"Trying to initialize model: {model_name}")
                        self.model = genai.GenerativeModel(model_name)
                        logger.info(f"Initialized model: {model_name}")
                        working_model = model_name
                        break
                    except Exception as e:
                        last_error = e
                        logger.debug(f"Failed to initialize {model_name}: {e}")
                        continue
                
                if self.model is None:
                    error_msg = f"Failed to initialize any Gemini model. Last error: {last_error}"
                    logger.error(error_msg)
                    raise GeminiAPIError(error_msg)
            else:
                logger.info(f"Using model from API list: {working_model}")
                self.model = genai.GenerativeModel(working_model)
                
        except GeminiAPIError:
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
            raise GeminiAPIError(f"Failed to initialize Gemini: {e}")
        
        # Configuration
        self.max_retries = 3
        self.retry_delay = 2  # seconds
    
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
        
        # Build prompt with detailed data
        prompt = self._build_prompt(
            class_name, subject, total_students, 
            avg_points, avg_grade, min_points, max_points,
            students, results, test_data
        )
        
        # Call API with retry logic
        ai_text = self._call_gemini_with_retry(prompt)
        
        logger.info(f"Received AI response: {len(ai_text)} characters")
        
        # Parse response with comprehensive error handling
        try:
            sections = self._parse_ai_response(ai_text)
        except (IndexError, KeyError, AttributeError) as e:
            logger.error(f"{type(e).__name__} parsing AI response: {e}")
            import traceback
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            # Use emergency fallback
            logger.warning(f"Using emergency fallback due to {type(e).__name__}")
            sections = {
                'lowest_results_analysis': 'Анализ на най-ниските резултати.',
                'highest_results_analysis': 'Анализ на най-високите резултати.',
                'gaps_analysis': 'Анализ на пропуските.',
                'results_analysis': 'Общ анализ на резултатите.',
                'improvement_measures': 'Мерки за подобрение.'
            }
        except Exception as e:
            logger.error(f"Error parsing AI response: {type(e).__name__}: {e}")
            import traceback
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            # Use emergency fallback
            logger.warning("Using emergency fallback due to parsing error")
            sections = {
                'lowest_results_analysis': 'Анализ на най-ниските резултати.',
                'highest_results_analysis': 'Анализ на най-високите резултати.',
                'gaps_analysis': 'Анализ на пропуските.',
                'results_analysis': 'Общ анализ на резултатите.',
                'improvement_measures': 'Мерки за подобрение.'
            }
        
        # Validate sections (but don't fail if validation fails, just use defaults)
        if not self._validate_sections(sections):
            logger.warning("Some sections are missing or empty, but proceeding with available content")
            logger.debug(f"Parsed sections: {list(sections.keys())}")
            logger.debug(f"Section lengths: {[(k, len(v)) for k, v in sections.items()]}")
            
            # Ensure all sections exist with at least default text
            required_sections = [
                'lowest_results_analysis',
                'highest_results_analysis',
                'gaps_analysis',
                'results_analysis',
                'improvement_measures'
            ]
            for section_key in required_sections:
                if section_key not in sections or not sections[section_key] or len(sections[section_key]) < 10:
                    default_text = {
                        'lowest_results_analysis': 'Анализ на най-ниските резултати.',
                        'highest_results_analysis': 'Анализ на най-високите резултати.',
                        'gaps_analysis': 'Анализ на пропуските.',
                        'results_analysis': 'Общ анализ на резултатите.',
                        'improvement_measures': 'Мерки за подобрение.'
                    }.get(section_key, 'Анализ.')
                    sections[section_key] = default_text
                    logger.warning(f"Using default text for missing section: {section_key}")
        
        logger.info("Successfully generated and parsed AI analysis")
        return sections
    
    def _build_prompt(
        self,
        class_name: str,
        subject: str,
        total_students: int,
        avg_points: float,
        avg_grade: float,
        min_points: float,
        max_points: float,
        students: list = None,
        results: list = None,
        test_data: Dict[str, Any] = None
    ) -> str:
        """Build comprehensive prompt for test analysis"""
        
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
        
        # Build student details section if data available
        student_details = ""
        # Safety check: ensure students and results are lists
        try:
            if students and isinstance(students, list) and results and isinstance(results, list):
                student_details = "\n\nДЕТАЙЛИ ЗА УЧЕНИЦИТЕ:\n"
                
                # Sort students by points (descending) to show best and worst first
                students_with_results = []
                # Limit to first 15 for prompt size - safely handle if students list is shorter
                max_students = min(len(students), 15) if students else 0
                for student in students[:max_students]:
                    student_id = student.get("id") or student.get("student_id")
                    student_name = student.get("name", "Unknown")
                    student_gender = student.get("gender", "")
                    
                    # Normalize gender for display
                    if student_gender in ["male", "М"]:
                        gender_display = "М"
                    elif student_gender in ["female", "Ж"]:
                        gender_display = "Ж"
                    else:
                        gender_display = student_gender
                    
                    # Find matching result
                    student_result = None
                    for result in results:
                        result_student_id = result.get("student_id") or result.get("student")
                        if result_student_id == student_id or result.get("student") == student_id:
                            student_result = result
                            break
                    
                    if student_result and student_result.get("participated", True):
                        points = student_result.get("points") or student_result.get("total_points", 0)
                        grade = student_result.get("grade", 0)
                        percentage = student_result.get("percentage")
                        
                        # Calculate percentage if not available
                        if percentage is None and test_max_points > 0:
                            percentage = round((points / test_max_points) * 100, 1)
                        
                        # Get question answers if available (q1, q2, etc.)
                        correct_questions = []
                        wrong_questions = []
                        
                        if total_questions > 0:
                            for i in range(1, min(total_questions + 1, 20)):  # Limit to 20 questions
                                q_key = f"q{i}"
                                if q_key in student_result:
                                    if self._is_answer_correct(student_result[q_key]):
                                        correct_questions.append(i)
                                    else:
                                        wrong_questions.append(i)
                        
                        students_with_results.append({
                            "name": student_name,
                            "gender": gender_display,
                            "points": points,
                            "grade": grade,
                            "percentage": percentage,
                            "correct": correct_questions,
                            "wrong": wrong_questions
                        })
                
                # Sort by points (descending)
                students_with_results.sort(key=lambda x: x["points"], reverse=True)
                
                # Show all students (up to 15)
                for s in students_with_results[:15]:
                    try:
                        student_details += f"- {s.get('name', 'Unknown')} ({s.get('gender', '')}): {s.get('points', 0)}т."
                        if s.get('percentage'):
                            student_details += f" ({s['percentage']}%)"
                        student_details += f", Оценка: {s.get('grade', 0)}/6.00"
                        if s.get('correct'):
                            correct_list = s['correct'][:8] if isinstance(s['correct'], list) else []
                            if correct_list:
                                student_details += f", Правилни въпроси: {', '.join(map(str, correct_list))}"
                        if s.get('wrong'):
                            wrong_list = s['wrong'][:8] if isinstance(s['wrong'], list) else []
                            if wrong_list:
                                student_details += f", Грешни въпроси: {', '.join(map(str, wrong_list))}"
                        student_details += "\n"
                    except (KeyError, TypeError, IndexError) as e:
                        logger.warning(f"Error formatting student details: {e}")
                        continue
        except Exception as e:
            logger.warning(f"Error building student details: {e}")
            # Continue without student details if there's an error
        
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

Генерирай 5 ОТДЕЛНИ анализа (всеки до 150 думи):

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
        error_msg = f"Failed to generate AI analysis after {self.max_retries} attempts: {error_type}: {error_details}"
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
        """Fallback parsing method if regex fails"""
        
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

def get_gemini_service() -> GeminiService:
    """Get or create Gemini service instance"""
    global _gemini_service
    if _gemini_service is None:
        logger.info("Creating new Gemini service instance")
        _gemini_service = GeminiService()
    return _gemini_service