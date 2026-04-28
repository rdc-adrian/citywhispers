import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { cityRoutes } from './routes/city/index'
import { poisRoutes } from './routes/pois/index'
import { whisperRoutes } from './routes/whisper/index'
import { userRoutes } from './routes/user/index'
import { adminRoutes } from './routes/admin/index'
import { errorHandler } from './middleware/errorHandler'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

export const prisma = new PrismaClient({ adapter })

const app = Fastify({ logger: true })

// CORS configuration - allows Expo tunnel in development
app.register(cors, {
  origin: (origin, cb) => {
    // In development, allow Expo tunnel domains
    const allowedOrigins = [
      /^https:\/\/.*\.exp\.direct$/,  // Expo tunnel
      /^https:\/\/.*\.ngrok\.io$/,    // ngrok (alternative)
      'http://localhost:19006',        // Expo web
      'http://localhost:8081',         // Metro bundler
    ];
 
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      cb(null, true);
      return;
    }
 
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(origin);
      }
      return pattern === origin;
    });
 
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
});

// Routes
app.register(cityRoutes, { prefix: '/cities' })
app.register(whisperRoutes, { prefix: '/whisper' })
app.register(userRoutes, { prefix: '/user' })
app.register(adminRoutes, { prefix: '/admin' })
app.register(poisRoutes, { prefix: '/pois' })

// Error handler
app.setErrorHandler(errorHandler)

// Health checks
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
    await app.listen({ 
      port: Number(process.env.PORT) || 3001, 
      host: '0.0.0.0' // Important: allows external connections
    });
    console.log(`🚀 Server running on http://0.0.0.0:${process.env.PORT || 3001}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start()
