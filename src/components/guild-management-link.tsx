import { useEffect, useState } from 'react'
import { guildManagementPath, readGuildManagementKey } from '@/lib/guild-management'

export function GuildManagementLink({ guildId }: { guildId: string }) {
  const [path, setPath] = useState('')
  useEffect(() => {
    const key = readGuildManagementKey(guildId)
    setPath(key ? guildManagementPath(guildId, key) : '')
  }, [guildId])
  return path ? <a className="directory-signup" href={path}>Manage recruitment needs</a> : null
}
