# GEMINI AI INTEGRATION RULES

================================================================================
SECTION 1: GEMINI API SETUP
================================================================================

## GOOGLE GENERATIVE AI SDK

```python
# Installation
# pip install google-generativeai==0.3.1

# Basic imports
import google.generativeai as genai
import os
from typing import Optional, List, Dict, Any
import logging
import time
import re

logger = logging.getLogger(__name__)
```

## API CONFIGURATION

```python
# app/services/gemini_service.py
"""
Gemini AI Service for test analysis
"""
import google.generativeai as genai
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# ✅ Configure API key
genai.configure(api_key=settings.GEMINI_API_KEY)

# ✅ Validate API key on initialization
def validate_api_key():
    """Validate that Gemini API key is set"""
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in environment variables")
    
    if len(settings.GEMINI_API_KEY) < 20:
        raise ValueError("GEMINI_API_KEY appears to be invalid (too short)")
    
    logger.info("Gemini API key validated successfully")

# Run validation
validate_api_key()
```

## AVAILABLE MODELS LIST

```python
# ✅ Supported Gemini models (priority order)
GEMINI_MODELS = [
    "gemini-1.5-flash",          # Fastest, recommended for most tasks
    "gemini-1.5-flash-latest",   # Latest flash version
    "gemini-1.5-pro",            # Most capable, slower
    "gemini-pro",                # Legacy model
    "gemini-flash-001",          # Specific version
    "gemini-flash",              # Generic flash
]

def get_available_model() -> str:
    """
    Get first available Gemini model from list
    
    Returns:
        Model name
    
    Raises:
        RuntimeError: If no models are available
    """
    for model_name in GEMINI_MODELS:
        try:
            model = genai.GenerativeModel(model_name)
            logger.info(f"Using Gemini model: {model_name}")
            return model_name
        except Exception as e:
            logger.warning(f"Model {model_name} not available: {str(e)}")
            continue
    
    raise RuntimeError("No Gemini models available")
```

================================================================================
SECTION 2: MODEL SELECTION & CONFIGURATION
================================================================================

## MODEL INITIALIZATION

```python
class GeminiService:
    """Service for Gemini AI operations"""
    
    def __init__(self):
        """Initialize Gemini service with best available model"""
        self.model_name = get_available_model()
        
        # ✅ Generation config
        self.generation_config = {
            "temperature": 0.7,           # Creativity (0.0-1.0)
            "top_p": 0.95,               # Nucleus sampling
            "top_k": 40,                 # Top-k sampling
            "max_output_tokens": 2048,   # Max response length
        }
        
        # ✅ Safety settings (optional)
        self.safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
        ]
        
        # ✅ Initialize model
        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config=self.generation_config,
            safety_settings=self.safety_settings,
        )
        
        logger.info(f"GeminiService initialized with model: {self.model_name}")
```

## GENERATION CONFIG OPTIONS

```python
# ✅ Conservative config (more focused, deterministic)
conservative_config = {
    "temperature": 0.3,
    "top_p": 0.8,
    "top_k": 20,
    "max_output_tokens": 1024,
}

# ✅ Balanced config (recommended)
balanced_config = {
    "temperature": 0.7,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 2048,
}

# ✅ Creative config (more diverse outputs)
creative_config = {
    "temperature": 0.9,
    "top_p": 0.98,
    "top_k": 60,
    "max_output_tokens": 2048,
}
```

================================================================================
SECTION 3: PROMPT ENGINEERING (BULGARIAN)
================================================================================

## 5 СЕКЦИИ АНАЛИЗ СТРУКТУРА

