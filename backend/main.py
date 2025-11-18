"""
Main FastAPI application for AI-powered test analysis
"""

import logging
import re
import json
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
import os

# Import services
from services.supabase_service import get_supabase_service, SupabaseConnectionError
from services.gemini_service import get_gemini_service, GeminiAPIError, ParsingError
from services.document_service import get_document_service, DocumentGenerationError

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════

API_VERSION = "1.0.0"
API_TITLE = "AI EduAnalytics API"
API_DESCRIPTION = "AI-powered educational test analysis and document generation"

# Cleanup endpoint protection (optional)
CLEANUP_API_KEY = os.getenv("CLEANUP_API_KEY")  # Set in .env for production

# Enable/disable API documentation (Swagger/OpenAPI)
# Set ENABLE_DOCS=false in production to disable /docs endpoint
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "true").lower() == "true"


# Initialize FastAPI app
# API documentation (/docs) is enabled by default for development
# Set ENABLE_DOCS=false to disable in production
app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None
)

# CORS - Allow React app to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Alternative Vite port
        "http://localhost:5175",  # Alternative Vite port
        "http://localhost:5176",  # Alternative Vite port (current)
        "http://localhost:3000",  # Create React App default
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════
# CONFIG FILE MANAGEMENT
# ═══════════════════════════════════════════════════════

CONFIG_FILE = Path(__file__).parent / "config.json"

def read_config() -> Dict[str, Any]:
    """
    Read configuration from config.json
    
    Returns:
        Configuration dictionary
    """
    if not CONFIG_FILE.exists():
        logger.warning(f"Config file not found: {CONFIG_FILE}. Creating default...")
        default_config = {
            "last_used_template": None,
            "ai_settings": {
                "temperature": 0.7,
                "max_output_tokens": 2048
            }
        }
        write_config(default_config)
        return default_config
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading config file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error reading configuration: {str(e)}"
        )


def write_config(config: Dict[str, Any]) -> None:
    """
    Write configuration to config.json
    
    Args:
        config: Configuration dictionary
    """
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        logger.info(f"Config file updated: {CONFIG_FILE}")
    except Exception as e:
        logger.error(f"Error writing config file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error writing configuration: {str(e)}"
        )


# Removed get_default_template() and set_default_template() - now using last_used_template in document_service


# ═══════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════

def sanitize_filename(text: str, max_length: int = 100) -> str:
    """
    Sanitize text for safe filename usage
    Removes special characters and limits length
    
    Args:
        text: Text to sanitize
        max_length: Maximum length of result
    
    Returns:
        Safe filename string
    """
    # Remove special characters, keep only alphanumeric, dash, underscore, dot
    safe_text = re.sub(r'[^\w\-_\.]', '_', text)
    
    # Remove multiple consecutive underscores
    safe_text = re.sub(r'_+', '_', safe_text).strip('_')
    
    # Limit length
    if len(safe_text) > max_length:
        safe_text = safe_text[:max_length]
    
    return safe_text or "document"


# ═══════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════

class GenerateReportRequest(BaseModel):
    """Request model for generating test analysis report"""
    test_id: str
    class_id: str
    teacher_name: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    gemini_configured: bool
    supabase_configured: bool
    version: str


class TemplateInfo(BaseModel):
    """Template information"""
    name: str
    is_default: bool
    size: int


class AISettings(BaseModel):
    """AI Settings configuration"""
    teacher_name: Optional[str] = None
    subject: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_output_tokens: Optional[int] = 2048


# Removed SetDefaultTemplateRequest - no longer using default template concept


# ═══════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════

