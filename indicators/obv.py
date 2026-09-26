"""On-Balance Volume (example indicator)."""

import talib

from .base import Indicator, Int, Output


class Obv(Indicator):
    """OBV: the running total of volume, added on up closes and subtracted on
    down closes, with a moving average to read its direction against.

    Its level depends only on where the loaded history starts, so it is read
    for slope and for divergence from price, never as an absolute number.
    """

    label = 'OBV'
    pane = 'sub'
    precision = 0
    params = {'period': 30}
    space = {'period': Int(2, 250)}
    outputs = (
        Output('obv', label='OBV', color=2),
        Output('ma', label='MA', color='muted', style='dashed'),
    )

    def compute(self, ctx, sym):
        obv = talib.OBV(ctx.close(sym), ctx.volume(sym))
        return {'obv': obv, 'ma': talib.SMA(obv, self.p['period'])}
