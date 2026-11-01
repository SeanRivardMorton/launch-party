import type { SceneTheme } from '@/lib/scene-themes'

const ridges = <><path d="M0 590h80v-70h70v-70h50v-90h180v35h40v180h100v45h360v-80h90v-115h40v-50h170v65h50v100h110v360H0z" fill="var(--mountain-far)" /><path d="M0 690h100v-40h70v-100h200v40h65v90h250v-30h145v40h160v-70h70v-85h220v50h80v315H0z" fill="var(--mountain-near)" /></>
const woodland = [[-65, 270, 1.4], [130, 400, .9], [290, 500, .65], [1040, 480, .7], [1190, 340, 1.15], [1370, 250, 1.5], [450, 520, .65], [900, 500, .7]]

function Broadleaf({ ancient = false }: { ancient?: boolean }) {
  return <>{woodland.map(([x, y, scale], i) => <g key={i} className={i >= 6 ? 'regional-mobile' : undefined} transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d={ancient ? 'M62 140h52v170h16v120h25v20H35v-20h20V260H42V120h20z' : 'M69 120h24v255h25v12H42v-12h27z'} fill="var(--forest-front)" />
    <g className="scene-tree" style={{ animationDelay: `${-i}s` }}>
      <path d="M-40 130V80h30V40h50V10h90v30h45v35h35v55h-30v35h-45v20H20v-20h-35v-35z" fill="var(--forest-far)" />
      <path d="M-30 95V70h30V45h50V25h65v25h45v25h30v20h-60v18H35V95z" fill="var(--grass)" opacity={ancient ? '.6' : '.3'} />
      <path d="M-15 140h55v14h60v-14h80v20h-40v18H25v-18h-40z" fill="var(--forest-front)" opacity=".5" />
      {ancient && <g fill="#b8a8fa"><path d="M8 145h5v60H8zm135-20h5v100h-5zm-95 40h4v70h-4z" opacity=".5" /><path d="M3 202h14v5H3zm135 20h15v5h-15zm-95 10h14v5H43z" /></g>}
    </g>
  </g>)}</>
}

