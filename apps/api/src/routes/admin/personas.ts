import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'

const CreatePersonaSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z_]+$/),
  name: z.string().min(1),
  tonePrompt: z.string().min(10).max(500),
  active: z.boolean().default(true),
})

export async function adminPersonaRoutes(app: FastifyInstance) {
  // GET /admin/personas
  app.get('/', async () => {
    const personas = await prisma.persona.findMany({
      include: {
        _count: { select: { generatedWhispers: true } },
      },
      orderBy: { name: 'asc' },
    })
    return { data: personas }
  })

  // POST /admin/personas
  app.post('/', async (request, reply) => {
    const body = CreatePersonaSchema.parse(request.body)
    const persona = await prisma.persona.create({ data: body })
    return reply.status(201).send({ data: persona })
  })

  // PATCH /admin/personas/:id
  app.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const body = CreatePersonaSchema.partial().parse(request.body)
    const persona = await prisma.persona.update({
      where: { id: request.params.id },
      data: body,
    })
    return { data: persona }
  })
}