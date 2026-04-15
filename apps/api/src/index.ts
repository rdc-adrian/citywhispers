import 'dotenv/config'
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

export const prisma = new PrismaClient({ adapter })

const app = Fastify({ logger: true })

app.get('/health', async () => {
  return { status: 'ok', service: 'citywhispers-api' }
})

app.get('/health/db', async (_, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { status: 'ok', database: 'connected' }
  } catch (err) {
    reply.status(500)
    return { status: 'error', database: 'unreachable' }
  }
})

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
