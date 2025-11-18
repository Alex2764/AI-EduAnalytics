"""
Document Service for generating Word documents from templates
"""

import os
import re
import logging
import json
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv

try:
    from docxtpl import DocxTemplate
except ImportError:
    raise ImportError("docxtpl not installed. Run: pip install python-docx-template")

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DocumentGenerationError(Exception):
    """Custom exception for document generation errors"""
    pass


class DocumentService:
    """Service for generating Word documents from templates"""
    
    def __init__(self):
        """Initialize Document Service"""
        
        # Set up paths
        self.base_dir = Path(__file__).parent.parent
        self.templates_dir = self.base_dir / "templates"
        self.output_dir = self.base_dir / "output"
        
        # Default school year
        self.default_school_year = datetime.now().strftime("%Y/%Y")
        
        # Create directories if they don't exist
        self.templates_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)
        
        # Supabase storage settings (optional)
        self.use_supabase_storage = os.getenv("USE_SUPABASE_STORAGE", "false").lower() == "true"
        self.storage_bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "templates")
        
        # Try to import supabase service for storage
        self.supabase_service = None
        if self.use_supabase_storage:
            try:
                from services.supabase_service import get_supabase_service
                self.supabase_service = get_supabase_service()
                logger.info("Supabase Storage enabled for templates")
            except Exception as e:
                logger.warning(f"Could not initialize Supabase Storage: {e}. Using local storage.")
                self.use_supabase_storage = False
        
        logger.info(f"DocumentService initialized:")
        logger.info(f"  - Templates dir: {self.templates_dir}")
        logger.info(f"  - Output dir: {self.output_dir}")
        logger.info(f"  - Supabase Storage: {'enabled' if self.use_supabase_storage else 'disabled'}")
    
    def generate_test_analysis_document(
        self,
        test_data: Dict[str, Any],
        ai_analysis: Dict[str, str],
        template_name: Optional[str] = None
    ) -> str:
        """
        Generate Word document from template with test analysis data
        
        Args:
            test_data: Dictionary with test information and statistics
                      Must include: test_name, class_name, subject, teacher_name
                      Should include: q1_success, q2_success, ..., q{total_questions}_success
            ai_analysis: Dictionary with AI-generated analysis sections:
                        - lowest_results_analysis
                        - highest_results_analysis
                        - gaps_analysis
                        - results_analysis
                        - improvement_measures
            template_name: Name of template file (e.g., "template.docx")
                          If None, uses first available template
        
        Returns:
            Path to generated document
        
        Raises:
            DocumentGenerationError: If generation fails
        """
        
        logger.info(f"Generating document for test: {test_data.get('test_name', 'Unknown')}")
        
        try:
            # 1. Validate inputs
            self._validate_test_data(test_data)
            self._validate_ai_analysis(ai_analysis)
            
            # 2. Load template
            template_path = self._load_template(template_name)
            logger.info(f"Template loaded: {template_path.name}")
            
            # 3. Build context for template
            context = self._build_context(test_data, ai_analysis)
            
            # 4. Render document
            doc = DocxTemplate(str(template_path))
            
            # Clean up temporary template file if used (after loading)
            temp_template = False
            if self.use_supabase_storage and template_path and template_path.parent != self.templates_dir:
                temp_template = True
            
            # Ensure ALL q*_success keys exist and have non-empty values
            total_questions_from_context = context.get('total_questions', 0)
            if total_questions_from_context > 0:
                fixed_count = 0
                for i in range(1, min(total_questions_from_context + 1, 100)):
                    key = f'q{i}_success'
                    
                    if key not in context:
                        context[key] = '0%'
                        fixed_count += 1
                    else:
                        value = context[key]
                        if value is None or str(value).strip() == '' or str(value).strip() == 'None':
                            context[key] = '0%'
                            fixed_count += 1
                        else:
                            if not isinstance(value, str):
                                value = str(value)
                            if not value.endswith('%'):
                                if value.replace('.', '').replace('-', '').isdigit():
                                    value = f"{value}%"
                            context[key] = str(value).strip()
                
                if fixed_count > 0:
                    logger.warning(f"Fixed {fixed_count} missing/empty question success values")
            
            # Ensure Q11-Q19 are ALWAYS in context for template compatibility
            q11_19_added = 0
            for i in range(11, 20):
                key = f'q{i}_success'
                if key not in context or context[key] is None or str(context[key]).strip() == '' or str(context[key]).strip() == 'None':
                    context[key] = "0%"
                    q11_19_added += 1
            
            if q11_19_added > 0:
                logger.debug(f"Added {q11_19_added} Q11-Q19 values for template compatibility")
            
            # Check for missing keys (only log warnings/errors)
            total_questions_for_log = total_questions_from_context if total_questions_from_context > 0 else context.get('total_questions', 0)
            if total_questions_for_log > 0:
                max_q_to_log = max(19, total_questions_for_log)
                missing_keys = []
                
                for i in range(1, max_q_to_log + 1):
                    key = f'q{i}_success'
                    if key not in context:
                        missing_keys.append(key)
                
                if missing_keys:
                    logger.error(f"Missing question success keys in context: {missing_keys}")
            
            # Render document
            try:
                doc.render(context)
            except Exception as e:
                logger.error(f"Error during doc.render(): {e}", exc_info=True)
                raise DocumentGenerationError(f"Template rendering failed: {str(e)}")
            
            # Clean up temporary template file if used
            if temp_template and template_path and template_path.exists():
                try:
                    template_path.unlink()
                    logger.debug(f"Cleaned up temp template file: {template_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temp template file: {e}")
            
            # 5. Generate output filename
            output_filename = self._generate_filename(test_data)
            output_path = self.output_dir / output_filename
            
            # 6. Save document
            doc.save(str(output_path))
            logger.info(f"Document generated successfully: {output_filename}")
            
            return str(output_path)
            
        except DocumentGenerationError:
            raise
        except Exception as e:
            error_msg = f"Failed to generate document: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise DocumentGenerationError(error_msg)
    
    def _validate_test_data(self, test_data: Dict[str, Any]) -> None:
        """
        Validate that test_data has required fields
        
        Args:
            test_data: Test data to validate
        
        Raises:
            DocumentGenerationError: If validation fails
        """
        required_fields = ['class_name', 'subject', 'total_students']
        
        for field in required_fields:
            if field not in test_data:
                raise DocumentGenerationError(f"Missing required field in test_data: {field}")
        
        logger.debug("test_data validation passed")
    
    def _validate_ai_analysis(self, ai_analysis: Dict[str, str]) -> None:
        """
        Validate that ai_analysis has all required sections
        Note: Will use default text if sections are missing/empty during context building
        
        Args:
            ai_analysis: AI analysis to validate
        
        Raises:
            DocumentGenerationError: If validation fails completely
        """
        required_sections = [
            'lowest_results_analysis',
            'highest_results_analysis',
            'gaps_analysis',
            'results_analysis',
            'improvement_measures'
        ]
        
        # Check if any sections exist at all
        existing_sections = [s for s in required_sections if s in ai_analysis and ai_analysis[s]]
        
        if not existing_sections:
            logger.warning("No AI analysis sections found - will use default text")
        
        # Log warnings for missing/empty sections, but don't fail
        for section in required_sections:
            if section not in ai_analysis:
                logger.warning(f"Section '{section}' is missing - will use default text")
            elif not ai_analysis[section] or ai_analysis[section].strip() == '':
                logger.warning(f"Section '{section}' is empty - will use default text")
            elif len(ai_analysis[section]) < 10:
                logger.warning(f"Section '{section}' is very short ({len(ai_analysis[section])} chars) - may be replaced with default")
        
        logger.debug(f"AI analysis validation: {len(existing_sections)}/{len(required_sections)} sections found")
    
    def _load_template(self, template_name: Optional[str] = None) -> Path:
        """
        Load template file from storage or local
        
        Args:
            template_name: Name of template file, or None to use first available
        
        Returns:
            Path to template file
        
        Raises:
            DocumentGenerationError: If template not found
        """
        
        # If template_name provided, try to load it
        if template_name:
            # Try Supabase Storage first
            if self.use_supabase_storage and self.supabase_service:
                try:
                    template_bytes = self.supabase_service.download_template(template_name, self.storage_bucket)
                    
                    # Save to temporary file
                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
                    temp_file.write(template_bytes)
                    temp_file.close()
                    template_path = Path(temp_file.name)
                    
                    logger.info(f"Template loaded from Storage: {template_name}")
                    return template_path
                    
                except Exception as e:
                    logger.warning(f"Failed to load from Storage: {e}. Trying local...")
            
            # Try local storage
            template_path = self.templates_dir / template_name
            if template_path.exists():
                logger.info(f"Template loaded from local: {template_name}")
                return template_path
            else:
                raise DocumentGenerationError(f"Template not found: {template_name}")
        
        # No template_name - find first available
        # Try Storage first
        if self.use_supabase_storage and self.supabase_service:
            try:
                templates = self.supabase_service.list_templates(self.storage_bucket)
                if templates:
                    template_name = templates[0]['name']
                    template_bytes = self.supabase_service.download_template(template_name, self.storage_bucket)
                    
                    # Save to temporary file
                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
                    temp_file.write(template_bytes)
                    temp_file.close()
                    template_path = Path(temp_file.name)
                    
                    logger.info(f"Using first template from Storage: {template_name}")
                    return template_path
            except Exception as e:
                logger.warning(f"Failed to list from Storage: {e}. Trying local...")
        
        # Try local storage
        local_templates = list(self.templates_dir.glob("*.docx"))
        if local_templates:
            template_path = local_templates[0]
            logger.info(f"Using first template from local: {template_path.name}")
            return template_path
        
        raise DocumentGenerationError("No templates available. Please upload a template first.")
    
    def _build_context(
        self,
        test_data: Dict[str, Any],
        ai_analysis: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Build context dictionary for template rendering
        
        Args:
            test_data: Test information
            ai_analysis: AI-generated sections
        
        Returns:
            Complete context dict with all template variables
        """
        
        logger.debug("Building template context...")
        
        # CRITICAL: Get actual question count before building context
        # We'll set total_questions=19 in context for template loop compatibility
        actual_questions = test_data.get('total_questions', 0)
        logger.info(f"Setting total_questions=19 for template compatibility (actual test has {actual_questions} questions)")
        
        # Basic information
        context = {
            'class_name': test_data.get('class_name', 'Unknown'),
            'subject': test_data.get('subject', 'Unknown'),
            'teacher_name': test_data.get('teacher_name', 'Unknown'),
            'school_year': test_data.get('school_year', self.default_school_year),
            
            # Statistics
            'total_students': test_data.get('total_students', 0),
            'boys_count': test_data.get('boys_count', 0),
            'girls_count': test_data.get('girls_count', 0),
            
            # Test information
            # CRITICAL: Set total_questions to 19 for template loop compatibility
            # Template expects up to 19 questions in Table 3, so we set it to 19
            # This ensures Q11-Q19 are included in the loop even if test has fewer questions
            'total_questions': 19,  # Always 19 for template compatibility (Table 3 has rows for Q1-Q19)
            'actual_total_questions': actual_questions,  # Keep original count for other uses
            'mc_questions': test_data.get('mc_questions', 0),
            'short_questions': test_data.get('short_questions', 0),
            
            # Test max points (from test table, not from results)
            'max_points_test': test_data.get('test', {}).get('max_points') or test_data.get('max_points_test', 100),
            
            # Results
            'min_points': test_data.get('min_points', 0),
            'max_points': test_data.get('max_points', 0),  # Max points from actual results
            'avg_points': test_data.get('avg_points', 0),
            'avg_grade': test_data.get('avg_grade', 0),
            'avg_percentage': test_data.get('avg_percentage', 0),
            
            # Participation statistics
            'participated_count': test_data.get('participated_count', 0),
            'non_participating_count': test_data.get('non_participating_count', 0),
            
            # Calculated statistics from programmatic analysis
            'pass_rate': test_data.get('pass_rate', 0),
            'good_grades_percentage': test_data.get('good_grades_percentage', 0),
            'good_grades_count': test_data.get('good_grades_count', 0),
            
            # Grade distribution
            'grade_distribution_6': test_data.get('grade_distribution', {}).get(6, 0),
            'grade_distribution_5': test_data.get('grade_distribution', {}).get(5, 0),
            'grade_distribution_4': test_data.get('grade_distribution', {}).get(4, 0),
            'grade_distribution_3': test_data.get('grade_distribution', {}).get(3, 0),
            'grade_distribution_2': test_data.get('grade_distribution', {}).get(2, 0),
            
            # Grade percentages
            'grade_percentage_6': test_data.get('grade_percentages', {}).get(6, 0.0),
            'grade_percentage_5': test_data.get('grade_percentages', {}).get(5, 0.0),
            'grade_percentage_4': test_data.get('grade_percentages', {}).get(4, 0.0),
            'grade_percentage_3': test_data.get('grade_percentages', {}).get(3, 0.0),
            'grade_percentage_2': test_data.get('grade_percentages', {}).get(2, 0.0),
        }
        
        # Add AI analysis sections
        context.update({
            'lowest_results_analysis': ai_analysis.get('lowest_results_analysis', ''),
            'highest_results_analysis': ai_analysis.get('highest_results_analysis', ''),
            'gaps_analysis': ai_analysis.get('gaps_analysis', ''),
            'results_analysis': ai_analysis.get('results_analysis', ''),
            'improvement_measures': ai_analysis.get('improvement_measures', ''),
        })
        
        # Add question success rates dynamically
        # CRITICAL: Ensure ALL q*_success values from 1 to total_questions are in context
        questions = test_data.get('test', {}).get('questions', [])
        
        # Parse questions if it's a JSON string
        if isinstance(questions, str):
            try:
                questions = json.loads(questions)
            except:
                questions = []
        
        # CRITICAL: Use len(questions) if available, as it's the actual count of questions in the test
        # This ensures we calculate rates for ALL questions (e.g., if test has 19 questions but total_questions=10)
        questions_count = len(questions) if questions else 0
        test_data_total = test_data.get('total_questions', 0)
        # Use the maximum - either from test_data or from actual questions array
        total_questions = max(test_data_total, questions_count) if test_data_total > 0 or questions_count > 0 else 0
        
        # For template compatibility, we need up to 19 questions (Table 3 has rows for Q1-Q19)
        template_total_questions = 19
        
        if total_questions > 0 or template_total_questions > 0:
            max_questions = max(total_questions, template_total_questions)
            
            existing_rates = {k: v for k, v in test_data.items() if k.startswith('q') and k.endswith('_success')}
            
            # Ensure ALL questions from 1 to max_questions (19) have a value in context
            # This prevents empty cells in the document
            for i in range(1, max_questions + 1):
                key = f'q{i}_success'
                
                # Try multiple ways to find the value
                value = None
                
                # 1. Direct key in test_data (from fresh calculation or merged cache)
                if key in test_data:
                    value = test_data[key]
                
                # 2. Check if it's in existing_rates dict (already extracted above)
                if value is None and key in existing_rates:
                    value = existing_rates[key]
                
                # 3. Fallback to 0% if not found
                if value is None:
                    if i <= questions_count:
                        logger.warning(f"Q{i}: Question exists in test but no success rate found, using 0%")
                    value = '0%'
                
                # Ensure value is a string and never empty
                if value is None or value == '':
                    value = '0%'
                elif not isinstance(value, str):
                    value = str(value)
                    # Ensure it ends with % if it's a number
                    if value.replace('.', '').replace('-', '').isdigit():
                        value = f"{value}%"
                
                context[key] = str(value).strip() if value else '0%'
        else:
            logger.warning(f"No questions to add (total_questions={total_questions})")
        
        # Ensure AI analysis sections always have content (never empty)
        # Add default text if section is missing or empty
        ai_section_defaults = {
            'lowest_results_analysis': 'Не са налични данни за анализ на най-ниските резултати.',
            'highest_results_analysis': 'Не са налични данни за анализ на най-високите резултати.',
            'gaps_analysis': 'Не са налични данни за анализ на пропуските.',
            'results_analysis': 'Не са налични данни за общ анализ на резултатите.',
            'improvement_measures': 'Не са налични данни за мерки за подобрение.'
        }
        
        for section_key, default_text in ai_section_defaults.items():
            if section_key not in context or not context[section_key] or context[section_key].strip() == '':
                logger.warning(f"AI section '{section_key}' is missing or empty, using default text")
                context[section_key] = default_text
        
        # Add test_name and date
        context['test_name'] = test_data.get('test_name', test_data.get('test', {}).get('name', 'Тест'))
        context['date'] = datetime.now().strftime('%d.%m.%Y')
        
        return context
    
    def _generate_filename(self, test_data: Dict[str, Any]) -> str:
        """
        Generate unique filename for the document
        Safe for all filesystems - removes all special characters
        
        Args:
            test_data: Test information
        
        Returns:
            Generated filename
        """
        
        class_name = test_data.get('class_name', 'Unknown')
        subject = test_data.get('subject', 'Test')
        
        # Clean up names - keep only alphanumeric, dash, underscore, dot
        # Replace all other characters with underscore
        class_name_clean = re.sub(r'[^\w\-_\.]', '_', class_name)
        subject_clean = re.sub(r'[^\w\-_\.]', '_', subject)
        
        # Remove multiple consecutive underscores
        class_name_clean = re.sub(r'_+', '_', class_name_clean).strip('_')
        subject_clean = re.sub(r'_+', '_', subject_clean).strip('_')
        
        # Add timestamp for uniqueness
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        filename = f"Analiz_{class_name_clean}_{subject_clean}_{timestamp}.docx"
        
        return filename
    
    def cleanup_old_documents(self, max_age_hours: int = 24) -> int:
        """
        Clean up old documents from output directory
        
        Args:
            max_age_hours: Maximum age of files to keep (in hours)
        
        Returns:
            Number of files removed
        """
        
        
        try:
            current_time = datetime.now()
            removed_count = 0
            cutoff_time = current_time - timedelta(hours=max_age_hours)
            
            for file_path in self.output_dir.glob("*.docx"):
                try:
                    file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                
                    if file_mtime < cutoff_time:
                        age_hours = (current_time - file_mtime).total_seconds() / 3600
                        logger.debug(f"Removing old file: {file_path.name} (age: {age_hours:.1f}h)")
                    file_path.unlink()
                    removed_count += 1
                        
                except Exception as e:
                    logger.error(f"Error removing file {file_path.name}: {e}")
                    continue
            
            logger.info(f"Cleanup completed: {removed_count} files removed")
            return removed_count
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            return 0
    
    def list_templates(self) -> list[Dict[str, Any]]:
        """
        List all available templates from Supabase Storage or local fallback
        
        Returns:
            List of template dictionaries with name, size, modified_date
        """
        logger.debug("Listing templates...")
        
        try:
            templates = []
            
            # Try Supabase Storage first
            storage_success = False
            if self.use_supabase_storage and self.supabase_service:
                try:
                    storage_templates = self.supabase_service.list_templates(self.storage_bucket)
                    logger.info(f"Storage returned {len(storage_templates)} templates")
                    
                    for template_info in storage_templates:
                        templates.append({
                            'name': template_info.get('name', ''),
                            'size': template_info.get('size', 0),
                            'modified_date': template_info.get('updated_at') or template_info.get('created_at') or datetime.now().isoformat(),
                        })
                    storage_success = True
                    logger.info(f"Found {len(templates)} templates in Supabase Storage")
                except Exception as e:
                    logger.warning(f"Failed to list from Storage: {e}. Trying local fallback.")
            
            # Fallback to local storage if Storage failed or returned empty
            if not storage_success or not templates:
                for template_path in self.templates_dir.glob("*.docx"):
                    # Skip hidden files
                    if template_path.name.startswith("."):
                        continue
                    
                    try:
                        stat = template_path.stat()
                        templates.append({
                            'name': template_path.name,
                            'size': stat.st_size,
                            'modified_date': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        })
                    except Exception as e:
                        logger.warning(f"Error reading template {template_path.name}: {e}")
                        continue
                logger.info(f"Found {len(templates)} templates in local storage (fallback)")
            
            # Sort by name
            templates.sort(key=lambda x: x['name'])
            
            logger.debug(f"Total templates found: {len(templates)}")
            return templates
            
        except Exception as e:
            logger.error(f"Error listing templates: {e}")
            return []
    
    def delete_template(self, template_name: str) -> bool:
        """
        Delete a template file from Supabase Storage or local fallback
        
        Args:
            template_name: Name of the template file to delete
        
        Returns:
            True if successful, False otherwise
        
        Raises:
            DocumentGenerationError: If template doesn't exist
        """
        logger.info(f"Deleting template: {template_name}")
        
        # Try to delete from Storage first
        if self.use_supabase_storage and self.supabase_service:
            try:
                self.supabase_service.delete_template(template_name, self.storage_bucket)
                logger.info(f"Template deleted from Storage: {template_name}")
                return True
            except Exception as e:
                logger.warning(f"Failed to delete from Storage: {e}. Trying local fallback.")
        
        # Fallback to local storage
        template_path = self.templates_dir / template_name
        if not template_path.exists():
            error_msg = f"Template not found in Storage or local: {template_name}"
            logger.error(error_msg)
            raise DocumentGenerationError(error_msg)
        
        try:
            template_path.unlink()
            logger.info(f"Template deleted from local: {template_name}")
            return True
            
        except Exception as e:
            error_msg = f"Failed to delete template: {e}"
            logger.error(error_msg)
            raise DocumentGenerationError(error_msg)
    
    def upload_template(self, file_content: bytes, filename: str) -> bool:
        """
        Upload a new template file
        
        Args:
            file_content: Binary content of the template file
            filename: Name for the template file
        
        Returns:
            True if successful, False otherwise
        
        Raises:
            DocumentGenerationError: If upload fails
        """
        logger.info(f"Uploading template: {filename}")
        
        # Sanitize filename
        safe_filename = re.sub(r'[^\w\-_\.]', '_', filename)
        safe_filename = re.sub(r'_+', '_', safe_filename).strip('_')
        
        # Ensure .docx extension
        if not safe_filename.lower().endswith('.docx'):
            safe_filename += '.docx'
        
        # Try to upload to Supabase Storage first
        if self.use_supabase_storage and self.supabase_service:
            try:
                self.supabase_service.upload_template(file_content, safe_filename, self.storage_bucket)
                logger.info(f"Template uploaded to Storage: {safe_filename}")
                return True
            except Exception as e:
                logger.warning(f"Failed to upload to Storage: {e}. Falling back to local storage.")
        
        # Fallback to local storage
        template_path = self.templates_dir / safe_filename
        
        try:
            # Write file locally
            template_path.write_bytes(file_content)
            logger.info(f"Template uploaded to local storage: {safe_filename}")
            return True
            
        except Exception as e:
            error_msg = f"Failed to upload template: {e}"
            logger.error(error_msg)
            raise DocumentGenerationError(error_msg)


# Create singleton instance
_document_service: Optional[DocumentService] = None

def get_document_service() -> DocumentService:
    """Get or create Document service instance"""
    global _document_service
    if _document_service is None:
        logger.info("Creating new Document service instance")
        _document_service = DocumentService()
    return _document_service
