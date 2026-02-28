import {
  GAME_CREATE,
  GAME_ERROR_MESSAGE,
  GAME_RESET,
  GAME_SUCCESS_ROOM,
  GAME_TOTAL_PLAYERS
} from "@rahoot/common/eventConstants"
import { Server } from "@rahoot/common/types/game/socket"
import { inviteCodeValidator } from "@rahoot/common/validators/auth"
import env from "@rahoot/socket/env"
import Config from "@rahoot/socket/services/config"
import Game from "@rahoot/socket/services/game"
import Registry from "@rahoot/socket/services/registry"
import { withGame } from "@rahoot/socket/utils/game"
import { Server as ServerIO } from "socket.io"

const io: Server = new ServerIO({
  cors: {
    origin: [env.WEB_ORIGIN],
  },
})
Config.init()

const registry = Registry.getInstance()
const port = 3001

console.log(`Socket server running on port ${port}`)
io.listen(Number(port))

io.on("connection", (socket) => {
  console.log(
    `A user connected: socketId: ${socket.id}, clientId: ${socket.handshake.auth.clientId}`,
  )

  socket.on("player:reconnect", ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, socket.handshake.auth.clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(GAME_RESET, "Game not found")
  })

  socket.on("manager:reconnect", ({ gameId }) => {
    const game = registry.getManagerGame(gameId, socket.handshake.auth.clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(GAME_RESET, "Game expired")
  })

  socket.on("manager:auth", (password) => {
    try {
      const config = Config.game()

      if (password !== config.managerPassword) {
        socket.emit("manager:errorMessage", "Invalid password")

        return
      }

      socket.emit("manager:quizzList", Config.quizz())
    } catch (error) {
      console.error("Failed to read game config:", error)
      socket.emit("manager:errorMessage", "Failed to read game config")
    }
  })

  socket.on(GAME_CREATE, (quizzId) => {
    const quizzList = Config.quizz()
    const quizz = quizzList.find((q) => q.id === quizzId)

    if (!quizz) {
      socket.emit(GAME_ERROR_MESSAGE, "Quizz not found")

      return
    }

    const game = new Game(io, socket, quizz)
    registry.addGame(game)
  })

  socket.on("player:join", (inviteCode) => {
    const result = inviteCodeValidator.safeParse(inviteCode)

    if (result.error) {
      socket.emit(GAME_ERROR_MESSAGE, result.error.issues[0].message)

      return
    }

    const game = registry.getGameByInviteCode(inviteCode)

    if (!game) {
      socket.emit(GAME_ERROR_MESSAGE, "Game not found")

      return
    }

    socket.emit(GAME_SUCCESS_ROOM, game.gameId)
  })

  socket.on("player:login", ({ gameId, data }) =>
    withGame(gameId, socket, (game) => game.join(socket, data.username)),
  )

  socket.on("manager:kickPlayer", ({ gameId, playerId }) =>
    withGame(gameId, socket, (game) => game.kickPlayer(socket, playerId)),
  )

  socket.on("manager:startGame", ({ gameId }) =>
    withGame(gameId, socket, (game) => game.start(socket)),
  )

  socket.on("player:selectedAnswer", ({ gameId, data }) =>
    withGame(gameId, socket, (game) =>
      game.selectAnswer(socket, data.answerKey),
    ),
  )

  socket.on("manager:abortQuiz", ({ gameId }) =>
    withGame(gameId, socket, (game) => game.abortRound(socket)),
  )

  socket.on("manager:nextQuestion", ({ gameId }) =>
    withGame(gameId, socket, (game) => game.nextRound(socket)),
  )

  socket.on("manager:showLeaderboard", ({ gameId }) =>
    withGame(gameId, socket, (game) => game.showLeaderboard()),
  )

  socket.on("disconnect", () => {
    console.log(`A user disconnected : ${socket.id}`)

    const managerGame = registry.getGameByManagerSocketId(socket.id)

    if (managerGame) {
      managerGame.manager.connected = false
      registry.markGameAsEmpty(managerGame)

      if (!managerGame.started) {
        console.log("Reset game (manager disconnected)")
        managerGame.abortCooldown()
        io.to(managerGame.gameId).emit(GAME_RESET, "Manager disconnected")
        registry.removeGame(managerGame.gameId)

        return
      }
    }

    const game = registry.getGameByPlayerSocketId(socket.id)

    if (!game) {
      return
    }

    const player = game.players.find((p) => p.id === socket.id)

    if (!player) {
      return
    }

    if (!game.started) {
      game.players = game.players.filter((p) => p.id !== socket.id)

      io.to(game.manager.id).emit("manager:removePlayer", player.id)
      io.to(game.gameId).emit(GAME_TOTAL_PLAYERS, game.players.length)

      console.log(`Removed player ${player.username} from game ${game.gameId}`)

      return
    }

    player.connected = false
    io.to(game.gameId).emit(GAME_TOTAL_PLAYERS, game.players.length)
  })
})

process.on("SIGINT", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})

process.on("SIGTERM", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})
