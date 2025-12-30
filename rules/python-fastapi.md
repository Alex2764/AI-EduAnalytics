# PYTHON + FASTAPI BACKEND RULES

================================================================================
SECTION 1: FASTAPI PROJECT SETUP
================================================================================

## PROJECT STRUCTURE

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Configuration & environment variables
│   ├── routers/             # API route handlers
│   │   ├── __init__.py
│   │   ├── analysis.py      # AI analysis endpoints
│   │   └── health.py        # Health check endpoints
│   ├── models/              # Pydantic models
│   │   ├── __init__.py
│   │   ├── requests.py      # Request models
│   │   └── responses.py     # Response models
│   ├── services/            # Business logic
│   │   ├── __init__.py
│   │   ├── gemini_service.py
│   │   └── supabase_service.py
│   └── utils/               # Utility functions
│       ├── __init__.py
│       ├── logger.py
│       └── validators.py
├── .env                     # Environment variables (gitignored)
├── .env.example             # Example env file
├── requirements.txt         # Python dependencies
└── README.md
```

## MAIN.PY - FASTAPI APP

```python
# app/main.py
"""
FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import settings
from app.routers import analysis, health

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AI Analysis API",
    description="API за AI анализ на тестове с Gemini",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,  # ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])

@app.on_event("startup")
async def startup_event():
    """Startup event handler"""
    logger.info("Starting FastAPI application...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"CORS Origins: {settings.ALLOWED_ORIGINS}")

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler"""
    logger.info("Shutting down FastAPI application...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes (development only)
    )
```

## CONFIG.PY - ENVIRONMENT VARIABLES

```python
# app/config.py
"""
Application configuration with environment variables
"""
from pydantic_settings import BaseSettings
from typing import List
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

class Settings(BaseSettings):
    """Application settings"""
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Gemini API
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default port
    ]
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Supabase (if needed from backend)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Create settings instance
settings = Settings()

# Validate required settings
def validate_settings():
    """Validate that required environment variables are set"""
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is required")
    
    if settings.ENVIRONMENT == "production":
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("Supabase credentials required in production")

# Run validation on import
validate_settings()
```

## .ENV FILE STRUCTURE

```bash
# .env (add to .gitignore!)
ENVIRONMENT=development
GEMINI_API_KEY=your_gemini_api_key_here
LOG_LEVEL=INFO

# Supabase (optional from backend)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_supabase_key_here

# .env.example (commit this to git)
ENVIRONMENT=development
GEMINI_API_KEY=your_gemini_api_key_here
LOG_LEVEL=INFO
SUPABASE_URL=
SUPABASE_KEY=
```

## REQUIREMENTS.TXT

```txt
# Core dependencies
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0

# Environment variables
python-dotenv==1.0.0

# Google Gemini AI
google-generativeai==0.3.1

# HTTP client (optional)
httpx==0.25.0

# CORS
python-multipart==0.0.6
```

================================================================================
SECTION 2: PYDANTIC MODELS
================================================================================

## REQUEST MODELS

```python
# app/models/requests.py
"""
Pydantic models for API requests
"""
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional

class AnalysisRequest(BaseModel):
    """Request model for AI analysis"""
    
    user_id: str = Field(..., description="ID на потребителя")
    test_result_id: str = Field(..., description="ID на тестов резултат")
    test_name: str = Field(..., min_length=1, max_length=100)
    score: int = Field(..., ge=0, le=100, description="Резултат 0-100")
    answers: Dict[str, Any] = Field(..., description="JSON с отговорите")
    
    @validator('answers')
    def validate_answers(cls, v):
        """Validate answers dict is not empty"""
        if not v:
            raise ValueError("Answers cannot be empty")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "test_result_id": "987e6543-e21b-45d6-a789-123456789012",
                "test_name": "Математика - Тест 1",
                "score": 75,
                "answers": {
                    "question_1": "correct",
                    "question_2": "incorrect",
                    "question_3": "correct"
                }
            }
        }

class TestDataRequest(BaseModel):
    """Request model for test data"""
    
    test_name: str
    questions: List[Dict[str, Any]]
    student_answers: List[str]
    correct_answers: List[str]
    
    @validator('questions')
    def validate_questions(cls, v):
        if len(v) == 0:
            raise ValueError("Questions list cannot be empty")
        return v