```python
def build_analysis_prompt(
    test_name: str,
    score: int,
    answers: Dict[str, Any],
    total_students: int = 25
) -> str:
    """
    Build Bulgarian prompt for 5-section test analysis
    
    Args:
        test_name: Name of the test
        score: Average score (0-100)
        answers: Dictionary with test answers
        total_students: Number of students
    
    Returns:
        Formatted prompt in Bulgarian
    """
    
    prompt = f"""
Ти си опитен учител и анализатор на образователни резултати. 
Анализирай следните тестови резултати и предоставя подробен анализ на български език.

ТЕСТОВИ ДАННИ:
- Име на теста: {test_name}
- Среден резултат: {score}%
- Брой ученици: {total_students}
- Детайли за отговорите: {answers}

ИНСТРУКЦИИ ЗА АНАЛИЗ:
Моля, анализирай резултатите и предостави отговор в ТОЧНО СЛЕДНИЯ ФОРМАТ с 5 секции:

LOWEST_RESULTS:
[Анализ на областите с най-ниски резултати. Посочи конкретни теми/въпроси, където учениците са се справили най-слабо. Предложи възможни причини.]

HIGHEST_RESULTS:
[Анализ на областите с най-високи резултати. Посочи теми/въпроси, където учениците са се представили отлично. Обясни какво е било успешно.]

RECOMMENDATIONS:
[Конкретни препоръки за учителя. Предложи методи за подобрение на слабите области. Посочи стратегии за преподаване.]

FOCUS_AREAS:
[Приоритетни области за внимание. Посочи 3-5 конкретни теми, на които трябва да се фокусира учителя в следващите уроци.]

GENERAL_INSIGHTS:
[Обща оценка на класа. Анализ на тенденциите. Прогноза за развитието на учениците.]

ВАЖНО: 
- Отговорът трябва да бъде на български език
- Всяка секция трябва да започва ТОЧНО с посоченото заглавие (LOWERCASE_RESULTS:, и т.н.)
- След заглавието трябва да има празен ред
- Всяка секция трябва да съдържа поне 2-3 изречения
- Бъди конкретен и практичен в препоръките
"""
    
    return prompt.strip()
```

## PROMPT TEMPLATES

```python
# ✅ Template 1: Detailed Analysis (за подробен анализ)
DETAILED_ANALYSIS_TEMPLATE = """
Анализирай тестовите резултати детайлно:

Тест: {test_name}
Среден резултат: {score}%
Ученици: {student_count}

Предостави:
1. LOWEST_RESULTS: Най-слаби области (мин. 3 изречения)
2. HIGHEST_RESULTS: Най-силни области (мин. 3 изречения)  
3. RECOMMENDATIONS: Препоръки за учителя (мин. 5 точки)
4. FOCUS_AREAS: Фокусни области (3-5 теми)
5. GENERAL_INSIGHTS: Обща оценка (мин. 4 изречения)

Детайли: {details}
"""

# ✅ Template 2: Quick Summary (за бърз преглед)
QUICK_SUMMARY_TEMPLATE = """
Кратък анализ на тест "{test_name}":
Резултат: {score}%

Дай кратък анализ в 5 секции:
- LOWEST_RESULTS
- HIGHEST_RESULTS
- RECOMMENDATIONS
- FOCUS_AREAS
- GENERAL_INSIGHTS

Всяка секция 1-2 изречения.
"""

# ✅ Template 3: Comparative Analysis (за сравнение)
COMPARATIVE_TEMPLATE = """
Сравнителен анализ:

Текущ тест: {test_name} - {score}%
Предишен тест: {prev_test_name} - {prev_score}%

Анализирай промяната и дай 5-секционен анализ:
LOWEST_RESULTS, HIGHEST_RESULTS, RECOMMENDATIONS, FOCUS_AREAS, GENERAL_INSIGHTS

Фокусирай се на подобрения и влошения.
"""
```

## PROMPT BEST PRACTICES

```python
def create_effective_prompt(
    task: str,
    context: str,
    format_instructions: str,
    examples: Optional[str] = None
) -> str:
    """
    Create effective prompt following best practices
    
    Components:
    1. Clear role/persona
    2. Specific task
    3. Context/data
    4. Format instructions
    5. Examples (optional)
    6. Constraints
    """
    
    prompt_parts = [
        # 1. Role
        "Ти си опитен учител и анализатор.",
        "",
        # 2. Task
        f"ЗАДАЧА: {task}",
        "",
        # 3. Context
        f"КОНТЕКСТ:\n{context}",
        "",
        # 4. Format
        f"ФОРМАТ НА ОТГОВОРА:\n{format_instructions}",
    ]
    
    # 5. Examples (if provided)
    if examples:
        prompt_parts.extend([
            "",
            f"ПРИМЕРИ:\n{examples}",
        ])
    
    # 6. Constraints
    prompt_parts.extend([
        "",
        "ОГРАНИЧЕНИЯ:",
        "- Отговаряй на български език",
        "- Бъди конкретен и практичен",
        "- Използвай професионален тон",
        "- Избягвай общи фрази",
    ])
    
    return "\n".join(prompt_parts)
```

