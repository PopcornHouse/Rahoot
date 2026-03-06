"use client"

import { GAME_RESET, GAME_STATUS } from "@rahoot/common/eventConstants"
import {
  MANAGER_ABORT_QUIZ,
  MANAGER_NEXT_QUESTION,
  MANAGER_RECONNECT,
  MANAGER_SHOW_LEADERBOARD,
  MANAGER_START_GAME,
  MANAGER_SUCCESS_RECONNECT,
} from "@rahoot/common/managerConstants"
import { STATUS } from "@rahoot/common/types/game/status"
import GameWrapper from "@rahoot/web/components/game/GameWrapper"
import Answers from "@rahoot/web/components/game/states/Answers"
import Leaderboard from "@rahoot/web/components/game/states/Leaderboard"
import Podium from "@rahoot/web/components/game/states/Podium"
import Prepared from "@rahoot/web/components/game/states/Prepared"
import Question from "@rahoot/web/components/game/states/Question"
import Responses from "@rahoot/web/components/game/states/Responses"
import Room from "@rahoot/web/components/game/states/Room"
import Start from "@rahoot/web/components/game/states/Start"
import { useEvent, useSocket } from "@rahoot/web/contexts/socketProvider"
import { useManagerStore } from "@rahoot/web/stores/manager"
import { useQuestionStore } from "@rahoot/web/stores/question"
import { GAME_STATE_COMPONENTS_MANAGER } from "@rahoot/web/utils/constants"
import { useParams, useRouter } from "next/navigation"
import toast from "react-hot-toast"

const ManagerGame = () => {
  const router = useRouter()
  const { gameId: gameIdParam }: { gameId?: string } = useParams()
  const { socket } = useSocket()
  const { gameId, status, setGameId, setStatus, setPlayers, reset } =
    useManagerStore()
  const { setQuestionStates } = useQuestionStore()

  useEvent(GAME_STATUS, ({ name, data }) => {
    if (name in GAME_STATE_COMPONENTS_MANAGER) {
      setStatus(name, data)
    }
  })

  useEvent("connect", () => {
    if (gameIdParam) {
      socket?.emit(MANAGER_RECONNECT, { gameId: gameIdParam })
    }
  })

  useEvent(
    MANAGER_SUCCESS_RECONNECT,
    ({ gameId, status, players, currentQuestion }) => {
      setGameId(gameId)
      setStatus(status.name, status.data)
      setPlayers(players)
      setQuestionStates(currentQuestion)
    },
  )

  useEvent(GAME_RESET, (message) => {
    router.replace("/manager")
    reset()
    setQuestionStates(null)
    toast.error(message)
  })

  const handleSkip = () => {
    if (!gameId) {
      return
    }

    switch (status?.name) {
      case STATUS.SHOW_ROOM:
        socket?.emit(MANAGER_START_GAME, { gameId })

        break

      case STATUS.SELECT_ANSWER:
        socket?.emit(MANAGER_ABORT_QUIZ, { gameId })

        break

      case STATUS.SHOW_RESPONSES:
        socket?.emit(MANAGER_SHOW_LEADERBOARD, { gameId })

        break

      case STATUS.SHOW_LEADERBOARD:
        socket?.emit(MANAGER_NEXT_QUESTION, { gameId })

        break
    }
  }

  let component = null

  switch (status?.name) {
    case STATUS.SHOW_ROOM:
      component = <Room data={status.data} />

      break

    case STATUS.SHOW_START:
      component = <Start data={status.data} />

      break

    case STATUS.SHOW_PREPARED:
      component = <Prepared data={status.data} />

      break

    case STATUS.SHOW_QUESTION:
      status.data.hideClientQuestion = false
      component = <Question data={status.data} />

      break

    case STATUS.SELECT_ANSWER:
      status.data.hideClientQuestion = false
      component = <Answers data={status.data} />

      break

    case STATUS.SHOW_RESPONSES:
      component = <Responses data={status.data} />

      break

    case STATUS.SHOW_LEADERBOARD:
      component = <Leaderboard data={status.data} />

      break

    case STATUS.FINISHED:
      component = <Podium data={status.data} />

      break
  }

  return (
    <GameWrapper statusName={status?.name} onNext={handleSkip} manager>
      {component}
    </GameWrapper>
  )
}

export default ManagerGame
