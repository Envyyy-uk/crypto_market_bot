"""
Тести пропонованих рівнів входу/TP/SL (app/analysis/trade_levels.py).
"""

from app.analysis.trade_levels import compute_max_safe_leverage, compute_trade_levels


class TestNeutralAndInvalid:
    def test_neutral_gives_no_levels(self):
        assert compute_trade_levels("Neutral", 100, 2, 90, 110) is None

    def test_zero_price_gives_no_levels(self):
        assert compute_trade_levels("Buy", 0, 2, 90, 110) is None

    def test_zero_atr_gives_no_levels(self):
        assert compute_trade_levels("Buy", 100, 0, 90, 110) is None


class TestLongSetup:
    def test_stop_below_entry_target_above(self):
        levels = compute_trade_levels("Buy", 100, 2, support=None, resistance=None)
        assert levels["direction"] == "long"
        assert levels["entry"] == 100
        assert levels["stopLoss"] < 100
        assert levels["takeProfit"] > 100

    def test_uses_atr_stop_when_no_nearby_support(self):
        # ATR=2, множник 1.5 -> стоп на відстані 3 від ціни
        levels = compute_trade_levels("Buy", 100, 2, support=None, resistance=None)
        assert levels["stopLoss"] == 97.0

    def test_uses_support_when_close_enough(self):
        # support=98, відстань 2 < ATR*1.5*2=6 -> стоп біля support з невеликим буфером
        levels = compute_trade_levels("Strong Buy", 100, 2, support=98, resistance=None)
        assert levels["stopLoss"] < 98
        assert levels["stopLoss"] > 97  # буфер маленький, не зістрибує до ATR-стопу

    def test_ignores_distant_support(self):
        # support=50 занадто далеко (>6 від ціни) -> ігнорується, лишається ATR-стоп
        levels = compute_trade_levels("Buy", 100, 2, support=50, resistance=None)
        assert levels["stopLoss"] == 97.0

    def test_risk_reward_is_two_to_one_by_default(self):
        levels = compute_trade_levels("Buy", 100, 2, support=None, resistance=None)
        assert levels["riskRewardRatio"] == 2.0

    def test_uses_resistance_as_target_when_reasonable(self):
        # ATR-ціль була б 100 + 3*2=106; опір=104 менший і "розумний" -> береться опір
        levels = compute_trade_levels("Buy", 100, 2, support=None, resistance=104)
        assert levels["takeProfit"] == 104

    def test_ignores_resistance_target_with_poor_risk_reward(self):
        # опір=101 занадто близько (R:R=1/3=0.33 < MIN_RISK_REWARD) -> ігнорується,
        # лишається ATR-ціль 106, а не поганий заробіток
        levels = compute_trade_levels("Buy", 100, 2, support=None, resistance=101)
        assert levels["takeProfit"] == 106.0
        assert levels["riskRewardRatio"] >= 1.2


class TestShortSetup:
    def test_stop_above_entry_target_below(self):
        levels = compute_trade_levels("Sell", 100, 2, support=None, resistance=None)
        assert levels["direction"] == "short"
        assert levels["stopLoss"] > 100
        assert levels["takeProfit"] < 100

    def test_uses_resistance_when_close_enough(self):
        levels = compute_trade_levels("Strong Sell", 100, 2, support=None, resistance=102)
        assert levels["stopLoss"] > 102


class TestNote:
    def test_note_present_and_not_a_promise(self):
        levels = compute_trade_levels("Buy", 100, 2, support=None, resistance=None)
        assert "not a guaranteed" in levels["note"]


class TestMaxSafeLeverage:
    def test_long_liquidation_is_beyond_stop_loss(self):
        # ліквідація має бути ДАЛІ за стоп (нижче), інакше стоп ніколи не встигне спрацювати
        result = compute_max_safe_leverage(entry=100, stop_loss=90, direction="long")
        assert result["liquidationPrice"] < 90

    def test_short_liquidation_is_beyond_stop_loss(self):
        result = compute_max_safe_leverage(entry=100, stop_loss=110, direction="short")
        assert result["liquidationPrice"] > 110

    def test_leverage_within_bounds(self):
        result = compute_max_safe_leverage(entry=100, stop_loss=90, direction="long")
        assert 1.0 <= result["maxSafeLeverage"] <= 20.0
        assert result["warning"] is None

    def test_tight_stop_hits_ceiling_not_unbounded(self):
        # дуже вузький стоп -> формула дала б величезне плече, але воно обмежене стелею
        result = compute_max_safe_leverage(entry=100, stop_loss=99.9, direction="long")
        assert result["maxSafeLeverage"] == 20.0

    def test_extremely_wide_stop_floors_to_min_with_warning(self):
        # стоп майже дорівнює ціні входу -> навіть 1x небезпечний, має бути попередження
        result = compute_max_safe_leverage(entry=100, stop_loss=1, direction="long")
        assert result["maxSafeLeverage"] == 1.0
        assert result["warning"] is not None

    def test_zero_distance_gives_none(self):
        assert compute_max_safe_leverage(entry=100, stop_loss=100, direction="long") is None


class TestTradeLevelsIncludesLeverage:
    def test_leverage_field_present_for_directional_signal(self):
        levels = compute_trade_levels("Buy", 100, 2, support=None, resistance=None)
        assert levels["leverage"] is not None
        assert levels["leverage"]["maxSafeLeverage"] >= 1.0