@app.get("/")
async def root():
    """Root endpoint - API information"""
    endpoints = {
        "health": "/health",
        "generate_report": "/api/generate-report",
        "cleanup": "/api/cleanup",
        "templates": "/api/templates"
    }
    
    if ENABLE_DOCS:
        endpoints["docs"] = "/docs"
    
    return {
        "name": API_TITLE,
        "version": API_VERSION,
        "description": API_DESCRIPTION,
        "endpoints": endpoints
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Verifies that all required services are configured
    """
    try:
        # Check environment variables
        gemini_configured = bool(os.getenv("GEMINI_API_KEY"))
        supabase_configured = bool(
            os.getenv("SUPABASE_URL") and 
            (os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY"))
        )
        
        # Try to initialize services
        try:
            get_gemini_service()
            gemini_working = True
        except Exception as e:
            logger.warning(f"Gemini service not working: {e}")
            gemini_working = False
        
        try:
            get_supabase_service()
            supabase_working = True
        except Exception as e:
            logger.warning(f"Supabase service not working: {e}")
            supabase_working = False
        
        status = "healthy" if (gemini_working and supabase_working) else "degraded"
        
        return HealthResponse(
            status=status,
            gemini_configured=gemini_configured and gemini_working,
            supabase_configured=supabase_configured and supabase_working,
            version=API_VERSION
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            gemini_configured=False,
            supabase_configured=False,
            version=API_VERSION
        )


@app.post("/api/generate-report")
async def generate_report(request: GenerateReportRequest):
    """
    Generate AI-powered test analysis report
    
    This endpoint:
    1. Fetches test data from Supabase
    2. Generates AI analysis using Google Gemini
    3. Creates Word document using default template from settings
    4. Returns the document for download
    
    Note: The template used is the default template set in AI Settings.
    To change the template, use the /api/templates endpoints.
    
    Args:
        request: GenerateReportRequest with test_id, class_id, etc.
    
    Returns:
        FileResponse with generated Word document
    """
    
    logger.info(f"Generate report request: test_id={request.test_id}, class_id={request.class_id}")
    
    try:
        # ═══════════════════════════════════════════════════
        # STEP 1: Fetch data from Supabase
        # ═══════════════════════════════════════════════════
        
        logger.info("Step 1/3: Fetching test data from Supabase...")
        
        try:
            supabase_service = get_supabase_service()
            test_data = supabase_service.get_test_analysis_data(
                test_id=request.test_id,
                class_id=request.class_id,
                teacher_name=request.teacher_name
            )
            
            logger.info(f"Fetched data for {test_data.get('total_students', 0)} students")
            
        except SupabaseConnectionError as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        # ═══════════════════════════════════════════════════
        # STEP 2: Generate AI analysis
        # ═══════════════════════════════════════════════════
        
        logger.info("Step 2/3: Generating AI analysis with Google Gemini...")
        
        try:
            # Check if we have cached AI analysis
            supabase_service = get_supabase_service()
            cached_analytics = supabase_service.get_analytics(request.test_id)
            
            if cached_analytics and cached_analytics.get("ai_analysis"):
                logger.info("Using cached AI analysis")
                ai_analysis = cached_analytics["ai_analysis"]
            else:
                logger.info("No cached AI analysis, generating fresh...")
                gemini_service = get_gemini_service()
                ai_analysis = gemini_service.generate_analysis(test_data)
                
                # Save AI analysis to cache
                if cached_analytics:
                    # Update existing cache with AI analysis
                    statistics = cached_analytics.get("statistics", {})
                    question_success_rates = cached_analytics.get("question_success_rates", {})
                    supabase_service.save_analytics(
                        request.test_id,
                        statistics,
                        question_success_rates,
                        ai_analysis=ai_analysis
                    )
                else:
                    # Extract statistics and question success rates from test_data for caching
                    statistics = {}
                    question_success_rates = {}
                    for key, value in test_data.items():
                        if key.startswith('q') and key.endswith('_success'):
                            question_success_rates[key] = value
                        elif key not in ['test_id', 'test_name', 'class_id', 'class_name', 
                                        'subject', 'teacher_name', 'students', 'results', 'test',
                                        'total_questions', 'mc_questions', 'short_questions', 'max_points_test']:
                            statistics[key] = value
                    
                    supabase_service.save_analytics(
                        request.test_id,
                        statistics,
                        question_success_rates,
                        ai_analysis=ai_analysis
                    )
                
                logger.info("AI analysis generated and cached successfully")
            
            logger.debug(f"AI sections: {list(ai_analysis.keys())}")
            
        except GeminiAPIError as e:
            logger.error(f"Gemini API error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"AI generation error: {str(e)}"
            )
        except ParsingError as e:
            logger.error(f"AI parsing error: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"AI response parsing error: {str(e)}"
            )
        
        # ═══════════════════════════════════════════════════
        # STEP 3: Create Word document
        # ═══════════════════════════════════════════════════
        
        logger.info("Step 3/3: Creating Word document...")
        
        try:
            document_service = get_document_service()
            # Use last_used_template or first available (handled inside generate_test_analysis_document)
            logger.info(f"Using last used template or first available")
            
            document_path = document_service.generate_test_analysis_document(
                test_data=test_data,
                ai_analysis=ai_analysis,
                template_name=None  # None means use last_used_template or first available
            )
            
            logger.info(f"Document created: {document_path}")
            
        except DocumentGenerationError as e:
            error_message = str(e)
            logger.error(f"Document generation error: {error_message}")
            
            # Check if it's a "no templates" error - return 404 instead of 500
            if "No templates available" in error_message or "not found" in error_message.lower():
                raise HTTPException(
                    status_code=404,
                    detail=error_message
                )
            
            raise HTTPException(
                status_code=500,
                detail=f"Document creation error: {error_message}"
            )
        
        # ═══════════════════════════════════════════════════
        # STEP 4: Return document
        # ═══════════════════════════════════════════════════
        
        # Generate safe filename (ASCII only for headers to avoid encoding issues)
        class_name = sanitize_filename(test_data.get("class_name", "Unknown"))
        subject = sanitize_filename(test_data.get("subject", "Test"))
        filename = f"Analiz_{class_name}_{subject}.docx"
        
        logger.info(f"Returning document: {filename}")
        
        # Use only ASCII filename in headers to avoid encoding issues
        # The actual document name is preserved in the file system
        return FileResponse(
            path=document_path,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=filename
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    
    except Exception as e:
        # Catch any unexpected errors
        logger.error(f"Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected server error: {str(e)}"
        )


@app.post("/api/cleanup")
async def cleanup_old_documents(
    max_age_hours: int = 24,
    x_api_key: Optional[str] = Header(None)
):
    """
    Clean up old generated documents
    
    Protected endpoint - requires API key in production
    Set CLEANUP_API_KEY in .env to enable protection
    
    Args:
        max_age_hours: Maximum age of files to keep (default: 24 hours)
        x_api_key: API key for authentication (via X-API-Key header)
    
    Returns:
        Number of files removed
    """
    
    logger.info(f"Cleanup request: max_age_hours={max_age_hours}")
    
    # Check API key if configured
    if CLEANUP_API_KEY:
        if not x_api_key:
            logger.warning("Cleanup attempt without API key")
            raise HTTPException(
                status_code=401,
                detail="API key required. Provide X-API-Key header."
            )
        
        if x_api_key != CLEANUP_API_KEY:
            logger.warning("Cleanup attempt with invalid API key")
            raise HTTPException(
                status_code=403,
                detail="Invalid API key"
            )
        
        logger.info("Cleanup authenticated successfully")
    else:
        logger.warning("Cleanup endpoint not protected - set CLEANUP_API_KEY in production")
    
    try:
        document_service = get_document_service()
        removed_count = document_service.cleanup_old_documents(max_age_hours=max_age_hours)
        
        logger.info(f"Cleanup completed: {removed_count} files removed")
        
        return {
            "status": "success",
            "removed_count": removed_count,
            "max_age_hours": max_age_hours
        }
        
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Cleanup failed: {str(e)}"
        )


# ═══════════════════════════════════════════════════════
# TEMPLATE MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════

@app.get("/api/templates", response_model=List[TemplateInfo])
async def list_templates():
    """
    Get list of available templates
    
    Returns:
        List of template information
    """
    try:
        document_service = get_document_service()
        
        # Use document_service.list_templates() which handles Storage + fallback
        templates_data = document_service.list_templates()
        
        templates = []
        for template_data in templates_data:
            templates.append(TemplateInfo(
                name=template_data['name'],
                is_default=False,  # No longer using default concept
                size=template_data.get('size', 0)
            ))
        
        # Sort alphabetically
        templates.sort(key=lambda t: t.name)
        
        logger.info(f"Listed {len(templates)} templates")
        return templates
        
    except Exception as e:
        logger.error(f"Error listing templates: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error listing templates: {str(e)}"
        )


@app.post("/api/templates/upload")
async def upload_template(
    file: UploadFile = File(..., description="Word template file (.docx)")
):
    """
    Upload a new template file
    
    Args:
        file: Word document file (.docx)
    
    Returns:
        Success message with template name
    """
    try:
        # Validate file extension
        if not file.filename or not file.filename.lower().endswith('.docx'):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only .docx files are allowed."
            )
        
        # Sanitize filename
        safe_filename = sanitize_filename(file.filename)
        
        # Read file content first
        content = await file.read()
        
        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        if len(content) > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {max_size / (1024*1024)}MB"
            )
        
        # Get document service
        document_service = get_document_service()
        
        # Check if template already exists (in Storage or local)
        # Use document_service to check both locations
        templates = document_service.list_templates()
        existing_template = next((t for t in templates if t['name'] == safe_filename), None)
        
        if existing_template:
            raise HTTPException(
                status_code=409,
                detail=f"Template '{safe_filename}' already exists. Delete it first or use a different name."
            )
        
        # Use document_service.upload_template() which handles Storage + fallback and sets last_used_template
        try:
            document_service.upload_template(content, safe_filename)
        except DocumentGenerationError as e:
            logger.error(f"Document service upload error: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload template: {str(e)}"
            )
        
        logger.info(f"Template uploaded: {safe_filename} ({len(content)} bytes)")
        
        return {
            "status": "success",
            "message": f"Template '{safe_filename}' uploaded successfully and set as active",
            "template_name": safe_filename,
            "size": len(content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading template: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading template: {str(e)}"
        )


# Removed /api/templates/default endpoints - no longer using default template concept

@app.delete("/api/templates/{template_name}")
async def delete_template(template_name: str):
    """
    Delete a template file
    
    Args:
        template_name: Name of template to delete (URL decoded)
    
    Returns:
        Success message
    """
    try:
        # FastAPI automatically decodes URL parameters, so template_name is already decoded
        # Security check: Prevent directory traversal attacks
        # Only block actual path traversal patterns, not legitimate filenames with dots
        # Block: "../", "..\", "/..", "\..", etc. but allow ".." in filenames like "24.09..2025"
        if ('../' in template_name or 
            '..\\' in template_name or 
            template_name.startswith('/') or 
            template_name.startswith('\\') or
            '/..' in template_name or
            '\\..' in template_name or
            '..' in template_name and ('/' in template_name or '\\' in template_name)):
            logger.warning(f"Path traversal attempt detected: {template_name}")
            raise HTTPException(
                status_code=400,
                detail="Invalid template name: Path traversal not allowed"
            )
        
        # Check if it ends with .docx (case-insensitive)
        if not template_name.lower().endswith('.docx'):
            logger.warning(f"Invalid template extension: {template_name}")
            raise HTTPException(
                status_code=400,
                detail="Invalid template name: Must be a .docx file"
            )
        
        # Basic validation: template name should not be empty or only dots
        base_name = template_name[:-5] if len(template_name) > 5 else template_name  # Remove .docx extension
        if not base_name or base_name.strip() == '':
            logger.warning(f"Empty template name: {template_name}")
            raise HTTPException(
                status_code=400,
                detail="Invalid template name: Filename cannot be empty"
            )
        
        # Delete template using document_service (handles Storage + fallback, clears last_used_template if needed)
        document_service = get_document_service()
        
        try:
            document_service.delete_template(template_name)
            logger.info(f"Template deleted successfully: {template_name}")
        except DocumentGenerationError as e:
            raise HTTPException(
                status_code=404,
                detail=str(e)
            )
        
        return {
            "status": "success",
            "message": f"Template '{template_name}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting template: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting template: {str(e)}"
        )


# ═══════════════════════════════════════════════════════
# TEMPLATE VARIABLES ENDPOINT (for debugging)
# ═══════════════════════════════════════════════════════

@app.get("/api/templates/{template_name}/variables")
async def get_template_variables(template_name: str):
    """
    Get all variables used in a template file (for debugging)
    
    Args:
        template_name: Name of template to analyze
    
    Returns:
        List of template variable names
    """
    try:
        from docxtpl import DocxTemplate
        import tempfile
        from pathlib import Path
        
        document_service = get_document_service()
        
        # Try to download from Storage first
        template_path = None
        temp_template = False
        
        if document_service.use_supabase_storage and document_service.supabase_service:
            try:
                template_bytes = document_service.supabase_service.download_template(
                    template_name, 
                    document_service.storage_bucket
                )
                
                # Save to temporary file
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
                temp_file.write(template_bytes)
                temp_file.close()
                template_path = Path(temp_file.name)
                temp_template = True
                logger.info(f"Loaded template from Storage: {template_name}")
                
            except Exception as e:
                logger.warning(f"Error checking Storage: {e}. Trying local fallback.")
        
        # Fallback to local storage
        if template_path is None:
            template_path = document_service.templates_dir / template_name
            if not template_path.exists():
                raise HTTPException(
                    status_code=404,
                    detail=f"Template not found: {template_name}"
                )
            logger.info(f"Loading template from local: {template_path}")
        
        # Load template and extract variables
        try:
            doc = DocxTemplate(str(template_path))
            
            # Get all variables from template
            # DocxTemplate stores variables internally, but we can try to extract them
            # by analyzing the XML content
            variables = set()
            
            try:
                # Try to get undeclared variables (this requires rendering with empty context)
                # But we can also parse the XML directly
                from docx import Document
                from docx.opc.constants import RELATIONSHIP_TYPE as RT
                
                # Parse the template XML to find {{variable}} patterns
                import re
                import zipfile
                
                with zipfile.ZipFile(str(template_path), 'r') as zip_ref:
                    # Read main document XML
                    doc_xml = zip_ref.read('word/document.xml').decode('utf-8')
                    
                    # Find all {{variable}} patterns
                    var_pattern = r'\{\{([^}]+)\}\}'
                    matches = re.findall(var_pattern, doc_xml)
                    
                    for match in matches:
                        # Clean up the variable name (remove filters, whitespace, etc.)
                        var_name = match.strip()
                        # Remove Jinja2 filters if present (e.g., {{var|filter}})
                        if '|' in var_name:
                            var_name = var_name.split('|')[0].strip()
                        variables.add(var_name)
                        
            except Exception as e:
                logger.warning(f"Could not parse template XML: {e}. Trying alternative method.")
                # Fallback: return empty list with error message
                pass
            
            # Also try docxtpl's internal method if available
            try:
                # Some versions of docxtpl have this method
                if hasattr(doc, 'get_undeclared_template_variables'):
                    undeclared = doc.get_undeclared_template_variables({})
                    variables.update(undeclared)
            except:
                pass
            
        finally:
            # Clean up temporary file if used
            if temp_template and template_path and template_path.exists():
                try:
                    template_path.unlink()
                    logger.debug(f"Cleaned up temp template file: {template_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp template file: {e}")
        
        variables_list = sorted(list(variables))
        
        logger.info(f"Found {len(variables_list)} variables in template '{template_name}': {variables_list}")
        
        return {
            "template_name": template_name,
            "variables": variables_list,
            "count": len(variables_list)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting template variables: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error extracting template variables: {str(e)}"
        )


# ═══════════════════════════════════════════════════════
# ANALYTICS CACHE ENDPOINTS
# ═══════════════════════════════════════════════════════

@app.post("/api/analytics/{test_id}/recalculate")
async def recalculate_analytics(
    test_id: str,
    class_id: str = Query(...),
    force: bool = Query(False)
):
    """
    Recalculate and cache analytics for a test
    
    Args:
        test_id: ID of the test
        class_id: ID of the class
        force: If True, force recalculate even if cache exists
    
    Returns:
        Success message with cache status
    """
    logger.info(f"Recalculating analytics: test_id={test_id}, class_id={class_id}, force={force}")
    
    try:
        supabase_service = get_supabase_service()
        
        # Recalculate and save
        test_data = supabase_service.recalculate_and_save_analytics(
            test_id=test_id,
            class_id=class_id,
            force_recalculate=force
        )
        
        logger.info(f"Analytics recalculated successfully for test: {test_id}")
        
        return {
            "status": "success",
            "message": "Analytics recalculated and cached successfully",
            "test_id": test_id,
            "statistics_count": len([k for k in test_data.keys() if not k.startswith('q') and not k.endswith('_success')]),
            "question_success_rates_count": len([k for k in test_data.keys() if k.startswith('q') and k.endswith('_success')])
        }
        
    except SupabaseConnectionError as e:
        logger.error(f"Database error during recalculation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error during recalculation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected server error: {str(e)}"
        )


@app.delete("/api/analytics/{test_id}/cache")
async def invalidate_analytics_cache(test_id: str):
    """
    Invalidate analytics cache for a test
    
    Use this endpoint when test results are updated, added, or deleted.
    This ensures that next analytics fetch will recalculate fresh data.
    
    Args:
        test_id: ID of the test
    
    Returns:
        Success message
    """
    logger.info(f"Invalidating analytics cache: test_id={test_id}")
    
    try:
        supabase_service = get_supabase_service()
        
        success = supabase_service.invalidate_analytics(test_id)
        
        if success:
            logger.info(f"Analytics cache invalidated for test: {test_id}")
            return {
                "status": "success",
                "message": "Analytics cache invalidated successfully",
                "test_id": test_id
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to invalidate cache"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error invalidating cache: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error invalidating cache: {str(e)}"
        )


@app.post("/api/analytics/invalidate-by-result")
async def invalidate_cache_by_result(
    test_id: str
):
    """
    Invalidate analytics cache when a result is added, updated, or deleted
    
    Helper endpoint for frontend to call after result mutations.
    This ensures cached analytics are refreshed on next fetch.
    
    Args:
        test_id: ID of the test (extracted from result mutation)
    
    Returns:
        Success message
    """
    logger.info(f"Invalidating cache by result mutation: test_id={test_id}")
    
    try:
        supabase_service = get_supabase_service()
        
        success = supabase_service.invalidate_analytics(test_id)
        
        if success:
            logger.info(f"Cache invalidated after result mutation for test: {test_id}")
            return {
                "status": "success",
                "message": "Cache invalidated successfully after result mutation",
                "test_id": test_id
            }
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to invalidate cache"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error invalidating cache: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error invalidating cache: {str(e)}"
        )


# ═══════════════════════════════════════════════════════
# AI SETTINGS ENDPOINTS
# ═══════════════════════════════════════════════════════

@app.get("/api/ai-settings", response_model=AISettings)
async def get_ai_settings():
    """
    Get AI settings from config.json
    
    Returns:
        AI settings (teacher_name, subject, temperature, max_output_tokens)
    """
    try:
        config = read_config()
        ai_settings = config.get("ai_settings", {})
        
        return AISettings(
            teacher_name=ai_settings.get("teacher_name"),
            subject=ai_settings.get("subject"),
            temperature=ai_settings.get("temperature", 0.7),
            max_output_tokens=ai_settings.get("max_output_tokens", 2048)
        )
        
    except Exception as e:
        logger.error(f"Error getting AI settings: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting AI settings: {str(e)}"
        )


@app.post("/api/ai-settings", response_model=AISettings)
async def update_ai_settings(settings: AISettings):
    """
    Update AI settings in config.json
    
    Args:
        settings: AI settings to save (teacher_name, subject, temperature, max_output_tokens)
    
    Returns:
        Updated AI settings
    """
    try:
        # Read existing config
        config = read_config()
        
        # Update ai_settings section
        if "ai_settings" not in config:
            config["ai_settings"] = {}
        
        # Update only provided fields (keep existing ones if not provided)
        if settings.teacher_name is not None:
            config["ai_settings"]["teacher_name"] = settings.teacher_name
        if settings.subject is not None:
            config["ai_settings"]["subject"] = settings.subject
        if settings.temperature is not None:
            config["ai_settings"]["temperature"] = settings.temperature
        if settings.max_output_tokens is not None:
            config["ai_settings"]["max_output_tokens"] = settings.max_output_tokens
        
        # Save updated config
        write_config(config)
        
        logger.info(f"AI settings updated: teacher_name={config['ai_settings'].get('teacher_name')}, subject={config['ai_settings'].get('subject')}")
        
        return AISettings(
            teacher_name=config["ai_settings"].get("teacher_name"),
            subject=config["ai_settings"].get("subject"),
            temperature=config["ai_settings"].get("temperature", 0.7),
            max_output_tokens=config["ai_settings"].get("max_output_tokens", 2048)
        )
        
    except Exception as e:
        logger.error(f"Error updating AI settings: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error updating AI settings: {str(e)}"
        )


# ═══════════════════════════════════════════════════════
# STARTUP/SHUTDOWN EVENTS
# ═══════════════════════════════════════════════════════

@app.on_event("startup")
async def startup_event():
    """Actions to perform on application startup"""
    logger.info("="*70)
    logger.info(f"{API_TITLE} v{API_VERSION} Starting...")
    logger.info("="*70)
    
    # Check environment
    gemini_key = os.getenv("GEMINI_API_KEY")
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
    cleanup_protected = bool(CLEANUP_API_KEY)
    
    if not gemini_key:
        logger.warning("Gemini API Key is missing")
    if not supabase_url:
        logger.warning("Supabase URL is missing")
    if not supabase_key:
        logger.warning("Supabase Key is missing")
    if not cleanup_protected:
        logger.warning("Cleanup Protection is disabled (dev mode)")
    
    logger.info("Server ready!")
    if ENABLE_DOCS:
        logger.info("API docs available at: http://localhost:8000/docs")
    logger.info("="*70)


@app.on_event("shutdown")
async def shutdown_event():
    """Actions to perform on application shutdown"""
    logger.info(f"Shutting down {API_TITLE}...")


# ═══════════════════════════════════════════════════════
# RUN SERVER
# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )