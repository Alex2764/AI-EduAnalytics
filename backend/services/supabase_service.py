"""
Supabase Service for fetching test data
"""

import logging
import random
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from supabase import create_client, Client

# Import settings
from config import get_settings

# Import utilities
from utils.datetime_utils import parse_timestamp, is_timestamp_newer, get_current_timestamp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SupabaseConnectionError(Exception):
    """Custom exception for Supabase connection errors"""
    pass


class SupabaseService:
    """Service for interacting with Supabase database"""
    
    # Possible table names for test results (tried in order)
    # Priority: "results" (most common) > "test_results" > "student_results"
    RESULTS_TABLE_NAMES = ["results", "test_results", "student_results"]
    
    def __init__(self, results_table_name: Optional[str] = None):
        """
        Initialize Supabase client
        
        Args:
            results_table_name: Optional custom table name for test results.
                              If None, will try common names automatically.
        """
        
        settings = get_settings()
        supabase_url = settings.supabase_url
        supabase_key = settings.supabase_anon_key or settings.supabase_key
        
        if not supabase_url or not supabase_key:
            error_msg = "SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables"
            logger.error(error_msg)
            raise SupabaseConnectionError(error_msg)
        
        try:
            self.client: Client = create_client(supabase_url, supabase_key)
            self.results_table_name = results_table_name
            logger.info("Supabase client initialized successfully")
            if results_table_name:
                logger.info(f"Using custom results table: {results_table_name}")
        except Exception as e:
            error_msg = f"Failed to initialize Supabase client: {e}"
            logger.error(error_msg)
            raise SupabaseConnectionError(error_msg)
    
    def get_test_analysis_data(
        self,
        test_id: str,
        class_id: str,
        teacher_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fetch all data needed for test analysis
        
        Args:
            test_id: ID of the test
            class_id: ID of the class
            teacher_name: Optional teacher name (if not provided, will use default)
        
        Returns:
            Dictionary with complete test data for analysis
        
        Raises:
            SupabaseConnectionError: If data fetching fails
        """
        
        logger.info(f"Fetching test analysis data: test_id={test_id}, class_id={class_id}")
        
        try:
            # 0. Check cache first
            cached_analytics = self.get_analytics(test_id)
            
            # AUTOMATIC CACHE VALIDATION: Check if results were modified after cache was created
            # This ensures cache is invalidated automatically when results are added/updated
            if cached_analytics:
                cache_calculated_at = cached_analytics.get("calculated_at")
                cache_updated_at = cached_analytics.get("updated_at")
                cache_timestamp = cache_updated_at or cache_calculated_at
                
                if cache_timestamp:
                    # Check if any results were added/updated after cache was calculated
                    try:
                        # Get the most recent result creation time for this test
                        latest_result = (
                            self.client.table("results")
                            .select("created_at")
                            .eq("test_id", test_id)
                            .order("created_at", desc=True)
                            .limit(1)
                            .execute()
                        )
                        
                        # Check if we have results for this test
                        if latest_result.data and len(latest_result.data) > 0:
                            latest_result_data = latest_result.data[0]
                            latest_result_time = latest_result_data.get("created_at")
                            
                            # Both timestamps must exist for comparison
                            if latest_result_time and cache_timestamp:
                                try:
                                    # Use utility function to check if latest result is newer than cache
                                    if is_timestamp_newer(latest_result_time, cache_timestamp, tolerance_seconds=1.0):
                                        logger.info(f"Cache invalidated automatically: results modified after cache was calculated")
                                        logger.debug(f"Cache timestamp: {cache_timestamp}, Latest result: {latest_result_time}")
                                        self.invalidate_analytics(test_id)
                                        cached_analytics = None  # Force recalculation
                                    else:
                                        logger.debug(f"Cache is still valid (latest result: {latest_result_time} <= cache: {cache_timestamp})")
                                except Exception as parse_error:
                                    # Any other error during parsing/comparison - use cache conservatively
                                    logger.warning(f"Error comparing timestamps: {parse_error}, will use cache anyway (fail-safe)")
                                    logger.debug(f"   Cache: {cache_timestamp} ({type(cache_timestamp).__name__}), Result: {latest_result_time} ({type(latest_result_time).__name__})")
                            else:
                                # Missing timestamp - use cache conservatively
                                logger.debug(f"Missing timestamp(s) for cache validation, using cache anyway")
                        else:
                            # No results for this test yet - cache is still valid
                            logger.debug(f"No results found for test, cache is still valid")
                            
                    except Exception as e:
                        # Any error during cache validation - use cache conservatively (fail-safe)
                        # This ensures we don't break the request if cache validation fails
                        logger.warning(f"Error checking cache validity: {e}, will use cache anyway (fail-safe)")
            
            if cached_analytics:
                logger.info(f"Using cached analytics for test: {test_id}")
                statistics = cached_analytics.get("statistics", {})
                question_success_rates = cached_analytics.get("question_success_rates", {})
                
                # Still need basic info from test and class
                test = self._get_test(test_id)
                if not test:
                    raise SupabaseConnectionError(f"Test not found: {test_id}")
                
                class_info = self._get_class(class_id)
                if not class_info:
                    raise SupabaseConnectionError(f"Class not found: {class_id}")
                
                # Use cached statistics
                stats = {**statistics, **question_success_rates}
                logger.info(f"Loaded {len(statistics)} statistics and {len(question_success_rates)} question success rates from cache")
            else:
                logger.info(f"No cache found, calculating fresh analytics for test: {test_id}")
                
                # 1. Get test info
                test = self._get_test(test_id)
                if not test:
                    raise SupabaseConnectionError(f"Test not found: {test_id}")
                
                # 2. Get class info
                class_info = self._get_class(class_id)
                if not class_info:
                    raise SupabaseConnectionError(f"Class not found: {class_id}")
                
                # 3. Get students in class
                students = self._get_students_in_class(class_id)
                
                # 4. Get test results
                results = self._get_test_results(test_id)
                
                # 5. Calculate statistics
                stats = self._calculate_statistics(students, results, test)
                
                # 6. Extract statistics and question success rates for caching
                statistics_for_cache = {}
                question_success_rates_for_cache = {}
                
                for key, value in stats.items():
                    if key.startswith('q') and key.endswith('_success'):
                        question_success_rates_for_cache[key] = value
                    else:
                        statistics_for_cache[key] = value
                
                # 7. Save to cache (async - don't block if it fails)
                try:
                    self.save_analytics(test_id, statistics_for_cache, question_success_rates_for_cache)
                except Exception as cache_error:
                    logger.warning(f"Failed to save analytics to cache: {cache_error}")
                    # Continue anyway - cache failure shouldn't break the request
            
            # 6. Determine teacher name and subject
            # Priority for teacher_name: parameter > test.teacher_name > class.teacher > AI settings > default
            # Priority for subject: test.subject > AI settings > default
            ai_settings = self._get_ai_settings()
            final_teacher_name = (
                teacher_name or 
                test.get("teacher_name") or 
                class_info.get("teacher_name") or 
                ai_settings.get("teacher_name") or
                "Преподавател"
            )
            final_subject = (
                test.get("subject") or
                ai_settings.get("subject") or
                "Unknown Subject"
            )
            
            # 7. Build complete data object
            test_data = {
                # Basic info
                "test_id": test_id,
                "test_name": test.get("name", "Unknown Test"),
                "class_id": class_id,
                "class_name": class_info.get("name", "Unknown Class"),
                "subject": final_subject,  # Use subject from AI settings if test.subject is empty
                "teacher_name": final_teacher_name,  # Use teacher_name from AI settings if not provided
                # school_year will be auto-calculated by document service
                
                # Statistics
                **stats,
            }
            
            # Test configuration - calculate from questions if not set in test
            questions_list = test.get("questions", [])
            total_questions_from_test = test.get("total_questions", 0)
            
            # Calculate mc_questions and short_questions from questions array if not set
            mc_questions_from_test = test.get("mc_questions", 0)
            short_questions_from_test = test.get("short_questions", 0)
            
            # If mc_questions or short_questions are 0 or not set, try to calculate from questions array
            if (mc_questions_from_test == 0 or short_questions_from_test == 0) and questions_list:
                mc_count = 0
                short_count = 0
                
                logger.info(f"Calculating question types from {len(questions_list)} questions...")
                
                for i, q in enumerate(questions_list):
                    # Check different possible field names for question type
                    q_type = q.get("type") or q.get("question_type") or q.get("kind") or q.get("questionType", "")
                    
                    # Also check if question has options (indicating multiple choice)
                    has_options = "options" in q or "choices" in q or "answers" in q
                    # Check if question has text input (indicating short answer)
                    has_text_input = "input" in str(q).lower() or "text" in str(q.get("answer", "")).lower()
                    
                    is_mc = False
                    is_short = False
                    
                    if q_type:
                        q_type_str = str(q_type).lower()
                        # Extended patterns for multiple choice
                        mc_patterns = ["multiple", "mc", "choice", "select", "radio", "checkbox", "избор", "множествен"]
                        # Extended patterns for short answer
                        short_patterns = ["short", "text", "answer", "open", "essay", "string", "кратък", "отворен"]
                        
                        if any(term in q_type_str for term in mc_patterns):
                            is_mc = True
                        elif any(term in q_type_str for term in short_patterns):
                            is_short = True
                    
                    # Fallback: Check structure of question
                    if not is_mc and not is_short:
                        if has_options and not has_text_input:
                            is_mc = True
                            logger.debug(f"Question {i+1}: Detected as MC (has options)")
                        elif has_text_input and not has_options:
                            is_short = True
                            logger.debug(f"Question {i+1}: Detected as Short (has text input)")
                        elif has_options:
                            # If has options, default to MC
                            is_mc = True
                            logger.debug(f"Question {i+1}: Defaulting to MC (has options)")
                        else:
                            # Default to MC if no clear indication
                            is_mc = True
                            logger.debug(f"Question {i+1}: Defaulting to MC (no clear type)")
                    
                    if is_mc:
                        mc_count += 1
                    elif is_short:
                        short_count += 1
                    else:
                        # Default to MC if still undetermined
                        mc_count += 1
                        logger.debug(f"Question {i+1}: Undetermined, defaulting to MC")
                
                # Use calculated values only if test values are 0
                if mc_questions_from_test == 0:
                    mc_questions_from_test = mc_count
                    logger.info(f"Calculated mc_questions from questions array: {mc_count}")
                if short_questions_from_test == 0:
                    short_questions_from_test = short_count
                    logger.info(f"Calculated short_questions from questions array: {short_count}")
                
                # If both are still 0, but we have questions, assume all are MC
                if mc_questions_from_test == 0 and short_questions_from_test == 0 and questions_list:
                    mc_questions_from_test = len(questions_list)
                    logger.warning(f"Could not determine question types, defaulting all {len(questions_list)} to MC")
            
            # CRITICAL: Always use len(questions_list) if questions array has items
            # Only use total_questions_from_test as fallback if questions array is empty
            # This fixes the case where test.total_questions=3 but questions array has 19 items
            if questions_list and len(questions_list) > 0:
                final_total_questions = len(questions_list)
                if total_questions_from_test != final_total_questions:
                    logger.info(f"Using len(questions_list)={final_total_questions} (test.total_questions={total_questions_from_test} is ignored)")
            else:
                final_total_questions = total_questions_from_test
                logger.info(f"Using test.total_questions={final_total_questions} (questions_list is empty)")
            
            # Add test configuration to test_data
            test_data.update({
                "total_questions": final_total_questions,
                "mc_questions": mc_questions_from_test,
                "short_questions": short_questions_from_test,
                "max_points_test": test.get("max_points", 100),  # Max points from test table
            })
            
            # CRITICAL: Always add test object - document_service needs it to get questions array
            # This is needed even when using cache to properly calculate total_questions
            test_data["test"] = test
            
            # CRITICAL: If using cache, ensure ALL question success rates from 1 to total_questions exist
            # Cache might only have q1-q3, but total_questions might be 19
            # This prevents missing q4-q19 in test_data
            if cached_analytics and final_total_questions > 0:
                logger.info(f"Ensuring all {final_total_questions} question success rates exist in test_data (cache had {len(question_success_rates)} rates)")
                for i in range(1, final_total_questions + 1):
                    key = f"q{i}_success"
                    if key not in test_data:
                        # Missing from cache - add with 0%
                        test_data[key] = "0%"
                        logger.debug(f"Added missing {key} = '0%' to test_data")
                logger.info(f"Verified all {final_total_questions} question success rates are present in test_data")
            
            # Only add raw data if not using cache (need it for fresh calculations)
            if not cached_analytics:
                test_data.update({
                    # Raw data (for advanced analysis if needed)
                    "students": students,
                    "results": results
                })
            
            logger.info(f"Successfully fetched test data: {stats['total_students']} students")
            
            # Log all data for debugging
            logger.info(f"Test data summary:")
            logger.info(f"  - Test: {test_data.get('test_name')} (ID: {test_id})")
            logger.info(f"  - Class: {test_data.get('class_name')} (ID: {class_id})")
            logger.info(f"  - Subject: {test_data.get('subject')}")
            logger.info(f"  - Total questions: {test_data.get('total_questions')}")
            logger.info(f"  - MC questions: {test_data.get('mc_questions')}")
            logger.info(f"  - Short questions: {test_data.get('short_questions')}")
            logger.info(f"  - Max points (test): {test_data.get('max_points_test')}")
            if not cached_analytics:
                logger.info(f"  - Students: {len(students)} (boys: {stats.get('boys_count')}, girls: {stats.get('girls_count')})")
                logger.info(f"  - Results: {len(results)} (participated: {stats.get('participated_count')})")
            else:
                logger.info(f"  - Using cached analytics (statistics: {len(statistics)}, question rates: {len(question_success_rates)})")
            logger.info(f"  - Grade distribution: {stats.get('grade_distribution', {})}")
            logger.info(f"  - Question success rates: {[k for k in test_data.keys() if k.startswith('q') and k.endswith('_success')]}")
            
            return test_data
            
        except SupabaseConnectionError:
            raise
        except Exception as e:
            error_msg = f"Error fetching test analysis data: {str(e)}"
            logger.error(error_msg)
            raise SupabaseConnectionError(error_msg)
    
    def _get_ai_settings(self) -> Dict[str, Any]:
        """
        Get AI settings from config.json
        
        Returns:
            Dictionary with AI settings (teacher_name, subject, etc.)
        """
        try:
            config_file = Path(__file__).parent.parent / "config.json"
            if not config_file.exists():
                logger.debug("Config file not found, using empty AI settings")
                return {}
            
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            ai_settings = config.get("ai_settings", {})
            logger.debug(f"AI settings from config: teacher_name={ai_settings.get('teacher_name')}, subject={ai_settings.get('subject')}")
            return ai_settings
            
        except Exception as e:
            logger.warning(f"Error reading AI settings from config: {e}")
            return {}
    
    def _get_test(self, test_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch test by ID from Supabase
        
        Args:
            test_id: ID of the test to fetch
        
        Returns:
            Test dictionary if found, None otherwise
        
        Raises:
            Exception: If database query fails
        """
        import json
        
        logger.debug(f"Fetching test: {test_id}")
        
        try:
            response = self.client.table("tests").select("*").eq("id", test_id).execute()
            
            if response.data and len(response.data) > 0:
                test = response.data[0]
                logger.debug(f"Test found: {test.get('name', 'Unknown')}")
                
                # Parse questions if it's a JSON string
                if "questions" in test:
                    questions = test["questions"]
                    if isinstance(questions, str):
                        try:
                            test["questions"] = json.loads(questions)
                            logger.info(f"Parsed questions JSON: {len(test['questions'])} questions")
                        except (json.JSONDecodeError, TypeError) as e:
                            logger.warning(f"Failed to parse questions JSON: {e}")
                            test["questions"] = []
                    elif not isinstance(questions, list):
                        logger.warning(f"Questions is not a list or string: {type(questions)}")
                        test["questions"] = []
                    
                    logger.info(f"Test has {len(test.get('questions', []))} questions")
                else:
                    logger.warning("Test does not have 'questions' field")
                    test["questions"] = []
                
                return test
            
            logger.warning(f"Test not found: {test_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching test: {e}")
            raise
    
    def _get_class(self, class_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch class by ID from Supabase
        
        Args:
            class_id: ID of the class to fetch
        
        Returns:
            Class dictionary if found, None otherwise
        
        Raises:
            Exception: If database query fails
        """
        
        logger.debug(f"Fetching class: {class_id}")
        
        try:
            response = self.client.table("classes").select("*").eq("id", class_id).execute()
            
            if response.data and len(response.data) > 0:
                logger.debug(f"Class found: {response.data[0].get('name', 'Unknown')}")
                return response.data[0]
            
            logger.warning(f"Class not found: {class_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching class: {e}")
            raise
    
    def _get_students_in_class(self, class_id: str) -> List[Dict[str, Any]]:
        """
        Fetch all students in a class from Supabase
        
        Args:
            class_id: ID of the class
        
        Returns:
            List of student dictionaries
        
        Raises:
            Exception: If database query fails
        """
        
        logger.debug(f"Fetching students in class: {class_id}")
        
        try:
            response = self.client.table("students").select("*").eq("class_id", class_id).execute()
            
            students = response.data or []
            logger.debug(f"Found {len(students)} students")
            return students
            
        except Exception as e:
            logger.error(f"Error fetching students: {e}")
            raise
    
    def _get_test_results(self, test_id: str) -> List[Dict[str, Any]]:
        """
        Fetch all results for a test with automatic table name detection
        
        Tries multiple common table names in order:
        1. Custom table name (if provided in constructor)
        2. "test_results"
        3. "results"
        4. "student_results"
        
        Args:
            test_id: ID of the test
        
        Returns:
            List of test result dictionaries
        
        Raises:
            SupabaseConnectionError: If no table is accessible
        """
        
        logger.debug(f"Fetching results for test: {test_id}")
        
        # Determine which table names to try
        if self.results_table_name:
            # Use custom table name only
            table_names = [self.results_table_name]
        else:
            # Try common names
            table_names = self.RESULTS_TABLE_NAMES
        
        last_error = None
        
        for table_name in table_names:
            try:
                logger.debug(f"Trying table: {table_name}")
                response = self.client.table(table_name).select("*").eq("test_id", test_id).execute()
                
                results = response.data or []
                logger.info(f"Successfully fetched {len(results)} results from table '{table_name}'")
                
                # Cache successful table name for future calls
                if not self.results_table_name:
                    self.results_table_name = table_name
                    logger.info(f"Auto-detected results table: {table_name}")
                
                return results
                
            except Exception as e:
                logger.debug(f"Table '{table_name}' not accessible: {e}")
                last_error = e
                continue
        
        # None of the table names worked
        error_msg = f"Could not fetch results from any table: {table_names}. Last error: {last_error}"
        logger.error(error_msg)
        raise SupabaseConnectionError(error_msg)
    
    def _calculate_statistics(
        self,
        students: List[Dict[str, Any]],
        results: List[Dict[str, Any]],
        test: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate statistics from students and results
        
        Args:
            students: List of students
            results: List of test results
            test: Test information
        
        Returns:
            Dictionary with calculated statistics
        """
        
        logger.debug("Calculating statistics...")
        
        # Total students
        total_students = len(students)
        
        # Count by gender (support both formats: "М"/"Ж" and "male"/"female")
        boys_count = sum(1 for s in students if s.get("gender") in ["М", "male", "м"])
        girls_count = sum(1 for s in students if s.get("gender") in ["Ж", "female", "ж"])
        
        # Log gender values found for debugging
        if students:
            gender_values_found = set(s.get("gender") for s in students if s.get("gender"))
            logger.debug(f"Gender values found in database: {gender_values_found}")
            logger.debug(f"Gender count: boys={boys_count}, girls={girls_count} (total students={len(students)})")
        
        # Results with valid points
        # Support both 'points' and 'total_points' column names for flexibility
        valid_results = [
            r for r in results 
            if r.get("points") is not None or r.get("total_points") is not None
        ]
        
        if valid_results:
            # Points statistics
            # Use 'points' if available, fallback to 'total_points'
            points_list = [
                float(r.get("points") if r.get("points") is not None else r.get("total_points")) 
                for r in valid_results
            ]
            min_points = min(points_list)
            max_points = max(points_list)
            avg_points = round(sum(points_list) / len(points_list), 1)
            
            # Grade statistics - handle both string and number grades
            grades_list = []
            for r in valid_results:
                grade = r.get("grade")
                if grade is not None:
                    try:
                        # Convert to float if it's a string
                        grade_float = float(grade)
                        grades_list.append(grade_float)
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid grade value: {grade}")
                        continue
            
            avg_grade = round(sum(grades_list) / len(grades_list), 2) if grades_list else 0
        else:
            logger.warning("No valid results found - using default statistics")
            min_points = 0
            max_points = 0
            avg_points = 0
            avg_grade = 0
        
        # Calculate question success rates
        question_stats = self._calculate_question_success(results, test)
        
        # Calculate grade distribution (българска система на закръгляване)
        grade_distribution = {
            6: 0,  # 5.50+ → 6
            5: 0,  # 4.50-5.49 → 5
            4: 0,  # 3.50-4.49 → 4
            3: 0,  # 2.50-3.49 → 3
            2: 0   # 2.00-2.49 → 2
        }
        
        grade_percentages = {
            6: 0.0,
            5: 0.0,
            4: 0.0,
            3: 0.0,
            2: 0.0
        }
        
        # Filter only participated and not cancelled results
        valid_participated_results = [
            r for r in valid_results 
            if r.get("participated", True) and not r.get("cancelled", False)
        ]
        
        participated_count = len(valid_participated_results)
        
        if valid_participated_results:
            # Calculate grade distribution
            for r in valid_participated_results:
                grade = r.get("grade")
                if grade is not None:
                    try:
                        grade_float = float(grade)
                        # Българска система на закръгляване
                        if grade_float >= 5.50:
                            grade_distribution[6] += 1
                        elif grade_float >= 4.50:
                            grade_distribution[5] += 1
                        elif grade_float >= 3.50:
                            grade_distribution[4] += 1
                        elif grade_float >= 2.50:
                            grade_distribution[3] += 1
                        elif grade_float >= 2.0:
                            grade_distribution[2] += 1
                    except (ValueError, TypeError):
                        continue
            
            # Calculate percentages
            for grade in grade_distribution.keys():
                grade_percentages[grade] = round((grade_distribution[grade] / participated_count) * 100, 1) if participated_count > 0 else 0.0
            
            # Calculate additional statistics
            # Good grades percentage (5-6)
            good_grades_count = grade_distribution[5] + grade_distribution[6]
            good_grades_percentage = round((good_grades_count / participated_count) * 100, 1) if participated_count > 0 else 0.0
            
            # Pass rate (≥2.50 = оценка 3 или по-висока)
            pass_count = sum(grade_distribution.values()) - grade_distribution[2]
            pass_rate = round((pass_count / participated_count) * 100, 1) if participated_count > 0 else 0.0
            
            # Average percentage
            percentages_list = []
            for r in valid_participated_results:
                percentage = r.get("percentage")
                if percentage is not None:
                    try:
                        percentages_list.append(float(percentage))
                    except (ValueError, TypeError):
                        pass
            
            avg_percentage = round(sum(percentages_list) / len(percentages_list), 1) if percentages_list else 0.0
            
        else:
            good_grades_percentage = 0.0
            pass_rate = 0.0
            avg_percentage = 0.0
        
        # Count non-participating students
        participating_student_ids = set()
        for r in results:
            if r.get("participated", True) and not r.get("cancelled", False):
                student_id = r.get("student_id") or r.get("student")
                if student_id:
                    participating_student_ids.add(student_id)
        
        non_participating_count = total_students - len(participating_student_ids)
        
        stats = {
            "total_students": total_students,
            "boys_count": boys_count,
            "girls_count": girls_count,
            "min_points": min_points,
            "max_points": max_points,
            "avg_points": avg_points,
            "avg_grade": avg_grade,
            "avg_percentage": avg_percentage,
            "participated_count": participated_count,
            "non_participating_count": non_participating_count,
            "grade_distribution": grade_distribution,
            "grade_percentages": grade_percentages,
            "good_grades_count": grade_distribution[5] + grade_distribution[6],
            "good_grades_percentage": good_grades_percentage,
            "pass_rate": pass_rate,
            **question_stats  # Merge question success rates into stats
        }
        
        logger.debug(f"Statistics calculated: {total_students} students, avg: {avg_points}/{avg_grade}")
        logger.debug(f"Grade distribution: 6={grade_distribution[6]}, 5={grade_distribution[5]}, 4={grade_distribution[4]}, 3={grade_distribution[3]}, 2={grade_distribution[2]}")
        logger.debug(f"Good grades: {good_grades_percentage}%, Pass rate: {pass_rate}%")
        logger.info(f"Merged {len(question_stats)} question success rates into stats")
        logger.debug(f"Question success keys in stats: {[k for k in stats.keys() if k.startswith('q') and k.endswith('_success')][:5]}")
        return stats
    
    def _calculate_question_success(
        self,
        results: List[Dict[str, Any]],
        test: Dict[str, Any]
    ) -> Dict[str, str]:
        """
        Calculate success rate for each question from question_results JSON field
        
        Args:
            results: List of test results with question_results JSON
            test: Test information with questions array
        
        Returns:
            Dictionary with q1_success, q2_success, etc.
        """
        import json
        
        questions = test.get("questions", [])
        
        # Parse questions if it's a JSON string
        if isinstance(questions, str):
            try:
                questions = json.loads(questions)
            except (json.JSONDecodeError, TypeError) as e:
                logger.warning(f"Failed to parse questions JSON: {e}")
                questions = []
        
        # CRITICAL: Always use len(questions) if questions array has items
        # Only use test.total_questions as fallback if questions array is empty
        # This fixes the case where test.total_questions=3 but questions array has 19 items
        if questions and len(questions) > 0:
            total_questions = len(questions)
            logger.info(f"Using len(questions)={total_questions} (test.total_questions={test.get('total_questions', 0)} is ignored)")
        else:
            total_questions = test.get("total_questions", 0)
            logger.info(f"Using test.total_questions={total_questions} (questions array is empty)")
        
        question_success = {}
        
        if not questions:
            logger.warning("No questions found in test - returning 0% for all")
            return question_success
        
        logger.info(f"Total questions: {total_questions} (from test: {test.get('total_questions', 0)}, actual: {len(questions)})")
        
        # Filter valid results (participated and not cancelled)
        valid_results = [
            r for r in results 
            if r.get("participated", True) and not r.get("cancelled", False)
        ]
        
        if not valid_results:
            logger.debug(f"No valid results - returning 0% for all {total_questions} questions")
            for i in range(1, total_questions + 1):
                question_success[f"q{i}_success"] = "0%"
            return question_success
        
        logger.info(f"═══════════════════════════════════════════════════════════")
        logger.info(f"Calculating question success rates")
        logger.info(f"═══════════════════════════════════════════════════════════")
        logger.info(f"Total valid results: {len(valid_results)}")
        logger.info(f"Total questions in test: {len(questions)}")
        
        # Log sample question IDs from test.questions (first 5)
        if questions:
            sample_ids = []
            for q in questions[:5]:
                q_id = q.get("id")
                if q_id:
                    sample_ids.append(f'"{str(q_id).strip()}"')
            if sample_ids:
                logger.info(f"Sample question IDs from test.questions: {', '.join(sample_ids)}")
            else:
                logger.warning("⚠️  No question IDs found in test.questions!")
        
        # Check first result's question_results structure (if exists)
        if valid_results:
            first_result = valid_results[0]
            first_question_results = first_result.get("question_results") or first_result.get("questionResults")
            if isinstance(first_question_results, str):
                try:
                    first_question_results = json.loads(first_question_results)
                except:
                    first_question_results = None
            
            if first_question_results and isinstance(first_question_results, list) and len(first_question_results) > 0:
                sample_qr_ids = []
                for qr in first_question_results[:5]:
                    qr_id = qr.get("questionId") or qr.get("question_id")
                    if qr_id:
                        sample_qr_ids.append(f'"{str(qr_id).strip()}"')
                if sample_qr_ids:
                    logger.info(f"Sample question IDs from question_results (first result): {', '.join(sample_qr_ids)}")
                else:
                    logger.warning("⚠️  No question IDs found in question_results!")
            else:
                logger.warning("⚠️  First result has no question_results array!")
        
        logger.info(f"═══════════════════════════════════════════════════════════")
        
        # Create a mapping of question ID to question index and details
        # This allows us to handle both cases: questions with IDs and questions by index
        question_map = {}  # Maps question_id -> (index, question_details)
        for i, question in enumerate(questions, start=1):
            question_id = question.get("id")
            if question_id:
                question_id_str = str(question_id).strip()
                question_map[question_id_str.lower()] = (i, question)
            # Also map by index (q1, q2, etc.) for flexibility
            question_map[f"q{i}".lower()] = (i, question)
            question_map[str(i).lower()] = (i, question)
        
        # Calculate for ALL questions from 1 to total_questions
        # This ensures we calculate rates even if questions array has fewer items
        for i in range(1, total_questions + 1):
            # Try to find question details from questions array
            question = None
            question_id = None
            max_points = 1  # Default fallback, but we'll try to get real value
            
            if i <= len(questions):
                # Question exists in array
                question = questions[i - 1]
                question_id = question.get("id")
                # CRITICAL: Get max_points - use default 1 only if really not set
                max_points = question.get("points")
                if max_points is None or max_points == 0:
                    max_points = 1
                try:
                    max_points = float(max_points)
                    if max_points <= 0:
                        max_points = 1
                except (ValueError, TypeError):
                    max_points = 1
            
            # Try multiple ways to identify this question in question_results
            # 1. By question ID (if exists)
            # 2. By index position (q1, q2, etc.)
            # 3. By numeric index (1, 2, 3, etc.)
            possible_ids = []
            if question_id:
                possible_ids.append(str(question_id).strip().lower())
            possible_ids.extend([f"q{i}", str(i), f"question{i}", f"question_{i}"])
            
            logger.info(f"Q{i}: Looking for IDs {possible_ids[:3]}... (max_points: {max_points})")
            
            # Collect points for this question from all results
            total_points_earned = 0
            students_with_answer = 0
            
            for result in valid_results:
                question_results = result.get("question_results") or result.get("questionResults")
                
                # Handle JSON string if needed
                if isinstance(question_results, str):
                    try:
                        question_results = json.loads(question_results)
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.warning(f"Failed to parse question_results JSON: {e}")
                        continue
                
                if not question_results or not isinstance(question_results, list):
                    # No question-level data for this result
                    continue
                
                # Find this question's result - try all possible ID formats
                question_result = None
                for qr in question_results:
                    qr_id = qr.get("questionId") or qr.get("question_id") or qr.get("id")
                    if qr_id:
                        qr_id_str = str(qr_id).strip().lower()
                        # Try matching any of the possible IDs
                        if qr_id_str in [pid.lower() for pid in possible_ids]:
                            question_result = qr
                            break
                        # Also try numeric index matching (if question_results uses array index)
                        try:
                            if isinstance(qr_id, (int, float)) and int(qr_id) == i:
                                question_result = qr
                                break
                        except:
                            pass
                
                # If not found by ID, try by array index ONLY as last resort
                # WARNING: This is risky - only use if we're sure question_results is ordered correctly
                # and matches the questions array exactly
                if not question_result and i <= len(question_results):
                    # Only use array index if question exists in questions array at this position
                    # This prevents matching wrong questions for Q12-Q19 when question_results is shorter
                    if i <= len(questions):
                        potential_result = question_results[i - 1]
                        # Double-check: try to verify this result doesn't have a mismatched questionId
                        potential_id = potential_result.get("questionId") or potential_result.get("question_id") or potential_result.get("id")
                        # If it has no ID or ID matches, use it
                        if not potential_id:
                            question_result = potential_result
                            logger.debug(f"Q{i}: Using array index {i-1} (no ID in result to verify)")
                        else:
                            # Check if ID matches current question
                            potential_id_str = str(potential_id).strip().lower()
                            if potential_id_str in [pid.lower() for pid in possible_ids]:
                                question_result = potential_result
                                logger.debug(f"Q{i}: Using array index {i-1} (ID verified)")
                            else:
                                logger.warning(f"Q{i}: Skipped array index match - ID mismatch (result ID: {potential_id}, looking for: {possible_ids[:3]})")
                
                if question_result:
                    # CRITICAL: Don't use "or" operator - 0 is a valid points value!
                    points_earned = question_result.get("points")
                    if points_earned is None:
                        points_earned = question_result.get("point")
                    if points_earned is None:
                        points_earned = 0
                    
                    try:
                        points_earned = float(points_earned)
                        if points_earned < 0:
                            points_earned = 0
                        total_points_earned += points_earned
                        students_with_answer += 1
                    except (ValueError, TypeError) as e:
                        logger.debug(f"Q{i}: Invalid points value: {points_earned}, error: {e}")
            
            # Calculate success rate
            # CRITICAL: Calculate success rate relative to ALL students, not just those who answered
            # This gives true percentage of students who succeeded vs total class size
            total_students = len(valid_results)
            
            if max_points > 0 and total_students > 0:
                # Calculate average points for those who answered
                average_points = total_points_earned / students_with_answer if students_with_answer > 0 else 0
                
                # Calculate success rate based on total points earned vs total possible points (for all students)
                # Formula: (total_points_earned / (max_points * total_students)) * 100
                # This gives the percentage of maximum points achieved by the entire class
                total_possible_points = max_points * total_students
                success_rate = min(100, round((total_points_earned / total_possible_points) * 100))
                
                # DETAILED LOGGING for verification
                logger.info(f"Q{i}: {success_rate}% "
                           f"(total_earned: {total_points_earned:.2f}, total_possible: {total_possible_points:.1f}, "
                           f"answered: {students_with_answer}/{total_students}, avg: {average_points:.2f}/{max_points}, "
                           f"formula: ({total_points_earned:.2f}/({max_points}*{total_students}))*100)")
                
                # Warn if we got 100% but it seems suspicious
                if success_rate == 100 and max_points == 1:
                    logger.warning(f"Q{i}: Got 100% with max_points=1 - this might be incorrect! Check question definition.")
                elif success_rate == 100:
                    logger.debug(f"Q{i}: All {total_students} students got full points ({max_points}) - 100% success rate is correct")
                elif average_points > max_points:
                    logger.error(f"Q{i}: ERROR - average_points ({average_points:.2f}) > max_points ({max_points})! "
                               f"This should not happen - check question_results data.")
            elif students_with_answer > 0 and max_points > 0:
                # Fallback: if total_students is 0, use old formula (shouldn't happen)
                average_points = total_points_earned / students_with_answer
                success_rate = min(100, round((average_points / max_points) * 100))
                logger.warning(f"Q{i}: Using fallback formula (total_students=0): {success_rate}%")
            else:
                success_rate = 0
                if students_with_answer == 0:
                    logger.warning(f"Q{i}: 0% - No matching answers found!")
                    if i <= 5 or i >= 11:  # Log details for first 5 and Q11-Q19
                        logger.warning(f"  Looking for IDs: {possible_ids[:3]}")
                        logger.warning(f"  Total valid results: {len(valid_results)}")
                        if valid_results:
                            first_result = valid_results[0]
                            first_qr = first_result.get("question_results") or first_result.get("questionResults")
                            if isinstance(first_qr, str):
                                try:
                                    import json
                                    first_qr = json.loads(first_qr)
                                except:
                                    first_qr = []
                            if first_qr:
                                logger.warning(f"  First result has {len(first_qr)} question_results entries")
                elif max_points <= 0:
                    logger.error(f"Q{i}: Cannot calculate success rate - max_points={max_points} is invalid!")
            
            question_success[f"q{i}_success"] = f"{success_rate}%"
        
        logger.info(f"═══════════════════════════════════════════════════════════")
        logger.info(f"Question success rates calculated: {len(question_success)} questions (1 to {total_questions})")
        logger.info(f"Sample rates (first 5 and last 5):")
        for i in range(1, min(6, total_questions + 1)):
            key = f"q{i}_success"
            if key in question_success:
                logger.info(f"  {key}: {question_success[key]}")
        if total_questions > 10:
            for i in range(max(1, total_questions - 4), total_questions + 1):
                key = f"q{i}_success"
                if key in question_success:
                    logger.info(f"  {key}: {question_success[key]}")
        logger.info(f"═══════════════════════════════════════════════════════════")
        
        return question_success
    
    def _is_answer_correct(self, answer: Any) -> bool:
        """
        Check if an answer value indicates a correct answer
        
        Accepts various truthy values:
        - Boolean: True
        - Numeric: 1, 1.0
        - String: "1", "true", "True", "correct", "Correct", "yes", "Yes"
        
        Args:
            answer: Answer value to check
        
        Returns:
            True if answer is correct, False otherwise
        """
        if answer is None:
            return False
        
        # Boolean
        if isinstance(answer, bool):
            return answer
        
        # Numeric
        if isinstance(answer, (int, float)):
            return answer == 1
        
        # String
        if isinstance(answer, str):
            normalized = answer.lower().strip()
            return normalized in ["1", "true", "correct", "yes", "да"]
        
        return False
    
    # ═══════════════════════════════════════════════════════
    # TEST ANALYTICS CACHE METHODS
    # ═══════════════════════════════════════════════════════
    
    def get_analytics(self, test_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached analytics from test_analytics table
        
        Args:
            test_id: ID of the test
        
        Returns:
            Dictionary with statistics, question_success_rates, and ai_analysis if exists,
            None otherwise
        """
        logger.debug(f"Checking cache for test analytics: {test_id}")
        
        try:
            response = self.client.table("test_analytics").select("*").eq("test_id", test_id).execute()
            
            if response.data and len(response.data) > 0:
                analytics = response.data[0]
                logger.info(f"Found cached analytics for test: {test_id}")
                logger.debug(f"  Calculated at: {analytics.get('calculated_at')}")
                logger.debug(f"  Updated at: {analytics.get('updated_at')}")
                
                # Parse JSONB fields if they're strings
                statistics = analytics.get("statistics", {})
                question_success_rates = analytics.get("question_success_rates", {})
                ai_analysis = analytics.get("ai_analysis")
                
                if isinstance(statistics, str):
                    try:
                        statistics = json.loads(statistics)
                    except:
                        statistics = {}
                
                if isinstance(question_success_rates, str):
                    try:
                        question_success_rates = json.loads(question_success_rates)
                    except:
                        question_success_rates = {}
                
                if isinstance(ai_analysis, str):
                    try:
                        ai_analysis = json.loads(ai_analysis)
                    except:
                        ai_analysis = None
                
                return {
                    "statistics": statistics,
                    "question_success_rates": question_success_rates,
                    "ai_analysis": ai_analysis,
                    "calculated_at": analytics.get("calculated_at"),
                    "updated_at": analytics.get("updated_at")
                }
            
            logger.debug(f"No cached analytics found for test: {test_id}")
            return None
            
        except Exception as e:
            logger.warning(f"Error fetching analytics from cache: {e}")
            return None
    
    def save_analytics(
        self,
        test_id: str,
        statistics: Dict[str, Any],
        question_success_rates: Dict[str, str],
        ai_analysis: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Save analytics to test_analytics table (upsert)
        
        Args:
            test_id: ID of the test
            statistics: Dictionary with calculated statistics
            question_success_rates: Dictionary with q1_success, q2_success, etc.
            ai_analysis: Optional dictionary with AI-generated analysis
        
        Returns:
            True if successful, False otherwise
        """
        logger.info(f"Saving analytics to cache for test: {test_id}")
        
        try:
            # Prepare data for upsert
            analytics_data = {
                "test_id": test_id,
                "statistics": statistics,
                "question_success_rates": question_success_rates,
                "updated_at": get_current_timestamp("iso")
            }
            
            if ai_analysis:
                analytics_data["ai_analysis"] = ai_analysis
                analytics_data["ai_generated_at"] = get_current_timestamp("iso")
            
            # Upsert (insert or update)
            response = self.client.table("test_analytics").upsert(analytics_data).execute()
            
            logger.info(f"Analytics saved to cache for test: {test_id}")
            logger.debug(f"  Statistics keys: {len(statistics)}")
            logger.debug(f"  Question success rates: {len(question_success_rates)}")
            if ai_analysis:
                logger.debug(f"  AI analysis sections: {len(ai_analysis)}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving analytics to cache: {e}")
            return False
    
    def invalidate_analytics(self, test_id: str) -> bool:
        """
        Delete cached analytics for a test (cache invalidation)
        
        Args:
            test_id: ID of the test
        
        Returns:
            True if successful, False otherwise
        """
        logger.info(f"Invalidating analytics cache for test: {test_id}")
        
        try:
            response = self.client.table("test_analytics").delete().eq("test_id", test_id).execute()
            
            logger.info(f"Analytics cache invalidated for test: {test_id}")
            return True
            
        except Exception as e:
            logger.warning(f"Error invalidating analytics cache: {e}")
            return False
    
    def recalculate_and_save_analytics(
        self,
        test_id: str,
        class_id: str,
        teacher_name: Optional[str] = None,
        force_recalculate: bool = False
    ) -> Dict[str, Any]:
        """
        Recalculate and save analytics to cache
        
        Args:
            test_id: ID of the test
            class_id: ID of the class
            teacher_name: Optional teacher name
            force_recalculate: If True, always recalculate even if cache exists
        
        Returns:
            Dictionary with complete test data (same as get_test_analysis_data)
        """
        logger.info(f"Recalculating analytics for test: {test_id}, force={force_recalculate}")
        
        # Invalidate cache if force recalculate
        if force_recalculate:
            self.invalidate_analytics(test_id)
        
        # Fetch fresh data and calculate (this will also save to cache)
        test_data = self.get_test_analysis_data(test_id, class_id, teacher_name)
        
        # Extract statistics and question success rates from test_data
        statistics = {}
        question_success_rates = {}
        
        # Copy all stats except question success rates
        for key, value in test_data.items():
            if key.startswith('q') and key.endswith('_success'):
                question_success_rates[key] = value
            elif key not in ['test_id', 'test_name', 'class_id', 'class_name', 
                            'subject', 'teacher_name', 'students', 'results', 'test',
                            'total_questions', 'mc_questions', 'short_questions', 'max_points_test']:
                statistics[key] = value
        
        # Save to cache
        self.save_analytics(test_id, statistics, question_success_rates)
        
        logger.info(f"Analytics recalculated and saved to cache for test: {test_id}")
        return test_data
    
    # ═══════════════════════════════════════════════════════
    # SUPABASE STORAGE METHODS FOR TEMPLATES
    # ═══════════════════════════════════════════════════════
    
    def _ensure_bucket_exists(self, bucket_name: str = "templates") -> bool:
        """
        Ensure the specified bucket exists in Supabase Storage
        
        Args:
            bucket_name: Name of the bucket to check/create
        
        Returns:
            True if bucket exists or was created, False otherwise
        """
        try:
            # List all buckets
            buckets = self.client.storage.list_buckets()
            
            # Check if bucket exists
            bucket_exists = any(bucket.name == bucket_name for bucket in buckets)
            
            if bucket_exists:
                logger.debug(f"Bucket '{bucket_name}' already exists")
                return True
            
            # Create bucket if it doesn't exist
            logger.info(f"Creating bucket '{bucket_name}' in Supabase Storage...")
            self.client.storage.create_bucket(bucket_name, public=False)
            logger.info(f"Bucket '{bucket_name}' created successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error ensuring bucket exists: {e}")
            return False
    
    def upload_template(self, file_content: bytes, filename: str, bucket_name: str = "templates") -> bool:
        """
        Upload a template file to Supabase Storage
        
        Args:
            file_content: Binary content of the file
            filename: Name of the file
            bucket_name: Name of the storage bucket (default: "templates")
        
        Returns:
            True if successful, False otherwise
        
        Raises:
            SupabaseConnectionError: If upload fails
        """
        try:
            # Ensure bucket exists
            if not self._ensure_bucket_exists(bucket_name):
                raise SupabaseConnectionError(f"Failed to ensure bucket '{bucket_name}' exists")
            
            # Upload file
            self.client.storage.from_(bucket_name).upload(filename, file_content, file_options={"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"})
            
            logger.info(f"Template uploaded to Storage: {filename}")
            return True
            
        except Exception as e:
            error_msg = f"Failed to upload template to Storage: {e}"
            logger.error(error_msg)
            raise SupabaseConnectionError(error_msg)
    
    def download_template(self, filename: str, bucket_name: str = "templates") -> bytes:
        """
        Download a template file from Supabase Storage
        
        Args:
            filename: Name of the file to download
            bucket_name: Name of the storage bucket (default: "templates")
        
        Returns:
            Binary content of the file
        
        Raises:
            SupabaseConnectionError: If download fails
        """
        try:
            # Ensure bucket exists
            if not self._ensure_bucket_exists(bucket_name):
                raise SupabaseConnectionError(f"Failed to ensure bucket '{bucket_name}' exists")
            
            # Download file
            response = self.client.storage.from_(bucket_name).download(filename)
            
            logger.info(f"Template downloaded from Storage: {filename}")
            return response
            
        except Exception as e:
            error_msg = f"Failed to download template from Storage: {e}"
            logger.error(error_msg)
            raise SupabaseConnectionError(error_msg)
    
    def list_templates(self, bucket_name: str = "templates") -> List[Dict[str, Any]]:
        """
        List all template files in Supabase Storage
        
        Args:
            bucket_name: Name of the storage bucket (default: "templates")
        
        Returns:
            List of dictionaries with template information (name, size, etc.)
        """
        try:
            # Ensure bucket exists
            if not self._ensure_bucket_exists(bucket_name):
                logger.warning(f"Bucket '{bucket_name}' does not exist")
                return []
            
            # List files in bucket
            files = self.client.storage.from_(bucket_name).list()
            
            # Filter for .docx files and format response
            templates = []
            for file_info in files:
                if file_info.get('name', '').lower().endswith('.docx'):
                    # Parse file info - handle different response formats
                    template_info = {
                        'name': file_info.get('name', ''),
                        'size': file_info.get('size') or file_info.get('file_size', 0),
                        'updated_at': file_info.get('updated_at') or file_info.get('updatedAt'),
                        'created_at': file_info.get('created_at') or file_info.get('createdAt'),
                    }
                    templates.append(template_info)
            
            logger.info(f"Found {len(templates)} templates in Storage")
            return templates
            
        except Exception as e:
            logger.error(f"Error listing templates from Storage: {e}")
            return []
    
    def delete_template(self, filename: str, bucket_name: str = "templates") -> bool:
        """
        Delete a template file from Supabase Storage
        
        Args:
            filename: Name of the file to delete
            bucket_name: Name of the storage bucket (default: "templates")
        
        Returns:
            True if successful, False otherwise
        
        Raises:
            SupabaseConnectionError: If deletion fails
        """
        try:
            # Ensure bucket exists
            if not self._ensure_bucket_exists(bucket_name):
                raise SupabaseConnectionError(f"Bucket '{bucket_name}' does not exist")
            
            # Delete file
            # Try different method signatures for robustness
            try:
                self.client.storage.from_(bucket_name).remove([filename])
            except TypeError:
                # Fallback if remove expects different format
                self.client.storage.from_(bucket_name).remove(filename)
            
            logger.info(f"Template deleted from Storage: {filename}")
            return True
            
        except Exception as e:
            error_msg = f"Failed to delete template from Storage: {e}"
            logger.error(error_msg)
            raise SupabaseConnectionError(error_msg)
    
    def template_exists(self, filename: str, bucket_name: str = "templates") -> bool:
        """
        Check if a template file exists in Supabase Storage
        
        Args:
            filename: Name of the file to check
            bucket_name: Name of the storage bucket (default: "templates")
        
        Returns:
            True if file exists, False otherwise
        """
        try:
            # Ensure bucket exists
            if not self._ensure_bucket_exists(bucket_name):
                return False
            
            # List files and check if filename exists
            files = self.client.storage.from_(bucket_name).list()
            
            for file_info in files:
                if file_info.get('name') == filename:
                    return True
            
            return False
            
        except Exception as e:
            logger.warning(f"Error checking if template exists: {e}")
            return False


# Create singleton instance
_supabase_service: Optional[SupabaseService] = None

def get_supabase_service(results_table_name: Optional[str] = None) -> SupabaseService:
    """
    Get or create Supabase service instance (singleton pattern)
    
    Args:
        results_table_name: Optional custom table name for test results
    
    Returns:
        SupabaseService instance
    """
    global _supabase_service
    if _supabase_service is None:
        logger.info("Creating new Supabase service instance")
        _supabase_service = SupabaseService(results_table_name=results_table_name)
    return _supabase_service