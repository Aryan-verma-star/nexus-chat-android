export interface UserPermissions {
  can_view_jobs: boolean;
  can_claim_jobs: boolean;
  can_create_groups: boolean;
  can_send_files: boolean;
  can_send_messages: boolean;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  custom_status: string;
  permissions: UserPermissions;
  is_active: boolean;
  is_online: boolean;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  created_by: string | null;
  is_archived: boolean;
  pinned_message_id: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender: string | null;
  created_at: string;
  updated_at: string;
  members?: ConversationMember[];
  unread_count?: number;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  notifications_muted: boolean;
  joined_at: string;
  last_read_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: 'text' | 'image' | 'file' | 'system' | 'voice';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  reply_to: string | null;
  is_deleted: boolean;
  is_edited: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  sender?: Profile;
  reply_message?: Message;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profile?: Profile;
}

export interface MessageRead {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface TypingIndicator {
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  updated_at: string;
}

export interface Job {
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
  client_info: Record<string, unknown>;
  status: 'new' | 'claimed' | 'in_progress' | 'completed' | 'cancelled';
  claimed_by: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  attachments: unknown[];
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  claimer?: Profile;
}

export interface JobComment {
  id: string;
  job_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_message' | 'new_job' | 'job_claimed' | 'job_completed' | 'user_joined' | 'user_left' | 'admin_announcement' | 'mention';
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  profile?: Profile;
}

export interface AISummary {
  id: string;
  conversation_id: string | null;
  summary: string;
  message_count: number;
  from_date: string;
  to_date: string;
  model: string;
  created_at: string;
}

export interface AIAgentTask {
  id: string;
  job_id: string | null;
  task_type: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown> | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface HFSyncLog {
  id: string;
  sync_type: string;
  records_synced: number;
  last_synced_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export interface SecretCommand {
  command: string;
  args: string[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