================================================================================
SECTION 4: RETRY LOGIC & ERROR HANDLING
================================================================================

## RETRY DECORATOR

```python
import time
import logging
from functools import wraps
from typing import Callable, TypeVar, Any

T = TypeVar('T')
logger = logging.getLogger(__name__)

def retry_with_exponential_backoff(
    max_retries: int = 3,
    initial_delay: float = 2.0,
    exponential_base: float = 2.0,
    exceptions: tuple = (Exception,)
) -> Callable:
    """
    Retry decorator with exponential backoff
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        exponential_base: Base for exponential backoff
        exceptions: Tuple of exceptions to catch
    
    Example:
        @retry_with_exponential_backoff(max_retries=3, initial_delay=2.0)
        def call_api():
            return api.generate_content(prompt)
    """
    
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                    
                except exceptions as e:
                    last_exception = e
                    
                    if attempt < max_retries - 1:
                        delay = initial_delay * (exponential_base ** attempt)
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_retries} failed: {str(e)}. "
                            f"Retrying in {delay:.1f} seconds..."
                        )
                        time.sleep(delay)
                    else:
                        logger.error(
                            f"All {max_retries} attempts failed. Last error: {str(e)}"
                        )
            
            raise last_exception
        
        return wrapper
    return decorator
```

## GEMINI-SPECIFIC ERROR HANDLING

```python
class GeminiService:
    
    @retry_with_exponential_backoff(
        max_retries=3,
        initial_delay=2.0,
        exceptions=(Exception,)
    )
    def generate_with_retry(self, prompt: str) -> str:
        """
        Generate content with automatic retry
        
        Args:
            prompt: Input prompt
        
        Returns:
            Generated text
        
        Raises:
            Exception: If all retries fail
        """
        try:
            logger.info(f"Generating content with {self.model_name}")
            
            response = self.model.generate_content(prompt)
            
            # Check if response is valid
            if not response.text:
                raise ValueError("Empty response from Gemini API")
            
            logger.info("Content generated successfully")
            return response.text
            
        except Exception as e:
            logger.error(f"Generation error: {str(e)}")
            raise
    
    def handle_api_errors(self, error: Exception) -> str:
        """
        Handle Gemini API errors with user-friendly messages
        
        Args:
            error: Exception from Gemini API
        
        Returns:
            User-friendly error message
        """
        error_str = str(error).lower()
        
        # ✅ Rate limit
        if "quota" in error_str or "rate limit" in error_str:
            return "API лимитът е достигнат. Моля, опитайте отново след малко."
        
        # ✅ API key error
        if "api key" in error_str or "authentication" in error_str:
            return "Проблем с API ключа. Моля, проверете конфигурацията."
        
        # ✅ Content filter
        if "safety" in error_str or "blocked" in error_str:
            return "Съдържанието е блокирано от филтрите за безопасност."
        
        # ✅ Network error
        if "network" in error_str or "connection" in error_str:
            return "Проблем с мрежата. Моля, проверете интернет връзката."
        
        # ✅ Generic error
        return f"Грешка при генериране: {str(error)}"
```

## TIMEOUT HANDLING