// Original stepped silhouettes, deliberately different geometry for each region.
// The middle clearing stays quiet for the QR and character silhouettes.
export function RegionalLandscape({ theme }: { theme: SceneTheme }) {
  return <g data-landscape={theme}>
    {(theme === 'durotar' || theme === 'mulgore') && <>{ridges}
      <g className="regional-mobile"><path d="M370 730V590h50v-90h120v35h35v195zm520 0V560h30v-45h120v75h40v140z" fill="var(--mountain-near)" /><path d="M420 500h120v8H420zm500 15h120v8H920z" fill="var(--grass)" opacity=".4" /></g>
      <g fill="var(--moon)" opacity=".16"><path d="M200 360h180v12H200zm-30 190h200v10H170zm900-175h170v12h-170zm-10 160h220v10h-220z" />{[0, 1, 2, 3].map(i => <path key={i} d={`M${230 + i * 25} 400h8v90h-8zm${1100 + i * 23} 40h6v85h-6z`} />)}</g>
      {theme === 'durotar' ? <>
        <path d="M1150 663h290v92h-420v-18h60v-22h70z" fill="#466a6a" /><path d="M1240 685h180v4h-180zm-95 28h230v4h-230z" fill="#9eb9a0" opacity=".5" />
        <path d="M35 788h120v-18h-20v-90h12v-80h10v-26h14v105h-10v108h40v21H35zm1190 28h140v-20h-16v-43h-14v-75h-13v99h-20v-24h-14v46h-63z" fill="var(--forest-front)" />
        <g fill="var(--grass)"><path d="M143 596h-48v-12h25v-15h33v-10h31v16h34v12h-45v13h-18v-10h-12zM1285 751h-23v-8h19v-18h8v18h11v-29h8v29h20v8z" /></g>
        <path d="M110 670h12v19h16v10h-28zm58-40h12v38h-20v-10h8z" fill="var(--forest-front)" />
      </> : <>
        <path d="M0 670h80v-20h130v-20h170v10h110v30h150v25h180v-25h150v-30h170v-15h170v25h130v250H0z" fill="var(--forest-far)" />
        <path d="M0 730h180v-20h190v-20h180v20h150v40h190v-20h160v-25h200v20h190v175H0z" fill="var(--ground)" />
        <g fill="var(--grass)" opacity=".5"><path d="M0 730h180v-10h190v-20h180v10H380v20H190v10H0zm950 0h110v-15h180v10h200v10h-210v-10h-160v15H950z" /></g>
        <g fill="var(--forest-front)"><path d="M180 720h12v-80h-12zm-70-80v-18h30v-18h90v18h35v18h-30v15h-100v-15zm1100 70h12v-100h-12zm-55-100v-15h20v-18h80v18h30v15h-30v14h-80v-14z" /></g>
        <path d="M1000 693h8v-85h-8zm-23-75h55v-11h-15v-20h-25v20h-15z" fill="var(--moon)" opacity=".7" />
      </>}
    </>}
    {theme === 'dunmorogh' && <>
      <path d="M0 590V480h70v-80h55v-60h55v-85h55v-80h60v80h50v75h60v85h90v90h120v80h140v-80h70v-90h75v-80h65v-75h55v-80h60v80h60v90h55v75h65v90h75v70h95v385H0z" fill="var(--mountain-far)" />
      <path d="M125 340h55v-85h55v-80h60v80h50v75h-65v-30h-40v40h-35v35h-40v-35zm770 0v-80h55v-80h60v80h60v90h-50v-35h-35v-30h-25v55z" fill="#bdcfdb" />
      <path d="M0 730V610h80v-70h60v-70h55v-70h50v70h60v70h80v70h140v95h410v-65h100v-95h65v-65h65v65h80v95h90v90h105v240H0z" fill="var(--mountain-near)" />
      <path d="M140 540v-70h55v-70h50v70h60v70h-45v-20h-35v-30h-25v50zm925 100v-95h65v-65h65v65h80v95h-60v-55h-40v-20h-25v75z" fill="#d3dfe3" />
    </>}
    {(theme === 'tirisfal' || theme === 'darnassus' || theme === 'elwynn') && <>
      <path d="M0 600h180v-40h150v-30h190v20h160v40h200v-40h170v-30h190v40h200v340H0z" fill="var(--mountain-far)" />
      <path d="M0 710h220v-35h200v-25h240v25h210v-35h220v25h350v235H0z" fill="var(--mountain-near)" />
      {theme !== 'tirisfal' && <Broadleaf ancient={theme === 'darnassus'} />}
      {theme === 'tirisfal' && <g fill="var(--forest-front)"><path d="M175 760V520h-18v-80h-30v-45h12v35h32v70h20V340h15v125h30v-45h30v-35h12v49h-30v50h-40v276zM1250 770V420h-25v-55h-35v-42h12v30h35v48h25V290h15v180h24v-60h30v-35h12v50h-30v60h-36v285z" /></g>}
    </>}
    <path d="M0 810h130v-25h200v-20h250v-14h280v14h250v20h200v25h130v90H0z" fill="var(--ground)" />
    <path d="M480 900v-20h100v-25h80v-30h120v30h90v25h100v20z" fill="var(--path)" />
    {theme === 'darnassus' && <g fill="#b0a0e5"><path d="M210 812v-10h10v-8h18v8h10v10h-15v12h-7v-12zm1010-18v-10h10v-8h18v8h10v10h-15v12h-7v-12z" /><g className="scene-star"><path d="M340 630h4v4h-4zm730 60h5v5h-5zm-870 40h4v4h-4zm920-90h4v4h-4z" /></g></g>}
    {theme === 'elwynn' && <g fill="#edcb82"><path d="M175 795h4v14h-4zm4-4h7v8h-7zm50 35h5v5h-5zm990-20h5v-15h-5zm-8-20h12v8h-12z" /></g>}
    {theme === 'tirisfal' && <g className="regional-mist" fill="#a2bba3" opacity=".12"><path d="M0 640h380v12H0zm100 30h440v14H100zm800-15h640v15H800zm220 75h420v10h-420z" /><path d="M0 770h380v14H0zm1050 0h390v14h-390z" /></g>}
    {(theme === 'tirisfal' || theme === 'dunmorogh') && <g color="var(--forest-front)">{[[-25, 480, 180], [130, 560, 135], [1140, 530, 160], [1300, 410, 220]].map(([x, y, size], i) => <g key={i} className="scene-tree"><use href="#pine" x={x} y={y} width={size} height={size * 1.8} />{theme === 'dunmorogh' && <path d={`M${x + size * .45} ${y + 15}h${size * .1}v20h${size * .12}v12h${-size * .34}v-12h${size * .12}z`} fill="#cbdde3" />}</g>)}</g>}
    {(theme === 'tirisfal' || theme === 'dunmorogh') && <g className="regional-mobile" color="var(--forest-front)"><use href="#pine" x="445" y="550" width="100" height="200" /><use href="#pine" x="895" y="530" width="110" height="220" />{theme === 'dunmorogh' && <path d="M490 565h10v20h15v10h-40v-10h15zm455-18h10v20h15v10h-40v-10h15z" fill="#d3e2e6" />}</g>}
    <g fill="var(--grass)" opacity=".7"><path d="M300 829h5v-15h5v15h8v-8h5v14h-23zm820-20h5v-14h5v14h10v-8h5v14h-25zm-900 70h6v-15h5v15h10v-8h5v14h-26z" /></g>
  </g>
}
