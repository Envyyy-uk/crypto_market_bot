"""
Тести валідації сповіщень (Завдання 14, частина Завдання 25).
"""

import pytest
from fastapi import HTTPException

from app.routers.alerts import validate_alert


class TestAlertValidation:
    def test_valid_price_alert(self):
        validate_alert("BTCUSDT", "price_above", "70000")  # не кидає

    def test_valid_rsi_alert(self):
        validate_alert("BTCUSDT", "rsi_below", "30")

    def test_valid_signal_alert(self):
        validate_alert("BTCUSDT", "signal_change", "Strong Buy")

    def test_unknown_symbol_rejected(self):
        with pytest.raises(HTTPException) as e:
            validate_alert("NOTACOIN", "price_above", "100")
        assert e.value.status_code == 400

    def test_unknown_condition_rejected(self):
        with pytest.raises(HTTPException):
            validate_alert("BTCUSDT", "moon_phase", "full")

    def test_price_must_be_number(self):
        with pytest.raises(HTTPException):
            validate_alert("BTCUSDT", "price_above", "seventy thousand")

    def test_price_must_be_positive(self):
        with pytest.raises(HTTPException):
            validate_alert("BTCUSDT", "price_above", "-5")

    def test_rsi_range_enforced(self):
        with pytest.raises(HTTPException):
            validate_alert("BTCUSDT", "rsi_below", "150")
        with pytest.raises(HTTPException):
            validate_alert("BTCUSDT", "rsi_above", "-1")

    def test_signal_value_must_be_known(self):
        with pytest.raises(HTTPException):
            validate_alert("BTCUSDT", "signal_change", "To The Moon")