```python
import signal
from contextlib import contextmanager

class TimeoutError(Exception):
    """Timeout exception"""
    pass

@contextmanager
def timeout(seconds: int):
    """
    Context manager for timeout
    
    Usage:
        with timeout(30):
            result = long_running_operation()
    """
    
    def timeout_handler(signum, frame):
        raise TimeoutError(f"Operation timed out after {seconds} seconds")
    
    # Set timeout
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(seconds)
    
    try:
        yield
    finally:
        # Cancel timeout
        signal.alarm(0)

# Usage in service
def generate_with_timeout(self, prompt: str, timeout_seconds: int = 30) -> str:
    """Generate content with timeout"""
    
    try:
        with timeout(timeout_seconds):
            return self.generate_with_retry(prompt)
    except TimeoutError as e:
        logger.error(f"Generation timed out: {str(e)}")
        raise ValueError("AI анализът отне твърде много време. Моля, опитайте отново.")
```

================================================================================
SECTION 5: RESPONSE PARSING (REGEX PATTERNS)
================================================================================

## SECTION EXTRACTION WITH REGEX

```python
import re
from typing import List, Dict, Optional

class ResponseParser:
    """Parser for Gemini AI responses"""
    
    # ✅ Regex patterns for 5 sections
    SECTION_PATTERNS = {
        'lowest_results': r'LOWEST_RESULTS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
        'highest_results': r'HIGHEST_RESULTS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
        'recommendations': r'RECOMMENDATIONS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
        'focus_areas': r'FOCUS_AREAS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
        'general_insights': r'GENERAL_INSIGHTS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
    }
    
    @staticmethod
    def parse_sections(response_text: str) -> Dict[str, str]:
        """
        Parse response into 5 sections using regex
        
        Args:
            response_text: Raw response from Gemini
        
        Returns:
            Dictionary with section names as keys
        
        Example:
            {
                'lowest_results': 'Учениците имат...',
                'highest_results': 'Най-добри резултати...',
                ...
            }
        """
        sections = {}
        
        for section_name, pattern in ResponseParser.SECTION_PATTERNS.items():
            match = re.search(pattern, response_text, re.DOTALL | re.IGNORECASE)
            
            if match:
                content = match.group(1).strip()
                sections[section_name] = content
                logger.debug(f"Parsed section: {section_name} ({len(content)} chars)")
            else:
                logger.warning(f"Section not found: {section_name}")
                sections[section_name] = ""
        
        return sections
    
    @staticmethod
    def validate_sections(sections: Dict[str, str]) -> bool:
        """
        Validate that all sections are present and non-empty
        
        Args:
            sections: Parsed sections dictionary
        
        Returns:
            True if valid, False otherwise
        """
        required_sections = [
            'lowest_results',
            'highest_results', 
            'recommendations',
            'focus_areas',
            'general_insights'
        ]
        
        for section in required_sections:
            if section not in sections or not sections[section]:
                logger.error(f"Missing or empty section: {section}")
                return False
        
        return True
```

## FALLBACK PARSING STRATEGIES

```python
class ResponseParser:
    
    @staticmethod
    def fallback_parse(response_text: str) -> Dict[str, str]:
        """
        Fallback parsing when regex fails
        
        Strategy:
        1. Split by section headers (case-insensitive)
        2. Extract content between headers
        3. If still fails, return generic structure
        """
        logger.warning("Using fallback parsing strategy")
        
        sections = {}
        text_lower = response_text.lower()
        
        # Define section markers (case-insensitive)
        markers = [
            'lowest_results',
            'highest_results',
            'recommendations',
            'focus_areas',
            'general_insights'
        ]
        
        # Try to find sections by markers
        for i, marker in enumerate(markers):
            start_idx = text_lower.find(marker)
            
            if start_idx == -1:
                sections[marker] = ""
                continue
            
            # Find start of content (after marker and colon)
            content_start = start_idx + len(marker)
            if content_start < len(response_text) and response_text[content_start] == ':':
                content_start += 1
            
            # Find end of content (next marker or end of text)
            if i < len(markers) - 1:
                next_marker = markers[i + 1]
                end_idx = text_lower.find(next_marker, content_start)
                if end_idx == -1:
                    end_idx = len(response_text)
            else:
                end_idx = len(response_text)
            
            content = response_text[content_start:end_idx].strip()
            sections[marker] = content
        
        return sections
    
    @staticmethod
    def create_default_response() -> Dict[str, str]:
        """
        Create default response when parsing completely fails
        """
        logger.error("Creating default response - all parsing failed")
        
        return {
            'lowest_results': 'Анализът не можа да бъде извършен поради технически проблем.',
            'highest_results': 'Моля, опитайте отново.',
            'recommendations': 'Препоръчваме повторен опит за анализ.',
            'focus_areas': 'Няма налични данни.',
            'general_insights': 'Анализът е неуспешен. Моля, свържете се с поддръжката.'
        }
```