```

## RESPONSE MODELS

```python
# app/models/responses.py
"""
Pydantic models for API responses
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class AnalysisSection(BaseModel):
    """AI анализ секция"""
    
    title: str = Field(..., description="Заглавие на секцията")
    content: str = Field(..., description="Съдържание")
    
class AnalysisResponse(BaseModel):
    """Response model for AI analysis"""
    
    analysis_id: str = Field(..., description="ID на анализа")
    status: str = Field(..., description="Status: completed, failed, processing")
    sections: Optional[List[AnalysisSection]] = Field(None, description="Секции на анализа")
    error: Optional[str] = Field(None, description="Грешка при обработка")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "analysis_id": "abc123",
                "status": "completed",
                "sections": [
                    {
                        "title": "Най-ниски резултати",
                        "content": "Учениците имат най-ниски резултати в..."
                    },
                    {
                        "title": "Най-високи резултати",
                        "content": "Учениците се справят добре с..."
                    }
                ],
                "error": None,
                "created_at": "2024-12-29T10:00:00"
            }
        }

class ErrorResponse(BaseModel):
    """Error response model"""
    
    error: str = Field(..., description="Съобщение за грешка")
    detail: Optional[str] = Field(None, description="Допълнителни детайли")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
class HealthResponse(BaseModel):
    """Health check response"""
    
    status: str = Field(..., description="healthy or unhealthy")
    version: str = Field(..., description="API version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
```

================================================================================
SECTION 3: API ROUTE HANDLERS
================================================================================

## HEALTH CHECK ROUTER

```python
# app/routers/health.py
"""
Health check endpoints
"""
from fastapi import APIRouter, status
from app.models.responses import HealthResponse

router = APIRouter()

@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Проверка дали API-то работи"
)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        version="1.0.0"
    )
```

## ANALYSIS ROUTER

```python
# app/routers/analysis.py
"""
AI Analysis endpoints
"""
from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from typing import List
import logging

from app.models.requests import AnalysisRequest
from app.models.responses import AnalysisResponse, ErrorResponse
from app.services.gemini_service import GeminiService

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Gemini service
gemini_service = GeminiService()

@router.post(
    "/analysis",
    response_model=AnalysisResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="Създаване на AI анализ",
    description="Изпраща тестови данни към Gemini за анализ"
)
async def create_analysis(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks
) -> AnalysisResponse:
    """
    Create AI analysis for test results
    
    Args:
        request: Analysis request data
        background_tasks: FastAPI background tasks
    
    Returns:
        AnalysisResponse with analysis results
    
    Raises:
        HTTPException: If analysis fails
    """
    try:
        logger.info(f"Creating analysis for user {request.user_id}")
        
        # Process analysis
        analysis_result = await gemini_service.analyze_test_results(
            test_name=request.test_name,
            score=request.score,
            answers=request.answers
        )
        
        # You can use background_tasks for long-running operations
        # background_tasks.add_task(send_notification, request.user_id)
        
        logger.info(f"Analysis completed for user {request.user_id}")
        
        return AnalysisResponse(
            analysis_id=request.test_result_id,
            status="completed",
            sections=analysis_result,
            error=None
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate analysis"
        )

@router.get(
    "/analysis/{analysis_id}",
    response_model=AnalysisResponse,
    summary="Вземане на анализ",
    description="Връща съществуващ анализ по ID"
)
async def get_analysis(analysis_id: str) -> AnalysisResponse:
    """
    Get existing analysis by ID
    
    Args:
        analysis_id: Analysis ID
    
    Returns:
        AnalysisResponse
    
    Raises:
        HTTPException: If analysis not found
    """
    try:
        # Here you would fetch from database
        # For now, return example
        logger.info(f"Fetching analysis {analysis_id}")
        
        # TODO: Implement database lookup
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis {analysis_id} not found"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analysis"
        )
```

================================================================================
SECTION 4: ERROR HANDLING & LOGGING
================================================================================

## CUSTOM EXCEPTION HANDLER

```python
# app/main.py (add to existing file)
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions"""
    logger.error(f"HTTP error: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation error",
            "detail": exc.errors(),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "timestamp": datetime.utcnow().isoformat()
        }
    )
```

## LOGGING SETUP

```python
# app/utils/logger.py
"""
Logging configuration
"""
import logging
import sys
from typing import Optional

