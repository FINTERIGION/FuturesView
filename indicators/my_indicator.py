"""Template: copy this file, rename the class, and it appears in the panel.

The class name becomes the short key (``MyIndicator`` -> ``my_indicator``),
so name single-word indicators ``Rsi`` / ``Macd`` rather than ``RsiIndicator``
-- a one-word stem keeps the suffix. See docs/indicator.md.
"""

import talib

from .base import Float, Indicator, Int, Output  # noqa: F401 -- Float/Int are here to be used


class MyIndicator(Indicator):
    """One-line description; the panel shows this as the picker's tooltip."""

    # How it is drawn ---------------------------------------------------
    label = 'My Indicator'   # name in the picker
    pane = 'main'            # 'main' draws over the candles; 'sub' gets its own pane
    precision = 2            # decimals in the tooltip
    value_range = None       # (min, max) pins a sub-pane's axis; None autoscales
    guides = ()              # horizontal reference lines on a sub-pane, e.g. (30, 70)

    # One entry per series returned by compute(). `color` takes a palette
    # slot (0-7, theme-aware -- prefer this), a token ('up'/'down'/'muted'/
    # 'axis'), or a literal '#rrggbb'.
    outputs = (
        Output('value', label='Value', color=0, kind='line', style='solid'),
    )

    # Parameters --------------------------------------------------------
    params = {'period': 20}
    # Declare `space`: it is also what bounds a period arriving from the URL,
    # so TA-Lib never sees an absurd window.
    space = {'period': Int(2, 200)}
    constraints = ()

    def compute(self, ctx, sym):
        """Return {output key: full-length array}, aligned with ctx.dates.

        ``ctx`` offers open/high/low/close/settle/volume/oi, the same
        accessors a strategy's ``setup()`` gets. Leading NaN is fine -- the
        chart draws it as the warmup.
        """
        return {'value': talib.SMA(ctx.close(sym), self.p['period'])}
