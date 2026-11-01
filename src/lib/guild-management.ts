export function createManagementKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function guildManagementPath(id: string, key: string): string {
  return `/guilds/${encodeURIComponent(id)}/manage#key=${key}`
}

export function saveGuildManagementKey(id: string, key: string) {
  try { localStorage.setItem(`launchparty-guild-owner:${id}`, key) } catch { /* The private link also works without local storage. */ }
}

export function readGuildManagementKey(id: string): string {
  try { return localStorage.getItem(`launchparty-guild-owner:${id}`) || '' } catch { return '' }
}