## COMPLETE PARSING WORKFLOW

```python
class ResponseParser:
    
    @staticmethod
    def parse_response(response_text: str) -> Dict[str, str]:
        """
        Complete parsing workflow with fallbacks
        
        Workflow:
        1. Try regex parsing
        2. If fails, try fallback parsing
        3. If still fails, return default response
        
        Args:
            response_text: Raw response from Gemini
        
        Returns:
            Dictionary with parsed sections
        """
        
        # Step 1: Try regex parsing
        try:
            sections = ResponseParser.parse_sections(response_text)
            
            if ResponseParser.validate_sections(sections):
                logger.info("Successfully parsed response with regex")
                return sections
            else:
                logger.warning("Regex parsing incomplete, trying fallback")
        
        except Exception as e:
            logger.error(f"Regex parsing failed: {str(e)}")
        
        # Step 2: Try fallback parsing
        try:
            sections = ResponseParser.fallback_parse(response_text)
            
            if ResponseParser.validate_sections(sections):
                logger.info("Successfully parsed response with fallback")
                return sections
            else:
                logger.warning("Fallback parsing incomplete")
        
        except Exception as e:
            logger.error(f"Fallback parsing failed: {str(e)}")
        
        # Step 3: Return default response
        logger.error("All parsing strategies failed, returning default")
        return ResponseParser.create_default_response()
```

================================================================================
SECTION 6: COMPLETE GEMINI SERVICE IMPLEMENTATION
================================================================================

## FULL SERVICE CLASS

