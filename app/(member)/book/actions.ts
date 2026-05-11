"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { formatStudio } from "@/lib/booking/format"
import { translateBookingError } from "@/lib/booking/translate-error"
import { sendEmail } from "@/lib/email/send"
import { createClient } from "@/lib/supabase/server"

const uuid = z.string().uuid()

export type BookingActionResult =
  | { status: "ok" }
  | { status: "error"; message: string }

/**
 * Looks up the booking row plus session+class+profile so we can pass
 * human-readable data to the email template. Best-effort; callers must not
 * fail if this returns null (the booking RPC already succeeded).
 */
async function loadBookingContext(bookingId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, sessions(start_at, classes(name_ro)), profiles!user_id(full_name, email, id)",
    )
    .eq("id", bookingId)
    .maybeSingle()
  if (!data || !data.sessions || !data.profiles) return null
  return {
    userId: data.profiles.id,
    name: data.profiles.full_name ?? "",
    email: data.profiles.email,
    className: data.sessions.classes?.name_ro ?? "Sesiune",
    startAt: new Date(data.sessions.start_at),
  }
}

/**
 * Wraps the `book_session` Postgres function. The function does all of:
 * lock session row, check capacity, check plan, check same-day, insert
 * booking, bump counters — atomically. We translate errors, revalidate
 * caches, and fire-and-forget the confirmation email.
 */
export async function bookSessionAction(
  sessionId: string,
): Promise<BookingActionResult> {
  const parsed = uuid.safeParse(sessionId)
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  const supabase = await createClient()
  const { data: booking, error } = await supabase.rpc("book_session", {
    p_session_id: parsed.data,
  })

  if (error) {
    return { status: "error", message: translateBookingError(error.message) }
  }

  // Fire confirmation email — never let it block or fail the user flow.
  if (booking?.id) {
    const ctx = await loadBookingContext(booking.id)
    if (ctx) {
      await sendEmail({
        to: ctx.email,
        userId: ctx.userId,
        template: "bookingConfirmation",
        props: {
          name: ctx.name,
          className: ctx.className,
          date: formatStudio(ctx.startAt, "EEEE d MMMM yyyy"),
          time: formatStudio(ctx.startAt, "HH:mm"),
        },
      })
    }
  }

  revalidatePath("/home")
  revalidatePath("/book")
  revalidatePath("/history")
  return { status: "ok" }
}

/**
 * Wraps `cancel_booking`. The 3-hour window check happens in the function.
 */
export async function cancelBookingAction(
  bookingId: string,
): Promise<BookingActionResult> {
  const parsed = uuid.safeParse(bookingId)
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  // Capture the context BEFORE we cancel — once cancelled, `cancelled_at`
  // is set and we still want the same human-readable session details.
  const ctx = await loadBookingContext(parsed.data)

  const supabase = await createClient()
  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: parsed.data,
  })

  if (error) {
    return { status: "error", message: translateBookingError(error.message) }
  }

  if (ctx) {
    await sendEmail({
      to: ctx.email,
      userId: ctx.userId,
      template: "bookingCancellation",
      props: {
        name: ctx.name,
        className: ctx.className,
        date: formatStudio(ctx.startAt, "EEEE d MMMM yyyy"),
        time: formatStudio(ctx.startAt, "HH:mm"),
      },
    })
  }

  revalidatePath("/home")
  revalidatePath("/book")
  revalidatePath("/history")
  return { status: "ok" }
}

/**
 * Wraps `reschedule_booking`. The cap (2 per ISO week) is enforced server-side
 * in the function.
 */
export async function rescheduleBookingAction(
  bookingId: string,
  newSessionId: string,
): Promise<BookingActionResult> {
  const parsedBooking = uuid.safeParse(bookingId)
  const parsedSession = uuid.safeParse(newSessionId)
  if (!parsedBooking.success || !parsedSession.success) {
    return { status: "error", message: "invalid_input" }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("reschedule_booking", {
    p_booking_id: parsedBooking.data,
    p_new_session_id: parsedSession.data,
  })

  if (error) {
    return { status: "error", message: translateBookingError(error.message) }
  }

  // Now session_id points at the new session — reload context for the email.
  const ctx = await loadBookingContext(parsedBooking.data)
  if (ctx) {
    await sendEmail({
      to: ctx.email,
      userId: ctx.userId,
      template: "bookingReschedule",
      props: {
        name: ctx.name,
        className: ctx.className,
        newDate: formatStudio(ctx.startAt, "EEEE d MMMM yyyy"),
        newTime: formatStudio(ctx.startAt, "HH:mm"),
      },
    })
  }

  revalidatePath("/home")
  revalidatePath("/book")
  revalidatePath("/history")
  return { status: "ok" }
}
