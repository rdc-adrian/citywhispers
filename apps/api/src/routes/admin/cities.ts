import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const CreateCitySchema = z.object({
  name: z.string().min(1),
  countryCode: z.string().length(2),
  timezone: z.string().min(1),
  status: z.enum(['draft', 'active', 'deprecated']).default('draft'),
})

const UpdateCitySchema = CreateCitySchema.partial()

export async function adminCityRoutes(app: FastifyInstance) {
  // GET /admin/cities
  app.get('/', async () => {
    const cities = await prisma.city.findMany({
      include: {
        _count: {
          select: { pois: true, trails: true, generatedWhispers: true },
        },
      },
      orderBy: { name: 'asc' },
    })
    return { data: cities }
  })

  // POST /admin/cities
  app.post('/', async (request, reply) => {
    const body = CreateCitySchema.parse(request.body)
    const city = await prisma.city.create({ data: body })
    return reply.status(201).send({ data: city })
  })

  // PATCH /admin/cities/:id
  app.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const body = UpdateCitySchema.parse(request.body)
    const city = await prisma.city.update({
      where: { id: request.params.id },
      data: body,
    })
    return { data: city }
  })

  // DELETE /admin/cities/:id
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    await prisma.city.update({
      where: { id: request.params.id },
      data: { status: 'deprecated' },
    })
    return reply.status(204).send()
  })
}