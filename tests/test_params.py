"""Parameter ranges (``core.params``) and the CLI param plumbing built on them.

Tests that must hold for *any* strategy are parametrized over
``strategies.discover_strategies()`` rather than naming one strategy, so a
new strategy dropped into strategies/ is covered automatically.
"""

from __future__ import annotations

import argparse

import pytest

from core.params import Int, parse_param_value, resolve_params, resolve_space
from strategies import discover_strategies
from strategies.base import Strategy

PARAMETERIZED_STRATEGIES = {
    name: cls for name, cls in discover_strategies().items()
    if getattr(cls, 'params', None)
}


@pytest.mark.parametrize('name', sorted(PARAMETERIZED_STRATEGIES))
def test_resolve_space_covers_every_declared_param(name):
    cls = PARAMETERIZED_STRATEGIES[name]
    space = resolve_space(cls)
    fixed = set(getattr(cls, 'fixed_params', ()) or ())
    assert space  # every bundled strategy with params should yield a non-empty range set
    for key in space:
        assert key in cls.params
        assert key not in fixed


def test_resolve_space_infers_when_undeclared():
    class _Undeclared(Strategy):
        params = {'period': 20, 'threshold': 0.5}

    space = resolve_space(_Undeclared)
    assert set(space) == {'period', 'threshold'}


def test_resolve_space_prefers_the_declared_range():
    class _S(Strategy):
        params = {'period': 20}
        space = {'period': Int(5, 50)}

    assert resolve_space(_S)['period'] == Int(5, 50)


def test_resolve_space_rejects_a_class_with_no_ranges():
    class _Empty(Strategy):
        params = {}

    with pytest.raises(ValueError):
        resolve_space(_Empty)


def test_resolve_params_precedence():
    """--param beats --lots beats the class defaults."""
    from strategies.double_ma import DoubleMaStrategy

    args = argparse.Namespace(lots=7, param=['fast_period=3'])
    assert resolve_params(DoubleMaStrategy, args) == {'fast_period': 3, 'lots': 7}

    args = argparse.Namespace(lots=7, param=['lots=2'])
    assert resolve_params(DoubleMaStrategy, args) == {'lots': 2}

    # No flags at all -> no overrides, so the class defaults stand untouched.
    args = argparse.Namespace(lots=None, param=None)
    assert resolve_params(DoubleMaStrategy, args) == {}


def test_parse_param_value_casts_int_float_bool_then_str():
    assert parse_param_value('n=5') == ('n', 5)
    assert parse_param_value('r=0.5') == ('r', 0.5)
    assert parse_param_value('flag=true') == ('flag', True)
    assert parse_param_value('mode=trend') == ('mode', 'trend')
    with pytest.raises(ValueError):
        parse_param_value('nope')


def test_packaged_modules_do_not_import_top_level_scripts():
    """``pyproject.toml`` ships ``core``/``datafeed``/``strategies``/... as
    packages and leaves ``main.py`` and ``plotting.py`` at the repo root,
    uninstalled. A packaged module importing one of those used to produce a
    ``pip install .`` tree that raised ``ModuleNotFoundError`` the first time
    it was used.
    """
    import ast
    import pathlib

    root = pathlib.Path(__file__).resolve().parent.parent
    packaged = ('core', 'datafeed', 'strategies', 'indicators', 'web')
    top_level = {p.stem for p in root.glob('*.py')}
    assert {'main', 'plotting'} <= top_level      # guard the premise

    offenders = []
    for package in packaged:
        for path in (root / package).rglob('*.py'):
            tree = ast.parse(path.read_text(encoding='utf-8'))
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.level == 0:
                    names = [(node.module or '').split('.')[0]]
                elif isinstance(node, ast.Import):
                    names = [a.name.split('.')[0] for a in node.names]
                else:
                    continue
                offenders += [
                    f'{path.relative_to(root)}: {name}'
                    for name in names if name in top_level
                ]
    assert not offenders, f'packaged modules importing unpackaged scripts: {offenders}'
