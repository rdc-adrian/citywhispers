import { FastifyRequest, FastifyReply } from 'fastify'

export async function adminAuth(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-admin-key']

  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return reply.status(401).send({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Invalid or missing admin API key',
    })
  }
}