"""Exponential moving averages (example indicator)."""

import talib

from .base import Indicator, Int, Output


class Ema(Indicator):
    """Fast and slow exponential moving averages over the close.

    Same reading as :class:`~indicators.ma.Ma`, weighted towards recent bars:
    an EMA turns sooner than an SMA of the same period, at the cost of
    reacting to noise the SMA would have smoothed away.
    """

    label = 'EMA'
    pane = 'main'
    precision = 2
    params = {'fast': 12, 'slow': 26}
    space = {'fast': Int(2, 60), 'slow': Int(5, 250)}
    constraints = (lambda p: p['fast'] < p['slow'],)
    outputs = (
        Output('fast', color=1),
        Output('slow', color=4),
    )

    def compute(self, ctx, sym):
        close = ctx.close(sym)
        return {
            'fast': talib.EMA(close, self.p['fast']),
            'slow': talib.EMA(close, self.p['slow']),
        }
