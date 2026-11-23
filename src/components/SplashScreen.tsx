/**
 * The one launch screen: white, centered "Pactara" wordmark, nothing else.
 *
 * It is plain server-rendered markup in the root shell (not React state), so
 * it is on screen from the very first paint, before the app's code loads. Its
 * inline script:
 *  - reveals the wordmark once Inter 900 is ready, then hides the native iOS
 *    splash (same look and size, so the swap is invisible);
 *  - exposes window.__pactaraLaunch.release() — the app calls it when the
 *    first screen is ready (src/lib/launch-screen.ts) — which fades out over
 *    200ms;
 *  - fades out anyway 2.5s after the page started loading (hard cap).
 * A page reload away from the entry screen (iOS reviving a backgrounded app)
 * skips it, so the member stays exactly where they were.
 *
 * The native launch screen (native-assets/ios) is drawn from these exact
 * values; change them together.
 */
export const LAUNCH_WORDMARK = {
  fontSize: 44,
  fontWeight: 900,
  letterSpacing: -1.2,
  lineHeight: 54,
  width: 200,
  purple: "#7C3AED",
  ink: "#141218",
  background: "#FFFFFF",
} as const;

export const LAUNCH_CAP_MS = 2500;
/**
 * At the cap the screen fades as soon as the first screen is known (it then
 * shows its own skeleton); it never fades onto the in-between entry page. This
 * is the absolute limit if the app never gets that far (e.g. offline, broken).
 */
export const LAUNCH_SAFETY_MS = 8000;
export const LAUNCH_FADE_MS = 200;

const SCRIPT = `(function(){
var el=document.getElementById('launch-screen');
var cap=window.Capacitor;
function hideNative(){try{if(cap&&cap.nativePromise){cap.nativePromise('SplashScreen','hide',{fadeOutDuration:0}).catch(function(){});}}catch(e){}}
if(!el){hideNative();return;}
var api=window.__pactaraLaunch={done:false,revealed:false,release:function(){}};
var nav=performance.getEntriesByType?performance.getEntriesByType('navigation')[0]:null;
var entry=location.pathname==='/'||location.pathname==='';
if(nav&&nav.type==='reload'&&!entry){el.style.display='none';api.done=true;api.revealed=true;hideNative();return;}
var mark=document.getElementById('launch-wordmark');
function reveal(){if(api.revealed)return;api.revealed=true;if(mark)mark.style.opacity='1';requestAnimationFrame(function(){requestAnimationFrame(hideNative);});}
try{document.fonts.load('900 ${LAUNCH_WORDMARK.fontSize}px Inter').then(reveal,reveal);}catch(e){reveal();}
setTimeout(reveal,700);
api.release=function(){if(api.done)return;api.done=true;try{performance.mark('pactara-launch-released');}catch(e){}reveal();var cur=document.getElementById('launch-screen')||el;cur.style.transition='opacity ${LAUNCH_FADE_MS}ms ease-out';cur.style.opacity='0';cur.style.pointerEvents='none';setTimeout(function(){var c=document.getElementById('launch-screen');if(c)c.style.display='none';window.dispatchEvent(new Event('pactara:launch-done'));},${LAUNCH_FADE_MS});};
setTimeout(function(){api.capped=true;if(api.settled)api.release();},Math.max(0,${LAUNCH_CAP_MS}-performance.now()));setTimeout(function(){api.release();},Math.max(0,${LAUNCH_SAFETY_MS}-performance.now()));
})();`;

/** Rendered once by the root shell, first thing in <body>. */
export function SplashScreen({ show }: { show: boolean }) {
  const w = LAUNCH_WORDMARK;
  return (
    <>
      {show && (
        <div
          id="launch-screen"
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: w.background,
          }}
        >
          <div
            id="launch-wordmark"
            style={{
              width: w.width,
              height: w.lineHeight,
              lineHeight: `${w.lineHeight}px`,
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: w.fontSize,
              fontWeight: w.fontWeight,
              letterSpacing: `${w.letterSpacing}px`,
              textAlign: "center",
              whiteSpace: "nowrap",
              color: w.ink,
              opacity: 0,
            }}
          >
            <span style={{ color: w.purple }}>P</span>actara
          </div>
        </div>
      )}
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
