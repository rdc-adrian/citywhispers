import { FastifyInstance } from 'fastify'
import { adminCityRoutes } from './cities'
import { adminPoiRoutes } from './pois'
import { adminPoiFactRoutes } from './poiFacts'
import { adminWhisperRoutes } from './whispers'
import { adminPersonaRoutes } from './personas'
import { adminAuth } from '../../middleware/adminAuth'

export async function adminRoutes(app: FastifyInstance) {
  // Apply admin auth to all routes in this plugin
  app.addHook('preHandler', adminAuth)

  app.register(adminCityRoutes, { prefix: '/cities' })
  app.register(adminPoiRoutes, { prefix: '/pois' })
  app.register(adminPoiFactRoutes, { prefix: '/poi-facts' })
  app.register(adminWhisperRoutes, { prefix: '/whispers' })
  app.register(adminPersonaRoutes, { prefix: '/personas' })
}