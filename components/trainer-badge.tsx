import { trainerColors } from "@/lib/constants"
import { cn } from "@/lib/utils"

/**
 * Colored pill with the trainer's name. Pair it with
 * `trainerColors(trainer).accent` on the row (`border-l-4`) for a colored
 * edge on the whole slot.
 */
export default function TrainerBadge({
  trainer,
  className,
}: {
  trainer: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        trainerColors(trainer).badge,
        className,
      )}
    >
      {trainer}
    </span>
  )
}
