import { z } from 'zod';

export const distributionSchema = z.object({
	holdingId: z.string(),
	datePaid: z.string(),
	grossPayment: z.number().min(0).default(0),
	taxWithheld: z.number().min(0).default(0),
	/*
	  A real boolean. The old "on" string was how a plain form action reported a
	  checkbox; a remote form encodes the type in the field name and hands over a
	  boolean, so the string would never arrive.
	*/
	reinvested: z.boolean().default(false)
});

export const updateDistributionSchema = distributionSchema.extend({
	id: z.string()
});

export const holdingSchema = z.object({
	portfolioId: z.string(),
	investmentId: z.string().min(1, 'Investment is required')
});

export const updateHoldingSchema = holdingSchema.extend({
	id: z.string()
});

export const transactionSchema = z.object({
	quantity: z.number().min(1, 'Quantity must be at least 1'),
	pricePerUnit: z.number().min(0, 'Price per unit must be positive'),
	brokerage: z.number().min(0, 'Brokerage must be positive').default(0),
	transactionDate: z.string(),
	type: z.enum(['buy', 'sell', 'reinvestment'], {
		message: 'Type must be buy, sell, or reinvestment'
	}),
	/** Broker the trade was placed through. Optional — older rows predate it. */
	platform: z.string().optional()
});

export const updateTransactionSchema = transactionSchema.extend({
	id: z.string()
});
