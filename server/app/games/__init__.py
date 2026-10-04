from .base import Game, GameError, Results
from .connect4 import ConnectFour
from .dots import Dots
from .echo import Echo
from .memory import Memory
from .oddone import OddOneOut
from .pong import Pong
from .tictactoe import TicTacToe
from .uno import Uno
from .seabattle import SeaBattle
from .checkers import Checkers
from .reversi import Reversi
from .cycles import Cycles
from .quickdraw import QuickDraw
from .showdown import Showdown
from .quickmaths import QuickMaths

REGISTRY: dict[str, type[Game]] = {g.id: g for g in (
    TicTacToe, Uno, Pong, ConnectFour, Dots, Memory, OddOneOut, Echo,
    SeaBattle, Checkers, Reversi, Cycles, QuickDraw, Showdown, QuickMaths)}

__all__ = ["Game", "GameError", "Results", "REGISTRY"]
