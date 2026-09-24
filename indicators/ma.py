"""Simple moving averages (example indicator)."""

import talib

from .base import Indicator, Int, Output


class Ma(Indicator):
    """Three simple moving averages over the close.

    Multi-output rather than one line with a ``period`` param, because a
    moving average is read by comparing fast against slow -- a single line
    would mean selecting this indicator three times, which the picker does not
    offer. Set the three periods to taste.
    """

    label = 'MA'
    pane = 'main'
    precision = 2
    params = {'fast': 5, 'mid': 10, 'slow': 20}
    space = {'fast': Int(2, 60), 'mid': Int(3, 120), 'slow': Int(5, 250)}
    constraints = (lambda p: p['fast'] < p['mid'] < p['slow'],)
    outputs = (
        Output('fast', color=0),
        Output('mid', color=3),
        Output('slow', color=6),
    )

    def compute(self, ctx, sym):
        close = ctx.close(sym)
        return {
            'fast': talib.SMA(close, self.p['fast']),
            'mid': talib.SMA(close, self.p['mid']),
            'slow': talib.SMA(close, self.p['slow']),
        }
