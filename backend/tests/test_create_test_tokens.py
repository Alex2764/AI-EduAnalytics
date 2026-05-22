"""Unit tests for test token generation when creating tests."""

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.supabase_service import SupabaseService  # noqa: E402


def test_group_numbers_single_group():
    assert SupabaseService._group_numbers_for_test(False) == [1]


def test_group_numbers_two_groups():
    assert SupabaseService._group_numbers_for_test(True) == [1, 2]


def test_generate_access_token_is_uuid_like():
    token = SupabaseService._generate_access_token()
    assert len(token) == 36
    assert token.count("-") == 4
