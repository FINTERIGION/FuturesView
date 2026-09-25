"""Declarative parameter ranges, and the helpers that read them.

Deliberately stdlib-only so ``strategies/`` and ``indicators/`` can import it
freely. A ``Strategy`` or ``Indicator`` subclass declares the range each param
is plausible over with a class-level
``space: dict[str, Int | Float | Categorical]`` alongside its ``params``
defaults. The web panel lists those ranges in its catalogs and refuses an
indicator param override from a URL that falls outside them.

Priority, highest first: the class's declared ``space`` > a heuristic inferred
from its ``params`` defaults. Nothing here knows about any concrete class --
``resolve_space`` works off ``params`` / ``space`` / ``fixed_params`` alone, so
it applies unchanged to anything ``strategies.discover_strategies()`` or the
indicator registry finds.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional, Tuple, Union

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Int:
    low: int
    high: int
    step: int = 1
    log: bool = False


@dataclass(frozen=True)
class Float:
    low: float
    high: float
    step: float | None = None
    log: bool = False


@dataclass(frozen=True)
class Categorical:
    choices: Tuple[object, ...]

    def __init__(self, choices):
        object.__setattr__(self, 'choices', tuple(choices))


Spec = Union[Int, Float, Categorical]


def spec_to_json(spec: Spec) -> dict:
    """Render one range spec as a JSON-safe dict.

    Shared by the web panel's strategy and indicator catalogs, so every place a
    parameter surface is shown describes it identically.
    """
    if isinstance(spec, Int):
        return {'kind': 'int', 'low': spec.low, 'high': spec.high, 'step': spec.step, 'log': spec.log}
    if isinstance(spec, Float):
        return {'kind': 'float', 'low': spec.low, 'high': spec.high, 'step': spec.step, 'log': spec.log}
    if isinstance(spec, Categorical):
        return {'kind': 'categorical', 'choices': list(spec.choices)}
    raise TypeError(f'Unknown space spec: {spec!r}')


def _infer_spec(value) -> Optional[Spec]:
    """Heuristic range for a param that declared no ``space`` entry.

    Deliberately crude (``value / 4 .. value * 4``-ish) -- it exists so a class
    that declared nothing still has some bound, not to be a good default for
    every parameter.
    """
    if isinstance(value, bool):
        return Categorical((True, False))
    if isinstance(value, int):
        if value <= 0:
            return None
        return Int(max(1, value // 4), max(value * 4, value + 2))
    if isinstance(value, float):
        if value == 0:
            return None
        magnitude = abs(value)
        return Float(magnitude / 4, magnitude * 4, log=True)
    return None


def resolve_space(cls: type) -> dict:
    """Return ``{param_name: Spec}`` for ``cls``."""
    fixed = set(getattr(cls, 'fixed_params', ()) or ())
    declared = dict(getattr(cls, 'space', {}) or {})
    defaults = dict(getattr(cls, 'params', {}) or {})

    space: dict = {}
    inferred = {}
    for name, default in defaults.items():
        if name in declared:
            space[name] = declared[name]
        elif name in fixed:
            continue
        else:
            spec = _infer_spec(default)
            if spec is not None:
                space[name] = spec
                inferred[name] = spec

    if inferred:
        logger.debug(
            "%s: no `space` declared for %s -- inferred %s from defaults.",
            cls.__name__, ', '.join(sorted(inferred)), inferred,
        )

    if not space:
        raise ValueError(
            f"{cls.__name__} has no parameter ranges: `params` is "
            f"empty, or every key is in `fixed_params` with no `space`."
        )
    return space


def check_constraints(cls: type, params: dict) -> bool:
    """True iff every ``cls.constraints`` predicate accepts ``params``."""
    return all(fn(params) for fn in (getattr(cls, 'constraints', ()) or ()))


# ---------------------------------------------------------------------
# Concrete parameter *values* (as opposed to the ranges above)
# ---------------------------------------------------------------------

def parse_param_value(raw: str) -> tuple:
    """Parse one ``--param name=value`` CLI token into ``(name, value)``,
    casting the value to int, then float, then bool, else leaving it a string.
    """
    if '=' not in raw:
        raise ValueError(f"Invalid --param {raw!r}; expected name=value")
    name, value = raw.split('=', 1)
    for caster in (int, float):
        try:
            return name, caster(value)
        except ValueError:
            continue
    if value.lower() in ('true', 'false'):
        return name, value.lower() == 'true'
    return name, value


def resolve_params(strategy_cls: type, args) -> dict:
    """Build the ``strategy_cls(**overrides)`` dict from the CLI: ``--lots``,
    then ``--param`` on top. Only what the user actually asked to change is
    returned -- ``Strategy.__init__`` merges the class's own ``params``
    defaults under it -- so an untouched run behaves exactly as before.
    """
    params: dict = {}
    if getattr(args, 'lots', None) is not None:
        params['lots'] = args.lots
    for raw in getattr(args, 'param', None) or []:
        name, value = parse_param_value(raw)
        params[name] = value

    known = set(getattr(strategy_cls, 'params', {}) or {})
    unknown = sorted(set(params) - known)
    if unknown:
        # Not fatal: `Strategy.__init__` merges anything into `self.p`, and
        # `--lots` is documented as harmless for strategies that ignore it.
        # But a typo would otherwise vanish without a trace, so say so.
        logger.warning(
            '%s declares no param(s) %s -- passing them through, but the strategy '
            'will not read them (declared params: %s).',
            strategy_cls.__name__, unknown, sorted(known) or '<none>',
        )
    return params
