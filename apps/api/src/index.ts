import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { clerkPlugin } from '@clerk/fastify'
import { prisma } from './lib/prisma'
import { cityRoutes } from './routes/city/index'
import { poisRoutes } from './routes/pois/index'
import { whisperRoutes } from './routes/whisper/index'
import { userRoutes } from './routes/user/index'
import { adminRoutes } from './routes/admin/index'
import { errorHandler } from './middleware/errorHandler'

const app = Fastify({ logger: true })

const start = async () => {
  try {
    // CORS — before everything
    await app.register(cors, {
      origin: (origin, callback) => {
        const allowedOrigins = [
          /^https:\/\/.*\.exp\.direct$/,  // Expo tunnel
          /^https:\/\/.*\.ngrok\.io$/,    // ngrok (legacy)
          /^https:\/\/.*\.ngrok-free\.app$/, // ngrok free tier
          'http://localhost:19006',        // Expo web
          'http://localhost:8081',         // Metro bundler
        ]

        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          callback(null, true)
          return
        }

        const isAllowed = allowedOrigins.some(pattern =>
          pattern instanceof RegExp ? pattern.test(origin) : pattern === origin
        )

        callback(isAllowed ? null : new Error('Not allowed by CORS'), isAllowed)
      },
      credentials: true,
    })

    // Error handler (global — must be set before scoped plugins)
    app.setErrorHandler(errorHandler)

    // Public routes — no Clerk plugin, so JWKS is never fetched for these
    app.register(poisRoutes, { prefix: '/pois' })
    app.register(cityRoutes, { prefix: '/cities' })

    // Authenticated scope — Clerk plugin only runs on these routes
    app.register(async (authed) => {
      await authed.register(clerkPlugin)
      authed.register(whisperRoutes, { prefix: '/whisper' })
      authed.register(userRoutes, { prefix: '/user' })
      authed.register(adminRoutes, { prefix: '/admin' })
    })

    // Health checks
    app.get('/health', async () => ({
      status: 'ok',
      service: 'citywhispers-api',
    }))

    app.get('/health/db', async (_, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`
        return { status: 'ok', database: 'connected' }
      } catch (err) {
        reply.status(500)
        return { status: 'error', database: 'unreachable' }
      }
    })

    await app.listen({
      port: Number(process.env.PORT) || 3001,
      host: '0.0.0.0',
    })

    console.log(`🚀 Server running on http://0.0.0.0:${process.env.PORT || 3001}`)

  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
