export type UserPlan = 'free' | 'standard' | 'student' | 'support_plus'

export interface PlayEvent {
  track_id: string
  user_plan: UserPlan
  played_sec: number
  duration_sec: number
  completed: boolean
  ai_generated: boolean
}

export interface Support {
  track_id: string
}

export interface TrackScore {
  track_id: string
  artist_id: string
  play_time_score: number
  support_rate: number
  completion_rate: number
  raw_score: number
}

export interface DistributionResult {
  artist_id: string
  distribution_yen: number
  score_breakdown: {
    play_time_score: number
    support_rate: number
    completion_rate: number
    raw_score: number
  }
}

export interface PlayEventRow {
  track_id: string
  weight: number
  sec_factor: number
  completed: boolean
}
