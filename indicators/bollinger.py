"""Bollinger Bands (example indicator)."""

import talib

from .base import Float, Indicator, Int, Output


class Bollinger(Indicator):
    """A moving average with bands at +/- ``mult`` standard deviations.

    Drawn on the price pane: all three outputs are in price units, which is
    the point -- the bands are read against where the candles sit inside them.
    """

    label = 'BOLL'
    pane = 'main'
    precision = 2
    params = {'period': 20, 'mult': 2.0}
    space = {'period': Int(5, 120), 'mult': Float(0.5, 4.0)}
    outputs = (
        Output('upper', color='muted', style='dashed'),
        Output('mid', color=2),
        Output('lower', color='muted', style='dashed'),
    )

    def compute(self, ctx, sym):
        upper, mid, lower = talib.BBANDS(
            ctx.close(sym),
            timeperiod=self.p['period'],
            nbdevup=self.p['mult'],
            nbdevdn=self.p['mult'],
        )
        return {'upper': upper, 'mid': mid, 'lower': lower}
