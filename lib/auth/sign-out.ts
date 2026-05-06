"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

/**
 * Server action to sign the current user out. Use as the action of a `<form>`
 * or call from a Client Component.
 */
export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/sign-in")
}
