import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ddnmqtoqkgybovvrdrpc.supabase.co';
// Ensure the base URL is used by trimming any rest/v1 paths
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WF5ybUvRO5uy5nOOtVvqzQ_BtH1wkQ9';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
