import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../lib/errors'
import { ZodError } from 'zod'

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      issues: error.issues,
    })
  }

  // App errors (NotFound, Unauthorized, etc.)
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      status: 'error',
      code: error.code,
      message: error.message,
    })
  }

  // Unknown errors
  request.log.error(error)
  const isDev = process.env.NODE_ENV !== 'production'
  return reply.status(500).send({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: isDev ? error.message : 'An unexpected error occurred',
    ...(isDev ? { detail: error.stack } : {}),
  })
}