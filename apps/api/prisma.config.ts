import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    async adapter() {
      const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
      if (!connectionString) throw new Error('DATABASE_URL must be set')
      return new PrismaPg({ connectionString })
    },
  },
})
