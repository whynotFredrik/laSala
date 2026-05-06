/**
 * Mifflin-St Jeor BMR + activity multiplier → TDEE.
 *
 *   BMR (kcal/day):
 *     male:   10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
 *     female: 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161
 *
 *   TDEE = BMR * activity multiplier:
 *     sedentary    1.2   (little/no exercise)
 *     light        1.375 (1-3 days/week)
 *     moderate     1.55  (3-5 days/week)
 *     active       1.725 (6-7 days/week)
 *     very_active  1.9   (twice a day, intense)
 */

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active"

export type Sex = "male" | "female"

const ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export function bmr(input: {
  sex: Sex
  age: number
  weightKg: number
  heightCm: number
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age
  return input.sex === "male" ? base + 5 : base - 161
}

export function tdee(input: {
  sex: Sex
  age: number
  weightKg: number
  heightCm: number
  activity: ActivityLevel
}): number {
  return Math.round(bmr(input) * ACTIVITY[input.activity])
}

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]
