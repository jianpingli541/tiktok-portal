export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface TaskDTO {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  source_url: string;
  target_language: string;
  progress: number;
  created_at: string;
  updated_at: string;
  output_url?: string;
  error?: string;
}

export interface PlanDTO {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  monthly_quota: number;
}

export interface SubscriptionDTO {
  plan_id: string;
  status: 'active' | 'cancelled';
  current_period_end: string;
}

export interface AuthSession {
  user: { id: string; email: string };
  access_token: string;
  refresh_token: string;
  expires_at: string;
}