```python
# app/services/gemini_service.py
"""
Complete Gemini AI Service implementation
"""
import google.generativeai as genai
from typing import Dict, Any, List
import logging
import time
import re

from app.config import settings
from app.models.responses import AnalysisSection

logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)

# Available models
GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-pro",
    "gemini-flash-001",
    "gemini-flash",
]


class GeminiService:
    """Service for Gemini AI operations"""
    
    def __init__(self):
        """Initialize Gemini service"""
        self.model_name = self._get_available_model()
        
        self.generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 2048,
        }
        
        self.model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config=self.generation_config,
        )
        
        logger.info(f"GeminiService initialized with model: {self.model_name}")
    
    def _get_available_model(self) -> str:
        """Get first available model"""
        for model_name in GEMINI_MODELS:
            try:
                genai.GenerativeModel(model_name)
                return model_name
            except Exception:
                continue
        raise RuntimeError("No Gemini models available")
    
    async def analyze_test_results(
        self,
        test_name: str,
        score: int,
        answers: Dict[str, Any]
    ) -> List[AnalysisSection]:
        """
        Analyze test results with Gemini AI
        
        Args:
            test_name: Name of test
            score: Average score
            answers: Test answers dictionary
        
        Returns:
            List of AnalysisSection objects
        
        Raises:
            ValueError: If analysis fails
        """
        try:
            # Build prompt
            prompt = self._build_prompt(test_name, score, answers)
            
            # Generate with retry
            response_text = self._generate_with_retry(prompt)
            
            # Parse response
            sections = self._parse_response(response_text)
            
            # Convert to AnalysisSection objects
            result = [
                AnalysisSection(title="Най-ниски резултати", content=sections['lowest_results']),
                AnalysisSection(title="Най-високи резултати", content=sections['highest_results']),
                AnalysisSection(title="Препоръки", content=sections['recommendations']),
                AnalysisSection(title="Фокусни области", content=sections['focus_areas']),
                AnalysisSection(title="Общи наблюдения", content=sections['general_insights']),
            ]
            
            return result
            
        except Exception as e:
            logger.error(f"Analysis failed: {str(e)}")
            raise ValueError(f"Грешка при AI анализ: {str(e)}")
    
    def _build_prompt(self, test_name: str, score: int, answers: Dict[str, Any]) -> str:
        """Build Bulgarian prompt"""
        return f"""
Ти си опитен учител и анализатор на образователни резултати. 
Анализирай следните тестови резултати и предоставя подробен анализ на български език.

ТЕСТОВИ ДАННИ:
- Име на теста: {test_name}
- Среден резултат: {score}%
- Детайли: {answers}

Предостави анализ в ТОЧНО следния формат:

LOWEST_RESULTS:

[Анализ на най-слабите области - мин. 3 изречения]

HIGHEST_RESULTS:

[Анализ на най-силните области - мин. 3 изречения]

RECOMMENDATIONS:

[Конкретни препоръки за учителя - мин. 5 точки]

FOCUS_AREAS:

[Приоритетни теми за внимание - 3-5 теми]

GENERAL_INSIGHTS:

[Обща оценка и прогноза - мин. 4 изречения]

ВАЖНО: Отговаряй на български език. Бъди конкретен и практичен.
""".strip()
    
    def _generate_with_retry(self, prompt: str, max_retries: int = 3) -> str:
        """Generate content with retry logic"""
        last_error = None
        
        for attempt in range(max_retries):
            try:
                logger.info(f"Generation attempt {attempt + 1}/{max_retries}")
                
                response = self.model.generate_content(prompt)
                
                if not response.text:
                    raise ValueError("Empty response")
                
                logger.info("Generation successful")
                return response.text
                
            except Exception as e:
                last_error = e
                logger.warning(f"Attempt {attempt + 1} failed: {str(e)}")
                
                if attempt < max_retries - 1:
                    time.sleep(2)  # 2 second delay
        
        raise last_error
    
    def _parse_response(self, response_text: str) -> Dict[str, str]:
        """Parse response into sections"""
        patterns = {
            'lowest_results': r'LOWEST_RESULTS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
            'highest_results': r'HIGHEST_RESULTS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
            'recommendations': r'RECOMMENDATIONS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
            'focus_areas': r'FOCUS_AREAS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
            'general_insights': r'GENERAL_INSIGHTS:\s*\n\n(.*?)(?=\n\n[A-Z_]+:|$)',
        }
        
        sections = {}
        
        for name, pattern in patterns.items():
            match = re.search(pattern, response_text, re.DOTALL | re.IGNORECASE)
            if match:
                sections[name] = match.group(1).strip()
            else:
                logger.warning(f"Section not found: {name}")
                sections[name] = f"Липсва секция {name}"
        
        return sections
```

================================================================================
QUICK CHECKLIST
================================================================================

Before deploying Gemini integration:
- [ ] GEMINI_API_KEY set in environment
- [ ] Model fallback list configured
- [ ] Retry logic implemented (3 attempts, 2s delay)
- [ ] Bulgarian prompts tested and validated
- [ ] Response parsing with regex working
- [ ] Fallback parsing implemented
- [ ] Error handling for API limits
- [ ] Logging all AI operations
- [ ] Timeout handling (30 seconds)
- [ ] Safety settings configured
- [ ] Generation config optimized
- [ ] Section validation implemented

================================================================================
COMMON MISTAKES TO AVOID
================================================================================

❌ Hardcoding API key in code
✅ Use environment variables: settings.GEMINI_API_KEY

❌ No retry logic for API calls
✅ Implement 3 retries with 2 second delay

❌ English prompts for Bulgarian analysis
✅ Write prompts in Bulgarian language

❌ No fallback when regex parsing fails
✅ Implement fallback parsing strategy

❌ Not validating parsed sections
✅ Check all 5 sections are present

❌ Missing timeout handling
✅ Add 30 second timeout for generation

❌ Not logging AI operations
✅ Log all attempts, successes, and failures

❌ Using single model without fallback
✅ Try multiple models in priority order

❌ Not handling empty responses
✅ Check response.text is not empty

❌ Generic error messages
✅ Provide specific, actionable error messages in Bulgarian

================================================================================
END OF GEMINI AI INTEGRATION RULES
================================================================================