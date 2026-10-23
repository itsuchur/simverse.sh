import { z } from "zod";

export const dashboardReasonSchema = z
  .string()
  .trim()
  .min(1, "A reason is required")
  .max(500, "Reason must be 500 characters or fewer");
