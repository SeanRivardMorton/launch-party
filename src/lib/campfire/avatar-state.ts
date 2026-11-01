export const STALE_MS = 180_000
export const RESERVE_AVATAR = `INSERT INTO campfire_avatars(user_id,state,attempts,token,input_json,updated_at) VALUES(?,'pending',1,?,?,?)
  ON CONFLICT(user_id) DO UPDATE SET state='pending',attempts=attempts+1,token=excluded.token,input_json=excluded.input_json,updated_at=excluded.updated_at
  WHERE campfire_avatars.attempts<2 AND (campfire_avatars.state!='pending' OR campfire_avatars.updated_at<?)`
export type AvatarRow = { state: 'not_requested' | 'pending' | 'ready' | 'failed'; attempts: number; token: string | null; asset_key: string | null; input_json: string; updated_at: number }
