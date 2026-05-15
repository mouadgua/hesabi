// app/register/actions.js
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

export async function registerUser(formData) {
  const supabase = await createClient()

  const nom = formData.get('nom')
  const email = formData.get('email')
  const password = formData.get('password')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: nom,
      }
    }
  })

  if (error) {
    return redirect('/register?message=Erreur: ' + error.message)
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

// Fonction d'inscription via Google
export async function signUpWithGoogle() {
  const supabase = await createClient()
  
  const headersList = await headers()
  const origin = headersList.get('origin')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`, // On utilise la même route de callback !
    },
  })

  if (data.url) {
    redirect(data.url)
  }
}