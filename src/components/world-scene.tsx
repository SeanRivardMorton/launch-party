import type { SceneTheme } from '@/lib/scene-themes'
import { RegionalLandscape } from './regional-landscape'
import './world-scene.css'
import { useSceneTheme } from './use-scene-theme'

const stars = Array.from({ length: 45 }, (_, i) => ({ x: (i * 193 + 37) % 1440, y: (i * 83 + 19) % 530, size: i % 7 === 0 ? 3 : 1.5 }))
const distantTrees = [[-30, 400, 175], [85, 450, 160], [210, 490, 130], [325, 534, 100], [1040, 510, 120], [1140, 448, 155], [1250, 392, 195], [1370, 430, 180]]
const foregroundTrees = [[-100, 270, 280, 630], [25, 510, 165, 390], [1250, 320, 260, 585], [1215, 570, 130, 325]]
const grassTufts = ['M275 825h6v-14h4v14h9v-8h4v15h-23z', 'M1125 797h4v-14h5v14h8v-7h4v14h-21z', 'M195 873h5v-12h5v12h9v-19h4v26h-23z', 'M1225 869h4v-8h6v8h7v-16h5v23h-22z']

export function WorldScene({ theme: selectedTheme, sceneryOnly = false }: { theme?: SceneTheme; sceneryOnly?: boolean }) {
  const { theme: appTheme } = useSceneTheme()
  const theme = selectedTheme ?? appTheme
  return <svg className="world-scene" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true" shapeRendering="crispEdges">
    <defs>
      <linearGradient id="sky" x2="0" y2="1"><stop stopColor="var(--sky-top)" /><stop offset="1" stopColor="var(--sky-bottom)" /></linearGradient>
      <radialGradient id="moon-halo"><stop stopColor="var(--moon)" stopOpacity=".13" /><stop offset="1" stopColor="var(--moon)" stopOpacity="0" /></radialGradient>
      <radialGradient id="fire-halo"><stop stopColor="#efac65" stopOpacity=".16" /><stop offset="1" stopColor="#efac65" stopOpacity="0" /></radialGradient>
      <symbol id="pine" viewBox="0 0 80 180"><path d="M36 152h8v28h-8zM36 0h8v14h8v18h8v14H48v8h16v18h8v15H53v8h19v18h8v24H0v-24h8V95h19v-8H8V72h8V54h16v-8H20V32h8V14h8z" fill="currentColor" /><path d="M40 14h4v18h8v14H40v8h12v18h8v15H40v8h20v18h8v24H40z" fill="#000" opacity=".12" /></symbol>
    </defs>
    <path fill="url(#sky)" d="M0 0h1440v900H0z" />
    {stars.map((star, i) => <rect key={i} className={i % 3 === 0 ? 'scene-star' : undefined} style={{ animationDelay: `${-i * .73}s`, animationDuration: `${4 + i % 5}s` }} x={star.x} y={star.y} width={star.size} height={star.size} fill="var(--moon)" opacity={i % 3 === 0 ? '.55' : '.2'} />)}
    <g className="scene-moon">
      <circle className="scene-moon-halo" cx="1160" cy="182" r="145" fill="url(#moon-halo)" />
      <path d="M1144 132h32v8h12v12h8v32h-8v12h-12v8h-32v-8h-12v-12h-8v-32h8v-12h12z" fill="var(--moon)" opacity=".8" />
      <path d="M1158 132h18v8h12v12h8v32h-8v12h-12v8h-18v-10h-12v-14h-6v-26h8v-12h10z" fill="var(--sky-top)" />
    </g>
    {theme !== 'moonwell' && theme !== 'tavern' ? <RegionalLandscape theme={theme} /> : <g>
    <path d="M0 565h90v-30h75v-34h65v-43h45v-32h65v40h55v45h95v40h80v-32h90v-55h80v-24h45v-26h60v40h55v28h60v38h100v-25h55v-58h55v-49h45v-31h55v47h45v48h75v36h80v357H0z" fill="var(--mountain-far)" />
    <path d="M0 670h110v-55h100v-30h130v38h70v25h95v-45h120v-35h90v-22h100v40h90v55h120v-32h80v-32h80v-20h115v65h120v278H0z" fill="var(--mountain-near)" />
    <g color="var(--forest-far)">{distantTrees.map(([x, y, h], i) => <g key={i} className="scene-tree scene-tree-distant" style={{ animationDelay: `${-i * 1.1}s`, animationDuration: `${7 + i % 3}s` }}><use href="#pine" x={x} y={y} width={h * .65} height={h * 1.8} /></g>)}</g>
    <path d="M0 778h120v-15h130v-14h170v-10h170v-8h240v8h180v10h170v16h140v12h120v123H0z" fill="var(--ground)" />
    <path d="M340 900v-26h140v-22h110v-17h90v-16h110v16h130v17h100v22h100v26z" fill="var(--path)" />
    <g color="var(--forest-front)">{foregroundTrees.map(([x, y, width, height], i) => <g key={i} className="scene-tree" style={{ animationDelay: `${-i * 1.7}s`, animationDuration: `${6 + i % 3}s` }}><use href="#pine" x={x} y={y} width={width} height={height} /></g>)}</g>
    <g fill="var(--grass)">{grassTufts.map((d, i) => <path key={i} className="scene-grass" style={{ animationDelay: `${-i * .9}s`, animationDuration: `${3.2 + i * .4}s` }} d={d} />)}<path d="M435 785h12v3h-12zm500 10h16v3h-16zM315 858h18v3h-18zm770 19h12v3h-12z" /></g>
    </g>}
    {!sceneryOnly && <g>
    <ellipse className="campfire-glow" cx="723" cy="801" rx="140" ry="65" fill="url(#fire-halo)" />
    <g className="campfire">
      <path className="campfire-stones" d="M701 811h45v5h-45zM710 806h29v5h-29z" fill="#45483e" />
      {/* Swap whole pixel silhouettes so flame edges stay crisp and the logs never move. */}
      <g className="campfire-flame campfire-flame-rest">
        <path d="M709 800h8v-7h-4v-15h8v-17h5v-12h5v22h7v17h-4v12h-6v6h-19z" fill="#d57c4f" />
        <path d="M716 800v-13h7v-12h5v16h4v10h-7v5h-9z" fill="#f1bd71" />
        <path d="M720 800h6v6h-6z" fill="#f7df9c" />
      </g>
      <g className="campfire-flame campfire-flame-low">
        <path d="M709 800h4v-14h-4v-10h5v7h5v-15h5v-13h5v19h5v14h5v12h-9v6h-21z" fill="#d57c4f" />
        <path d="M716 800v-10h5v-11h5v10h5v12h-6v5h-9z" fill="#f1bd71" />
        <path d="M718 800h7v6h-7z" fill="#f7df9c" />
      </g>
      <g className="campfire-flame campfire-flame-high">
        <path d="M709 800h4v-19h6v-12h5v-22h5v16h5v-7h4v18h-5v13h5v13h-10v6h-19z" fill="#d57c4f" />
        <path d="M716 800v-15h6v-15h5v20h5v10h-7v6h-9z" fill="#f1bd71" />
        <path d="M720 797h6v9h-6z" fill="#f7df9c" />
      </g>
      <path className="campfire-logs" d="M710 816h28v4h-28z" fill="#815d40" />
    </g>
    <g className="embers" fill="#f4c77e"><rect className="campfire-ember" x="718" y="738" width="3" height="3" /><rect className="campfire-ember" x="735" y="756" width="2" height="2" /><rect className="campfire-ember" x="708" y="765" width="2" height="2" /></g>
    </g>}
  </svg>
}
