"""Directional Movement Index with ADX (example indicator)."""

import talib

from .base import Indicator, Int, Output


class Dmi(Indicator):
    """Wilder's DMI: +DI and -DI for direction, ADX for trend strength.

    +DI and -DI take the candle colours, so the side that is on top reads the
    same way the candles do. The guide at 25 is the usual "trending" line
    for ADX.
    """

    label = 'DMI'
    pane = 'sub'
    precision = 1
    value_range = (0, 100)
    guides = (25,)
    params = {'period': 14}
    space = {'period': Int(2, 100)}
    outputs = (
        Output('pdi', label='+DI', color='up'),
        Output('mdi', label='-DI', color='down'),
        Output('adx', label='ADX', color=3),
    )

    def compute(self, ctx, sym):
        high, low, close = ctx.high(sym), ctx.low(sym), ctx.close(sym)
        n = self.p['period']
        return {
            'pdi': talib.PLUS_DI(high, low, close, n),
            'mdi': talib.MINUS_DI(high, low, close, n),
            'adx': talib.ADX(high, low, close, n),
        }
