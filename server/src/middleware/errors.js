import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError.js';

/** Parses req[source] with a zod schema, replacing it with the parsed (coerced) value. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error);
  req.valid = { ...(req.valid || {}), [source]: result.data };
  return next();
};

export function notFound(req, _res, next) {
  next(new HttpError(404, 'not_found', `No route for ${req.method} ${req.path}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(logger = console) {
  return (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: {
          code: 'validation_failed',
          message: 'Some fields are missing or invalid.',
          fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'bad_json', message: 'Request body is not valid JSON.' } });
    }
    logger.error('[error]', err);
    return res.status(500).json({ error: { code: 'internal', message: 'Something went wrong. Please try again.' } });
  };
}