def setup_logger(
    name: str,
    level: str = "INFO",
    log_file: Optional[str] = None
) -> logging.Logger:
    """
    Setup logger with console and optional file handler
    
    Args:
        name: Logger name
        level: Log level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional log file path
    
    Returns:
        Configured logger
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    
    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    
    # File handler (optional)
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

# Usage
logger = setup_logger(__name__, level="INFO")
```

================================================================================
SECTION 5: ASYNC/AWAIT PATTERNS
================================================================================

## ASYNC BEST PRACTICES

```python
# ✅ Use async def for I/O operations
async def fetch_data_from_api(url: str) -> dict:
    """Fetch data asynchronously"""
    import httpx
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.json()

# ✅ Use regular def for CPU-bound operations
def calculate_statistics(data: List[int]) -> dict:
    """CPU-bound calculation (don't use async)"""
    return {
        "mean": sum(data) / len(data),
        "max": max(data),
        "min": min(data),
    }

# ✅ Combine async and sync properly
async def process_test_results(test_id: str) -> dict:
    """Process test results with mixed operations"""
    
    # I/O operation - use await
    data = await fetch_data_from_api(f"/api/tests/{test_id}")
    
    # CPU-bound operation - regular call
    stats = calculate_statistics(data['scores'])
    
    # I/O operation - use await
    await save_to_database(stats)
    
    return stats

# ✅ Parallel async operations
import asyncio

async def fetch_multiple_tests(test_ids: List[str]) -> List[dict]:
    """Fetch multiple tests in parallel"""
    tasks = [fetch_data_from_api(f"/api/tests/{tid}") for tid in test_ids]
    results = await asyncio.gather(*tasks)
    return results

# ❌ Don't use async for non-I/O operations
async def add_numbers(a: int, b: int) -> int:  # ❌ Bad
    return a + b

# ✅ Just use regular function
def add_numbers(a: int, b: int) -> int:  # ✅ Good
    return a + b
```

================================================================================
SECTION 6: TYPE HINTS & PEP 8
================================================================================

## TYPE HINTS

```python
from typing import List, Dict, Optional, Union, Any, Tuple
from datetime import datetime

# ✅ Function with type hints
def analyze_test(
    test_name: str,
    scores: List[int],
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Union[str, float]]:
    """
    Analyze test scores
    
    Args:
        test_name: Name of the test
        scores: List of scores
        metadata: Optional metadata dictionary
    
    Returns:
        Dictionary with analysis results
    """
    average = sum(scores) / len(scores)
    
    return {
        "test_name": test_name,
        "average_score": average,
        "total_students": len(scores),
    }

# ✅ Class with type hints
class TestAnalyzer:
    """Test analyzer class"""
    
    def __init__(self, api_key: str) -> None:
        self.api_key: str = api_key
        self.results: List[Dict[str, Any]] = []
    
    def add_result(self, result: Dict[str, Any]) -> None:
        """Add test result"""
        self.results.append(result)
    
    def get_average_score(self) -> float:
        """Calculate average score"""
        if not self.results:
            return 0.0
        
        total = sum(r['score'] for r in self.results)
        return total / len(self.results)
```

## PEP 8 COMPLIANCE

```python
# ✅ Naming conventions
class_name = "ClassName"           # PascalCase for classes
function_name = "function_name"    # snake_case for functions
CONSTANT_NAME = "CONSTANT_NAME"    # UPPER_CASE for constants
variable_name = "variable_name"    # snake_case for variables

# ✅ Imports order
# 1. Standard library
import os
import sys
from typing import List

# 2. Third-party
from fastapi import FastAPI
from pydantic import BaseModel

# 3. Local
from app.services import GeminiService
from app.models import AnalysisRequest

# ✅ Line length: max 88 characters (Black default)
# or max 79 characters (strict PEP 8)

# ✅ Blank lines
# Two blank lines between top-level functions/classes
def function_one():
    pass


def function_two():
    pass


class MyClass:
    pass

# ✅ Whitespace
# Good
result = calculate_score(x, y)
items[0]
data = {'key': 'value'}

# Bad
result=calculate_score( x,y )
items [0]
data={'key':'value'}

# ✅ Comments
# Single line comment above code
result = calculate_score(x, y)

# Multi-line comment
# This is a longer explanation
# that spans multiple lines
# to describe complex logic

# ✅ Docstrings
def function_with_docstring(param1: str, param2: int) -> bool:
    """
    Brief description of function
    
    More detailed explanation if needed.
    Can span multiple lines.
    
    Args:
        param1: Description of param1
        param2: Description of param2
    
    Returns:
        True if successful, False otherwise
    
    Raises:
        ValueError: If param2 is negative
    """
    if param2 < 0:
        raise ValueError("param2 must be non-negative")
    
    return True
```

================================================================================
QUICK CHECKLIST
================================================================================

Before deploying FastAPI to production:
- [ ] Environment variables set (.env file)
- [ ] Environment variables validated on startup
- [ ] CORS origins configured properly
- [ ] Error handlers implemented
- [ ] Logging configured (INFO level minimum)
- [ ] Type hints on all functions
- [ ] Pydantic models for request/response
- [ ] API documentation working (/docs, /redoc)
- [ ] Health check endpoint implemented
- [ ] Requirements.txt up to date
- [ ] .env added to .gitignore
- [ ] PEP 8 compliant (use Black formatter)
- [ ] Async/await used correctly
- [ ] Database connections closed properly
- [ ] Background tasks for long operations

================================================================================
COMMON MISTAKES TO AVOID
================================================================================

❌ Not validating environment variables
✅ Validate on startup in config.py

❌ Committing .env to git
✅ Add .env to .gitignore, commit .env.example

❌ Using print() instead of logging
✅ Use logger.info(), logger.error()

❌ Missing type hints
✅ Add type hints to all functions

❌ Not handling exceptions
✅ Use try-except and HTTPException

❌ Blocking async functions with sync code
✅ Use async for I/O, sync for CPU-bound

❌ Hardcoding configuration
✅ Use environment variables and config.py

❌ Missing CORS configuration
✅ Configure CORSMiddleware with proper origins

❌ Not using Pydantic models
✅ Always use Pydantic for validation

❌ Poor error messages
✅ Provide clear, actionable error messages

================================================================================
END OF PYTHON + FASTAPI BACKEND RULES
================================================================================