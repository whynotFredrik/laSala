import "server-only"

import { TRAINERS, type Sex, type Trainer } from "@/lib/constants"

/**
 * Picks the trainer to auto-assign at sign-up.
 *
 * - Men go to Eugen (only male trainer).
 * - Women are intentionally NOT auto-assigned — admin picks Marina or Ana
 *   manually after sign-up via /admin/users/<id>. Returning `null` here
 *   lets the sign-up action skip the trainer column entirely.
 */
export async function assignTrainer(sex: Sex): Promise<Trainer | null> {
  if (sex === "male") {
    return TRAINERS.male[0]
  }
  return null
}
