from .base import Game, GameError, Results
from .connect4 import ConnectFour
from .dots import Dots
from .echo import Echo
from .memory import Memory
from .oddone import OddOneOut
from .pong import Pong
from .tictactoe import TicTacToe
from .uno import Uno

REGISTRY: dict[str, type[Game]] = {g.id: g for g in (
    TicTacToe, Uno, Pong, ConnectFour, Dots, Memory, OddOneOut, Echo)}

__all__ = ["Game", "GameError", "Results", "REGISTRY"]
