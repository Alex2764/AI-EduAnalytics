"""
Groq AI Service for generating test analysis
Groq offers free tier with very high rate limits (30 requests/second)
"""

import re
import logging
from typing import Dict, Any, Optional, List
import time

try:
    from groq import Groq
except ImportError:
    raise ImportError("groq not installed. Run: pip install groq")

# Import settings
from config import get_settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GroqAPIError(Exception):
    """Custom exception for Groq API errors"""
    def __init__(self, message: str, is_rate_limit: bool = False, retry_after: Optional[int] = None):
        super().__init__(message)
        self.is_rate_limit = is_rate_limit
        self.retry_after = retry_after  # seconds


class ParsingError(Exception):
    """Custom exception for AI response parsing errors"""
    pass


class GroqService:
    """Service for interacting with Groq AI"""
    
    def __init__(self):
        settings = get_settings()
        api_key = settings.groq_api_key
        model_name = settings.groq_model
        
        if not api_key:
            logger.error("GROQ_API_KEY not found in environment variables")
            raise ValueError("GROQ_API_KEY not found in environment variables")
        
        try:
            self.client = Groq(api_key=api_key)
            self.model_name = model_name
            logger.info(f"Initialized Groq service with model: {model_name}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Groq: {e}")
            raise GroqAPIError(f"Failed to initialize Groq: {e}")
        
        # Configuration
        self.max_retries = 3
        self.retry_delay = 2  # seconds
    
    def generate_analysis(
        self, 
        test_data: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Generate AI analysis for test results
        
        Args:
            test_data: Dictionary containing test data (students, results, etc.)
        
        Returns:
            Dictionary with analysis sections
        
        Raises:
            GroqAPIError: If API call fails
            ParsingError: If response parsing fails
        """
        
        logger.info("Generating AI analysis with Groq...")
        
        # Extract data
        class_name = test_data.get('class_name', 'Неизвестен клас')
        subject = test_data.get('subject', 'Неизвестен предмет')
        total_students = test_data.get('total_students', 0)
        avg_points = test_data.get('avg_points', 0)
        avg_grade = test_data.get('avg_grade', 0)
        min_points = test_data.get('min_points', 0)
        max_points = test_data.get('max_points', 0)
        students = test_data.get('students', [])
        results = test_data.get('results', [])
        
        # Build prompt
        prompt = self._build_prompt(
            class_name=class_name,
            subject=subject,
            total_students=total_students,
            avg_points=avg_points,
            avg_grade=avg_grade,
            min_points=min_points,
            max_points=max_points,
            students=students,
            results=results,
            test_data=test_data
        )
        
        # Call Groq API
        try:
            ai_text = self._call_groq_with_retry(prompt)
            
            # Parse response
            sections = self._parse_ai_response(ai_text)
            
            logger.info(f"Successfully generated analysis with {len(sections)} sections")
            return sections
            
        except GroqAPIError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in generate_analysis: {e}")
            raise GroqAPIError(f"Failed to generate analysis: {str(e)}")
    
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
        """Build prompt for AI analysis"""
        
        prompt = f"""Ти си опитен преподавател и образователен анализатор. Анализирай резултатите от тест по {subject} за клас {class_name}.

ОСНОВНА СТАТИСТИКА:
- Общо ученици: {total_students}
- Среден резултат: {avg_points:.1f} точки
- Средна оценка: {avg_grade:.2f}
- Най-нисък резултат: {min_points:.1f} точки
- Най-висок резултат: {max_points:.1f} точки
"""
        
        # Add student results if available
        if results and len(results) > 0:
            prompt += "\nДЕТАЙЛНИ РЕЗУЛТАТИ:\n"
            for i, result in enumerate(results[:20], 1):  # Limit to first 20
                student_name = result.get('student_name', 'Неизвестен')
                points = result.get('points', 0)
                grade = result.get('grade', 0)
                prompt += f"{i}. {student_name}: {points:.1f} точки (оценка {grade:.1f})\n"
        
        prompt += """
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
        return prompt
    
    def _call_groq_with_retry(self, prompt: str) -> str:
        """
        Call Groq API with retry logic
        
        Args:
            prompt: The prompt to send
        
        Returns:
            AI generated text
        
        Raises:
            GroqAPIError: If all retries fail
        """
        
        last_error = None
        
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(f"Calling Groq API (attempt {attempt}/{self.max_retries})...")
                
                # Call Groq API
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {
                            "role": "system",
                            "content": "Ти си опитен преподавател и образователен анализатор. Отговаряш на български език."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.7,
                    max_tokens=2000
                )
                
                # Extract text
                if not response or not response.choices:
                    raise GroqAPIError("Empty response from Groq API")
                
                ai_text = response.choices[0].message.content.strip()
                if not ai_text:
                    raise GroqAPIError("Empty text in Groq response")
                
                logger.info(f"Successfully received response: {len(ai_text)} characters")
                return ai_text
                
            except Exception as e:
                last_error = e
                error_type = type(e).__name__
                error_details = str(e)
                logger.warning(f"Attempt {attempt} failed: {error_type}: {error_details}")
                
                # Check for rate limit errors
                if "rate_limit" in error_details.lower() or "429" in error_details or "quota" in error_details.lower():
                    retry_delay = self.retry_delay
                    if "retry" in error_details.lower():
                        import re
                        delay_match = re.search(r'retry.*?(\d+(?:\.\d+)?)\s*s', error_details, re.IGNORECASE)
                        if delay_match:
                            retry_delay = max(int(float(delay_match.group(1))), 5)
                    
                    user_msg = "Квотата за Groq API е изчерпана. "
                    user_msg += "Моля, проверете вашия план. "
                    if retry_delay > self.retry_delay:
                        user_msg += f"Опитайте отново след {retry_delay} секунди."
                    
                    if attempt < self.max_retries:
                        logger.info(f"Rate limit detected. Waiting {retry_delay} seconds before retry...")
                        time.sleep(retry_delay)
                        continue
                    else:
                        logger.error(f"Rate limit/quota exceeded after {self.max_retries} attempts")
                        raise GroqAPIError(user_msg, is_rate_limit=True, retry_after=retry_delay)
                
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
        
        error_msg = f"Неуспешно генериране на AI анализ след {self.max_retries} опита: {error_type}"
        if len(error_details) < 200:
            error_msg += f": {error_details}"
        
        logger.error(error_msg)
        raise GroqAPIError(error_msg)
    
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
                "lowest_results_analysis": "Не е налична информация за най-ниските резултати.",
                "highest_results_analysis": "Не е налична информация за най-високите резултати.",
                "gaps_analysis": "Не е налична информация за пропуските.",
                "results_analysis": "Не е налична информация за общия анализ.",
                "improvement_measures": "Не са налични препоръки за подобрение."
            }
        
        # Define section patterns (flexible matching)
        section_patterns = {
            "LOWEST_RESULTS": [
                r"LOWEST_RESULTS[:\s]*\n(.*?)(?=\n(?:HIGHEST_RESULTS|GAPS_ANALYSIS|RESULTS_ANALYSIS|IMPROVEMENT_MEASURES|$))",
                r"най-ниски.*?резултат[^\n]*\n(.*?)(?=\n(?:най-висок|пропуск|общ|подобр|$))",
            ],
            "HIGHEST_RESULTS": [
                r"HIGHEST_RESULTS[:\s]*\n(.*?)(?=\n(?:GAPS_ANALYSIS|RESULTS_ANALYSIS|IMPROVEMENT_MEASURES|LOWEST_RESULTS|$))",
                r"най-висок.*?резултат[^\n]*\n(.*?)(?=\n(?:пропуск|общ|подобр|най-нисък|$))",
            ],
            "GAPS_ANALYSIS": [
                r"GAPS_ANALYSIS[:\s]*\n(.*?)(?=\n(?:RESULTS_ANALYSIS|IMPROVEMENT_MEASURES|LOWEST_RESULTS|HIGHEST_RESULTS|$))",
                r"пропуск[^\n]*\n(.*?)(?=\n(?:общ|подобр|най-нисък|най-висок|$))",
            ],
            "RESULTS_ANALYSIS": [
                r"RESULTS_ANALYSIS[:\s]*\n(.*?)(?=\n(?:IMPROVEMENT_MEASURES|LOWEST_RESULTS|HIGHEST_RESULTS|GAPS_ANALYSIS|$))",
                r"общ.*?анализ[^\n]*\n(.*?)(?=\n(?:подобр|най-нисък|най-висок|пропуск|$))",
            ],
            "IMPROVEMENT_MEASURES": [
                r"IMPROVEMENT_MEASURES[:\s]*\n(.*?)(?=\n(?:LOWEST_RESULTS|HIGHEST_RESULTS|GAPS_ANALYSIS|RESULTS_ANALYSIS|$)|$)",
                r"подобр[^\n]*\n(.*?)(?=\n(?:най-нисък|най-висок|пропуск|общ|$)|$)",
            ],
        }
        
        # Try to extract each section
        for section_name, patterns in section_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, ai_text, re.IGNORECASE | re.DOTALL | re.MULTILINE)
                if match:
                    text = match.group(1).strip()
                    if text and len(text) > 10:  # Minimum length check
                        sections[section_name] = text
                        logger.debug(f"Extracted {section_name}: {len(text)} chars")
                        break
        
        # Validate that we got at least some sections
        if len(sections) < 2:
            logger.warning(f"Only extracted {len(sections)} sections, using fallback")
            # Fallback: try to split by common delimiters
            parts = re.split(r'\n\s*(?:LOWEST_RESULTS|HIGHEST_RESULTS|GAPS_ANALYSIS|RESULTS_ANALYSIS|IMPROVEMENT_MEASURES)[:\s]*\n', ai_text, flags=re.IGNORECASE)
            if len(parts) >= 2:
                # Try to map parts to sections
                section_names = ["LOWEST_RESULTS", "HIGHEST_RESULTS", "GAPS_ANALYSIS", "RESULTS_ANALYSIS", "IMPROVEMENT_MEASURES"]
                for i, part in enumerate(parts[1:6]):  # Skip first part, take up to 5
                    if part.strip():
                        sections[section_names[i]] = part.strip()
        
        # Ensure all required sections exist
        required_sections = ["LOWEST_RESULTS", "HIGHEST_RESULTS", "GAPS_ANALYSIS", "RESULTS_ANALYSIS", "IMPROVEMENT_MEASURES"]
        for section in required_sections:
            if section not in sections:
                sections[section] = f"Не е налична информация за {section}."
                logger.warning(f"Missing section {section}, using default")
        
        # Convert section names to match Gemini service format (for compatibility with document service)
        # Map: UPPERCASE_WITH_UNDERSCORE -> lowercase_with_underscore_analysis
        section_name_mapping = {
            "LOWEST_RESULTS": "lowest_results_analysis",
            "HIGHEST_RESULTS": "highest_results_analysis",
            "GAPS_ANALYSIS": "gaps_analysis",
            "RESULTS_ANALYSIS": "results_analysis",
            "IMPROVEMENT_MEASURES": "improvement_measures"
        }
        
        # Create new dictionary with mapped names
        mapped_sections = {}
        for old_name, new_name in section_name_mapping.items():
            if old_name in sections:
                mapped_sections[new_name] = sections[old_name]
            else:
                # Use default text if section is missing
                default_texts = {
                    "lowest_results_analysis": "Не е налична информация за най-ниските резултати.",
                    "highest_results_analysis": "Не е налична информация за най-високите резултати.",
                    "gaps_analysis": "Не е налична информация за пропуските.",
                    "results_analysis": "Не е налична информация за общия анализ.",
                    "improvement_measures": "Не са налични препоръки за подобрение."
                }
                mapped_sections[new_name] = default_texts.get(new_name, "Не е налична информация.")
        
        logger.info(f"Parsed {len(mapped_sections)} sections from AI response")
        return mapped_sections


# Create singleton instance
_groq_service: Optional[GroqService] = None

def get_groq_service() -> GroqService:
    """
    Get or create Groq service instance (singleton pattern)
    
    Returns:
        GroqService instance
    """
    global _groq_service
    if _groq_service is None:
        logger.info("Creating new Groq service instance")
        _groq_service = GroqService()
    return _groq_service

