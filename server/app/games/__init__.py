from .base import Game, GameError, Results
from .dots import Dots
from .tictactoe import TicTacToe
from .uno import Uno
from .seabattle import SeaBattle
from .quickdraw import QuickDraw
from .ludo import Ludo

REGISTRY: dict[str, type[Game]] = {g.id: g for g in (
    TicTacToe, Uno, Dots, SeaBattle, QuickDraw, Ludo)}

__all__ = ["Game", "GameError", "Results", "REGISTRY"]
