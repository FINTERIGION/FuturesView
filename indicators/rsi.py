"""Relative Strength Index (example indicator)."""

import talib

from .base import Indicator, Int, Output


class Rsi(Indicator):
    """RSI: where the last ``period`` bars' gains sit against their losses.

    Bounded 0-100 by construction, so ``value_range`` pins the axis rather
    than letting it autoscale -- an RSI that spent a quiet month between 45
    and 55 would otherwise fill the pane and read as violent.
    """

    label = 'RSI'
    pane = 'sub'
    precision = 1
    value_range = (0, 100)
    guides = (30, 70)
    params = {'period': 14}
    space = {'period': Int(2, 100)}
    outputs = (Output('rsi', label='RSI', color=4),)

    def compute(self, ctx, sym):
        return {'rsi': talib.RSI(ctx.close(sym), self.p['period'])}
