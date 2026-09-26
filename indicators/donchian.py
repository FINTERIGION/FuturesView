"""Donchian Channel (example indicator)."""

import talib

from .base import Indicator, Int, Output


class Donchian(Indicator):
    """The highest high and lowest low of the last ``period`` bars, and their
    midpoint.

    The window includes the current bar, as most charting software draws it,
    so a close can touch the upper band but never sit above it. A
    turtle-style breakout rule compares against *yesterday's* band, which is
    this line shifted one bar to the right.
    """

    label = 'Donchian'
    pane = 'main'
    precision = 2
    params = {'period': 20}
    space = {'period': Int(5, 250)}
    outputs = (
        Output('upper', color=5),
        Output('mid', color='muted', style='dashed'),
        Output('lower', color=5),
    )

    def compute(self, ctx, sym):
        upper = talib.MAX(ctx.high(sym), self.p['period'])
        lower = talib.MIN(ctx.low(sym), self.p['period'])
        return {'upper': upper, 'mid': (upper + lower) / 2.0, 'lower': lower}
