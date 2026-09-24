"""Moving Average Convergence Divergence (example indicator)."""

import talib

from .base import Indicator, Int, Output


class Macd(Indicator):
    """MACD: the fast/slow EMA spread, its signal line, and their difference.

    Sub-pane rather than main, because the spread oscillates around zero in
    price *units* -- drawn over the candles it would collapse into a flat line
    at the bottom of the price axis.
    """

    label = 'MACD'
    pane = 'sub'
    precision = 3
    guides = (0,)
    params = {'fast': 12, 'slow': 26, 'signal': 9}
    space = {'fast': Int(2, 50), 'slow': Int(5, 200), 'signal': Int(2, 50)}
    constraints = (lambda p: p['fast'] < p['slow'],)
    outputs = (
        Output('macd', color=0),
        Output('signal', color=1, style='dashed'),
        # The histogram is the whole reason to look at MACD rather than the
        # two lines alone, and it is only readable when its sign is coloured.
        Output('hist', kind='bar', color=('up', 'down')),
    )

    def compute(self, ctx, sym):
        macd, signal, hist = talib.MACD(
            ctx.close(sym),
            fastperiod=self.p['fast'],
            slowperiod=self.p['slow'],
            signalperiod=self.p['signal'],
        )
        return {'macd': macd, 'signal': signal, 'hist': hist}
