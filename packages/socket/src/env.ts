import { createEnv } from "@t3-oss/env-core"
import { z } from "zod/v4"

const env = createEnv({
  server: {
    WEB_ORIGIN: z.string().optional().default("http://localhost:3000"),
    SOCKER_PORT: z.string().optional().default("3001"),
    SOCKET_CORS_ORIGIN: z.string().default("*")
  },

  runtimeEnv: {
    WEB_ORIGIN: process.env.WEB_ORIGIN,
    SOCKER_PORT: process.env.SOCKER_PORT,
    SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN
  },
})

export default env
