"""Average True Range (example indicator)."""

import talib

from .base import Indicator, Int, Output


class Atr(Indicator):
    """ATR: the average true range over ``period`` bars, in price units.

    Its own pane, and deliberately *not* range-bounded: ATR is read as a
    level against its own history ("volatility is high for this product right
    now"), so the axis should follow the data.
    """

    label = 'ATR'
    pane = 'sub'
    precision = 2
    params = {'period': 14}
    space = {'period': Int(2, 100)}
    outputs = (Output('atr', label='ATR', color=7),)

    def compute(self, ctx, sym):
        return {
            'atr': talib.ATR(
                ctx.high(sym), ctx.low(sym), ctx.close(sym), self.p['period'],
            )
        }
