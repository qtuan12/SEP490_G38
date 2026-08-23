import { z } from 'zod';

export const materialRequestDecisionSchema = z.object({
  decision: z.enum([
    'ExternalPurchase',
    'InternalTransfer',
    'WaitSupply',
    'NotApproved',
  ]),
  note: z.string()
    .trim()
    .min(5, 'Ghi chú phải có ít nhất 5 ký tự.')
    .max(1000, 'Ghi chú tối đa 1000 ký tự.'),
});

export type MaterialRequestDecisionFormValues = z.infer<typeof materialRequestDecisionSchema>;
