import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!

// Supabase (and most hosted Postgres) requires SSL. node-postgres doesn't
// enable it automatically unless the connection string includes ?sslmode=require,
// and even then it verifies the cert chain — which Supabase's pooler doesn't
// satisfy without disabling rejectUnauthorized.
const adapter = new PrismaPg({
  connectionString,
  ssl: { rejectUnauthorized: false },
} as any)

export const prisma = new PrismaClient({ adapter })