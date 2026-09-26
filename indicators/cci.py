"""Commodity Channel Index (example indicator)."""

import talib

from .base import Indicator, Int, Output


class Cci(Indicator):
    """CCI: the typical price's distance from its mean, in units of mean
    deviation.

    Unbounded by construction -- Lambert's 0.015 constant only puts *most*
    readings inside +/-100 -- so the axis autoscales and the two guides mark
    the conventional overbought/oversold lines.
    """

    label = 'CCI'
    pane = 'sub'
    precision = 1
    guides = (-100, 100)
    params = {'period': 14}
    space = {'period': Int(5, 100)}
    outputs = (Output('cci', label='CCI', color=6),)

    def compute(self, ctx, sym):
        return {
            'cci': talib.CCI(ctx.high(sym), ctx.low(sym), ctx.close(sym), self.p['period'])
        }
