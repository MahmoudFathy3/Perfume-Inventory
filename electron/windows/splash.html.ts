interface SplashHtmlOptions {
  name: string
  subtitle: string
  version: string
  /** كود الـ SVG للشعار */
  logoSvg: string
  durationMs: number
}

/**
 * صفحة شاشة البداية (HTML جاهز). بنحمّلها كـ data URL علشان مفيش ملفات إضافية تتشال في الـ build.
 * شريط التحميل بيتحرك بنفس مدة الظهور.
 */
export function buildSplashHtml({ name, subtitle, version, logoSvg, durationMs }: SplashHtmlOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: transparent; overflow: hidden; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; -webkit-user-select: none; user-select: none; }
  .card {
    height: 100%; border-radius: 26px; color: #fff; text-align: center;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    background: linear-gradient(145deg, #14b8a6 0%, #0f766e 48%, #134e4a 100%);
    position: relative; overflow: hidden;
  }
  .card::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(circle at 20% 10%, rgba(255,255,255,.28), transparent 55%);
  }
  .logo { width: 112px; height: 112px; filter: drop-shadow(0 10px 18px rgba(0,0,0,.3)); animation: float 2.4s ease-in-out infinite; position: relative; }
  .logo svg { width: 100%; height: 100%; }
  h1 { font-size: 30px; font-weight: 700; letter-spacing: .5px; margin-top: 10px; position: relative; }
  .sub { font-size: 17px; opacity: .9; position: relative; }
  .bar { width: 240px; height: 5px; border-radius: 99px; background: rgba(255,255,255,.25); margin-top: 22px; overflow: hidden; position: relative; }
  .bar i { display: block; height: 100%; width: 0; border-radius: 99px; background: #fde68a; animation: load ${durationMs}ms cubic-bezier(.3,.6,.3,1) forwards; }
  .ver { position: absolute; bottom: 14px; font-size: 12px; opacity: .65; }
  @keyframes load { to { width: 100%; } }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">${logoSvg}</div>
    <h1>${name}</h1>
    <div class="sub" dir="rtl">${subtitle}</div>
    <div class="bar"><i></i></div>
    <div class="ver">v${version}</div>
  </div>
</body>
</html>`
}
