"""KDJ stochastic, as Chinese charting software draws it (example indicator)."""

import numpy as np
import talib

from .base import Indicator, Int, Output


def kdj(high, low, close, n: int, m1: int, m2: int):
    """K, D and J arrays; NaN until the first full ``n``-bar window.

    RSV is where the close sits in the ``n``-bar high-low range, 0-100. K and
    D are the recursive ``SMA(X, m, 1)`` of Tongdaxin and friends -- today is
    ``(X + (m-1) * yesterday) / m`` -- seeded at 50, and J = 3K - 2D.

    A window whose high equals its low has no RSV. Past the warmup, K and D
    hold their last value through it rather than inventing a reading.
    """
    hh = talib.MAX(high, n)
    ll = talib.MIN(low, n)
    span = hh - ll
    with np.errstate(invalid='ignore', divide='ignore'):
        rsv = np.where(span > 0, (close - ll) / span * 100.0, np.nan)

    k = np.full(len(close), np.nan)
    d = np.full(len(close), np.nan)
    prev_k = prev_d = 50.0
    started = False
    for i, x in enumerate(rsv):
        if np.isnan(x):
            if started:
                k[i], d[i] = prev_k, prev_d
            continue
        started = True
        prev_k = (x + (m1 - 1) * prev_k) / m1
        prev_d = (prev_k + (m2 - 1) * prev_d) / m2
        k[i], d[i] = prev_k, prev_d
    return k, d, 3.0 * k - 2.0 * d


class Kdj(Indicator):
    """KDJ: a smoothed stochastic with J as its leading, overshooting line.

    Not range-pinned: K and D stay inside 0-100, but J = 3K - 2D routinely
    runs past both ends, and a pinned axis would clip exactly the extremes
    J is read for.
    """

    label = 'KDJ'
    pane = 'sub'
    precision = 1
    guides = (20, 80)
    params = {'n': 9, 'm1': 3, 'm2': 3}
    space = {'n': Int(3, 60), 'm1': Int(1, 20), 'm2': Int(1, 20)}
    outputs = (
        Output('k', label='K', color=0),
        Output('d', label='D', color=1),
        Output('j', label='J', color=5),
    )

    def compute(self, ctx, sym):
        k, d, j = kdj(
            ctx.high(sym), ctx.low(sym), ctx.close(sym),
            self.p['n'], self.p['m1'], self.p['m2'],
        )
        return {'k': k, 'd': d, 'j': j}
