"""Keltner Channel (example indicator)."""

import talib

from .base import Float, Indicator, Int, Output


class Keltner(Indicator):
    """An EMA of the close with bands ``mult`` ATRs either side.

    The modern (Raschke) form rather than Keltner's original typical-price
    SMA. Coloured bands rather than :class:`~indicators.bollinger.Bollinger`'s
    muted ones, so the two stay distinguishable when both are ticked -- which
    is the usual way to read a squeeze.
    """

    label = 'Keltner'
    pane = 'main'
    precision = 2
    params = {'period': 20, 'atr_period': 10, 'mult': 2.0}
    space = {'period': Int(5, 120), 'atr_period': Int(2, 100), 'mult': Float(0.5, 4.0)}
    outputs = (
        Output('upper', color=6, style='dashed'),
        Output('mid', color=6),
        Output('lower', color=6, style='dashed'),
    )

    def compute(self, ctx, sym):
        high, low, close = ctx.high(sym), ctx.low(sym), ctx.close(sym)
        mid = talib.EMA(close, self.p['period'])
        band = self.p['mult'] * talib.ATR(high, low, close, self.p['atr_period'])
        return {'upper': mid + band, 'mid': mid, 'lower': mid - band}
