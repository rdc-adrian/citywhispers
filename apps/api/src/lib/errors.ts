export class AppError extends Error {
  statusCode: number
  code: string

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND')
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized', 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(reason = 'Access denied') {
    super(reason, 403, 'FORBIDDEN')
  }
}