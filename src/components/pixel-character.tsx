// Original hand-authored pixel portraits. No Blizzard artwork or generated assets.
const palettes = {
  warrior: { skin: '#82a966', shade: '#4d704a', hair: '#313727', cloth: '#a45b42', trim: '#e2bb76', metal: '#b8c3bd' },
  priest: { skin: '#e8b88d', shade: '#b78168', hair: '#dfc17b', cloth: '#e7dfb9', trim: '#bd965c', metal: '#e8dca3' },
  mage: { skin: '#b69dca', shade: '#7f6c9b', hair: '#ece0c5', cloth: '#6e82a9', trim: '#9cc6da', metal: '#b2d9da' },
}

export function PixelCharacter({ kind, className = '' }: { kind: keyof typeof palettes; className?: string }) {
  const p = palettes[kind]
  return <svg className={`pixel-character ${className}`} viewBox="0 0 48 56" aria-hidden="true" shapeRendering="crispEdges">
    <ellipse cx="24" cy="51" rx="16" ry="3" fill="#000" opacity=".22" />
    <path d="M16 41h7v10h-9v-4h2zm10 0h7v6h2v4h-9z" fill="#3a3934" />
    <path d="M16 29h17v15H16z" fill={p.cloth} />
    <path d="M16 29h4v15h-4zm13 0h4v15h-4z" fill={p.trim} />
    <path d="M20 29h9v3h-9zM15 39h19v3H15z" fill={p.shade} />
    <path d="M12 29h6v11h-6zm20 0h6v11h-6z" fill={p.cloth} />
    <path d="M11 37h6v6h-6zm22 0h6v6h-6z" fill={p.skin} />
    <path d="M17 13h15v13H17zM20 26h9v4h-9z" fill={p.skin} />
    <path d="M17 13h15v5H17zM15 16h4v8h-4zm16 0h4v8h-4z" fill={p.hair} />
    <path d="M20 21h3v3h-3zm8 0h3v3h-3z" fill="#262b28" />
    <path d="M23 26h5v2h-5z" fill={p.shade} />
    {kind === 'warrior' && <>
      <path d="M13 18h4v5h-4zm20 0h4v5h-4z" fill={p.skin} />
      <path d="M19 25h2v3h-2zm10 0h2v3h-2z" fill="#f3e8cb" />
      <path d="M9 28h10v6H9zm22 0h10v6H31z" fill={p.metal} />
      <path d="M40 14h3v30h-3z" fill="#9b7956" /><path d="M37 10h9v11h-9z" fill={p.metal} /><path d="M36 12h3v7h-3z" fill="#edf0df" />
    </>}
    {kind === 'priest' && <>
      <path d="M15 12h19v4H15zM18 9h13v3H18z" fill={p.cloth} />
      <path d="M21 12h7v3h-7zM23 32h3v5h-3zM21 34h7v2h-7z" fill={p.trim} />
      <path d="M8 19h3v26H8z" fill="#aa8655" /><path d="M6 13h7v7H6z" fill="#e6ce7c" /><path d="M8 11h3v11H8z" fill="#fff0b5" />
      <path d="M17 42h15v4H17z" fill={p.cloth} />
    </>}
    {kind === 'mage' && <>
      <path d="M13 13h24v4H13zM18 8h15v5H18zM22 3h7v5h-7z" fill={p.cloth} />
      <path d="M14 13h22v2H14z" fill={p.trim} />
      <path d="M16 41h17v6H16z" fill={p.cloth} />
      <path d="M39 17h3v28h-3z" fill="#827266" /><path d="M37 10h7v9h-7z" fill="#9ccec3" /><path d="M39 8h3v13h-3z" fill="#d1f1d8" />
    </>}
  </svg>
}
