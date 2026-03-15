import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

// Ensure URL is valid to prevent top-level crash
let isValidUrl = false;
try {
  new URL(supabaseUrl);
  isValidUrl = true;
} catch (e) {
  if (supabaseUrl.startsWith('eyJ')) {
    console.error('It looks like you pasted the Supabase Anon Key into the URL field. Please check your environment variables.');
  } else {
    console.error('Invalid Supabase URL:', supabaseUrl);
  }
}

export const isSupabaseConfigured = isValidUrl && supabaseUrl !== 'https://placeholder.supabase.co';
export const supabaseConfigError = !isValidUrl && supabaseUrl.startsWith('eyJ') 
  ? 'It looks like you pasted the Supabase Anon Key into the URL field. Please check your environment variables.'
  : !isValidUrl ? 'Invalid Supabase URL.' : null;

export const supabase = createClient(
  isValidUrl ? supabaseUrl : 'https://placeholder.supabase.co', 
  supabaseAnonKey
);
