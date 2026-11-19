import { z } from 'zod';

const rating = z.coerce.number().int().min(1, 'Pick 1 to 5 stars').max(5);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optionalId = z.coerce.number().int().positive().optional();
const flag = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1')
  .optional();

export const submitFeedbackSchema = z.object({
  punctuality: rating,
  qualityOfCare: rating,
  hygiene: rating,
  behaviour: rating,
  recommendScore: z.coerce.number().int().min(0).max(10),
  comment: z.string().max(1000, 'Please keep the comment under 1000 characters').optional().nullable(),
});

export const rangeQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  nurseId: optionalId,
});

export const feedbackQuerySchema = rangeQuerySchema.extend({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'none']).optional(),
  followUp: z.enum(['none', 'open', 'resolved']).optional(),
  flagged: flag,
  maxOverall: z.coerce.number().min(1).max(5).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'lowest', 'highest']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const followUpQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const followUpUpdateSchema = z.object({
  status: z.enum(['open', 'resolved']),
  note: z.string().trim().max(500).optional().nullable(),
});

export const visitQuerySchema = z.object({
  status: z.enum(['no_link', 'pending', 'used', 'expired']).optional(),
  nurseId: optionalId,
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createVisitSchema = z.object({
  nurseId: z.coerce.number().int().positive(),
  familyId: z.coerce.number().int().positive(),
  visitDate: isoDate,
  shift: z.enum(['day', 'night', '24h']),
  service: z.string().trim().min(2).max(80),
});

export const createLinkSchema = z.object({
  expiryDays: z.coerce.number().int().min(1).max(30).optional(),
});
