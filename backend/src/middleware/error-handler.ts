import type { ErrorHandler } from 'hono'
import { AppError } from '../lib/errors'
import { ZodError } from 'zod'

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof AppError) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.statusCode as 400,
    )
  }

  if (error instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: error.issues,
        },
      },
      400,
    )
  }

  console.error('[unhandled]', error)

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    },
    500,
  )
}
