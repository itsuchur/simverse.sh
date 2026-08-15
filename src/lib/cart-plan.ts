import { z } from "zod";

export const cartPlanSchema = z.object({
  supplier: z.literal("esimaccess"),
  packageCode: z.string().min(1),
  slug: z.string().min(1),
  country: z.string().min(1),
  data_gb: z.number().finite(),
  validity_days: z.number().int().positive(),
  price: z.number().finite(),
  price_rub: z.number().finite(),
  price_stars: z.number().finite(),
  cost: z.number().finite(),
  currency: z.literal("USD"),
  qty: z.literal(1),
  networks: z.array(z.string()),
  name: z.string().min(1),
  nameRu: z.string().optional(),
});

export type CartPlan = z.infer<typeof cartPlanSchema>;
