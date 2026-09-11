import { z } from 'zod';
import { FREQUENCY_ENUM, type FrequencyType } from '#lib/constants/frequencies.js';

export const insuranceSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	provider: z.string().min(1, 'Provider is required'),
	category: z.string().min(1, 'Type is required'),
	premium: z
		.string()
		.min(1, 'Premium is required')
		.refine((s) => !Number.isNaN(parseFloat(s)), 'Premium must be a number')
		.refine((s) => parseFloat(s) > 0, 'Premium must be positive')
		.transform((s) => parseFloat(s)),
	frequency: z.enum(FREQUENCY_ENUM as [FrequencyType, ...FrequencyType[]]),
	renewalDate: z.string().min(1, 'Renewal date is required'),
	owner: z.string().min(1, 'Owner is required')
});

export const updateInsuranceSchema = insuranceSchema.extend({
	id: z.string()
});
