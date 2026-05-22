"""
Document Service for generating Word documents from templates
"""

import os
import re
import logging
import json
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from docx.table import Table
from datetime import datetime, timedelta

try:
    from docxtpl import DocxTemplate
except ImportError:
    raise ImportError("docxtpl not installed. Run: pip install python-docx-template")

# Import settings
from config import get_settings

# Import utilities
from utils.datetime_utils import get_current_timestamp, format_timestamp, sanitize_filename

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
        self.default_school_year = get_current_timestamp("school_year")
        
        # Create directories if they don't exist
        self.templates_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)
        
        # Supabase storage settings (optional)
        settings = get_settings()
        self.use_supabase_storage = settings.use_supabase_storage
        self.storage_bucket = settings.supabase_storage_bucket
        
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
            
            # Rows to drop from Table 3: only when both q{i}_text and q{i}_success are ""
            # (computed before empty success values are coerced to "0%")
            question_rows_both_empty = self._question_rows_both_empty(context)
            
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
            
            # Check for missing keys (only log warnings/errors)
            if total_questions_from_context > 0:
                missing_keys = []
                for i in range(1, total_questions_from_context + 1):
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
            
            # 7. Remove Table 3 rows where both q{i}_text and q{i}_success are ""
            self._trim_question_table_rows(str(output_path), question_rows_both_empty)
            
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
    
    def _resolve_question_count(self, test_data: Dict[str, Any]) -> int:
        """Return the number of questions actually in the test."""
        questions = test_data.get('test', {}).get('questions', [])
        if isinstance(questions, str):
            try:
                questions = json.loads(questions)
            except json.JSONDecodeError:
                questions = []
        if questions:
            return len(questions)
        return int(test_data.get('total_questions', 0) or 0)
    
    def _find_question_achievement_table(self, doc) -> Optional["Table"]:
        """Locate Table 3 (question achievement rates) in the rendered document."""
        best_table = None
        best_data_rows = 0
        
        for table in doc.tables:
            full_text = " ".join(
                cell.text for row in table.rows for cell in row.cells
            ).lower()
            if "постижимост" in full_text or "проверявани компетентности" in full_text:
                return table
            
            data_rows = sum(
                1 for row in table.rows
                if row.cells[0].text.strip().isdigit()
            )
            if data_rows > best_data_rows:
                best_data_rows = data_rows
                best_table = table
        
        return best_table if best_data_rows >= 3 else None
    
    @staticmethod
    def _question_row_both_empty(context: Dict[str, Any], question_index: int) -> bool:
        """True when both q{i}_text and q{i}_success are exactly empty strings."""
        text = context.get(f'q{question_index}_text', '')
        success = context.get(f'q{question_index}_success', '')
        if text is None:
            text = ''
        if success is None:
            success = ''
        if not isinstance(text, str):
            text = str(text)
        if not isinstance(success, str):
            success = str(success)
        return text == '' and success == ''
    
    def _question_rows_both_empty(self, context: Dict[str, Any]) -> set:
        """Question numbers (1–24) whose text and success are both "" in context."""
        return {
            i for i in range(1, 25)
            if self._question_row_both_empty(context, i)
        }
    
    def _trim_question_table_rows(self, doc_path: str, rows_to_remove: set) -> None:
        """
        Remove Table 3 data rows for questions where both q{i}_text and q{i}_success
        are empty strings. Keeps a row if either field has a value.
        """
        if not rows_to_remove:
            return
        
        try:
            from docx import Document
        except ImportError:
            logger.warning("python-docx not available — skipping table row trim")
            return
        
        doc = Document(doc_path)
        table = self._find_question_achievement_table(doc)
        if table is None:
            logger.warning("Question achievement table not found — skipping row trim")
            return
        
        header_row_count = 0
        for row in table.rows:
            if row.cells[0].text.strip().isdigit():
                break
            header_row_count += 1
        
        removed = 0
        for row in reversed(table.rows[header_row_count:]):
            cell_text = row.cells[0].text.strip()
            if not cell_text.isdigit():
                continue
            q_num = int(cell_text)
            if q_num in rows_to_remove:
                table._tbl.remove(row._tr)
                removed += 1
        
        if removed <= 0:
            return
        
        doc.save(doc_path)
        logger.info(
            f"Trimmed {removed} question table rows (both text and success empty): "
            f"{sorted(rows_to_remove)}"
        )
    
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
        
        total_questions = self._resolve_question_count(test_data)
        logger.info(f"Building context for {total_questions} test questions")
        
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
            'total_questions': total_questions,
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
        
        # Add question success rates for each question in the test only
        if total_questions > 0:
            existing_rates = {
                k: v for k, v in test_data.items()
                if k.startswith('q') and k.endswith('_success')
            }
            
            for i in range(1, total_questions + 1):
                key = f'q{i}_success'
                value = test_data.get(key) or existing_rates.get(key)
                
                if value is None:
                    logger.warning(f"Q{i}: no success rate found, using 0%")
                    value = '0%'
                elif not isinstance(value, str):
                    value = str(value)
                    if value.replace('.', '').replace('-', '').isdigit():
                        value = f"{value}%"
                
                context[key] = str(value).strip() if value else '0%'
        else:
            logger.warning("No questions to add (total_questions=0)")
        
        questions = (test_data.get('test') or {}).get('questions') or []
        for i in range(1, 25):
            key = f'q{i}_text'
            idx = i - 1
            if idx < len(questions):
                context[key] = questions[idx].get('text', '') or ''
            else:
                context[key] = ''
        
        for i in range(1, 25):
            idx = i - 1
            if idx < len(questions):
                q = questions[idx]
                g1 = q.get('group1') or {}
                g2 = q.get('group2') or {}
                context[f'g{i}_q1_correct'] = g1.get('correctAnswer', '') or ''
                context[f'g{i}_q2_correct'] = g2.get('correctAnswer', '') or ''
            else:
                context[f'g{i}_q1_correct'] = ''
                context[f'g{i}_q2_correct'] = ''
        
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
        context['date'] = get_current_timestamp("date")
        
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
        
        # Sanitize names using utility function
        class_name_clean = sanitize_filename(class_name)
        subject_clean = sanitize_filename(subject)
        
        # Add timestamp for uniqueness
        timestamp = get_current_timestamp("filename")
        
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
                            'modified_date': template_info.get('updated_at') or template_info.get('created_at') or get_current_timestamp("iso"),
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
                            'modified_date': format_timestamp(datetime.fromtimestamp(stat.st_mtime), "iso"),
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
        
        # Sanitize filename using utility function
        safe_filename = sanitize_filename(filename, ensure_extension='.docx')
        
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
