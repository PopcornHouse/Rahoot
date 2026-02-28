"use client"

import { GAME_ERROR_MESSAGE } from "@rahoot/common/eventConstants"
import Room from "@rahoot/web/components/game/join/Room"
import Username from "@rahoot/web/components/game/join/Username"
import { useEvent, useSocket } from "@rahoot/web/contexts/socketProvider"
import { usePlayerStore } from "@rahoot/web/stores/player"
import { useEffect } from "react"
import toast from "react-hot-toast"

const Home = () => {
  const { isConnected, connect } = useSocket()
  const { player } = usePlayerStore()

  useEffect(() => {
    if (!isConnected) {
      connect()
    }
  }, [connect, isConnected])

  useEvent(GAME_ERROR_MESSAGE, (message) => {
    toast.error(message)
  })

  if (player) {
    return <Username />
  }

  return <Room />
}

export default Home
