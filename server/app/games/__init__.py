from .base import Game, GameError, Results
from .dots import Dots
from .tictactoe import TicTacToe
from .uno import Uno
from .seabattle import SeaBattle
from .quickdraw import QuickDraw
from .ludo import Ludo
from .mogul import Mogul

REGISTRY: dict[str, type[Game]] = {g.id: g for g in (
    TicTacToe, Uno, Dots, SeaBattle, QuickDraw, Ludo, Mogul)}

__all__ = ["Game", "GameError", "Results", "REGISTRY"]
