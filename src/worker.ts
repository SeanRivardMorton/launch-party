import start from '@tanstack/react-start/server-entry'
import { campfireApi } from './lib/campfire/api'
export { GuildCampfire } from './lib/campfire/room'
export { AvatarGeneration } from './lib/campfire/avatar'

export default {
  async fetch(request: Request, env: Cloudflare.Env) {
    if (new URL(request.url).pathname.startsWith('/api/campfire/')) {
      try { return await campfireApi(request, env) } catch {
        return Response.json({ error: 'Campfire temporarily unavailable. Please try again.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
      }
    }
    return start.fetch(request)
  },
}
