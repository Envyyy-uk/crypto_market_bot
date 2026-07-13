from pydantic import BaseModel, Field


class MarketTicker(BaseModel):
    """Одна криптовалютна пара — відповідає прикладу з ТЗ (Завдання 3)."""

    symbol: str = Field(..., examples=["BTCUSDT"])
    price: float
    change24h: float  # у відсотках, напр. 2.45
    high24h: float
    low24h: float
    volume24h: float


class Candle(BaseModel):
    """Одна OHLCV-свічка (Завдання 5)."""

    time: int = Field(..., description="Час відкриття свічки, unix ms")
    open: float
    high: float
    low: float
    close: float
    volume: float
