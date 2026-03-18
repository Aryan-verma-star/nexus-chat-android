import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type User = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  custom_status: string;
  is_active: boolean;
  is_online: boolean;
  last_seen: string;
};

export type Conversation = {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender: string | null;
  unread_count?: number;
  members?: ConversationMember[];
};

export type ConversationMember = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  notifications_muted: boolean;
  joined_at: string;
  last_read_at: string;
  profile?: User;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'file' | 'system' | 'voice';
  file_url: string | null;
  file_name: string | null;
  reply_to: string | null;
  is_deleted: boolean;
  is_edited: boolean;
  created_at: string;
  sender?: User;
  reply_message?: Message;
  reactions?: MessageReaction[];
};

export type MessageReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profile?: User;
};

export type Job = {
  id: string;
  platform: 'fiverr' | 'upwork' | 'manual' | 'other';
  external_id: string | null;
  external_url: string | null;
  title: string;
  description: string | null;
  requirements: string[] | null;
  budget_amount: number | null;
  budget_currency: string;
  deadline: string | null;
  client_name: string | null;
  status: 'new' | 'claimed' | 'in_progress' | 'completed' | 'cancelled';
  claimed_by: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
  claimer?: User;
};

export type Notification = {
  id: string;
  user_id: string;
  type: 'new_message' | 'new_job' | 'job_claimed' | 'job_completed' | 'user_joined' | 'user_left' | 'admin_announcement' | 'mention';
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};
