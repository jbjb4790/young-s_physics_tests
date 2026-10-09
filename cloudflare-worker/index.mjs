/**
 * Young's Physics — 이름이 보이는 카카오톡 OG 미리보기 (Cloudflare Worker)
 * v3.6.7
 *
 * 학생 포털 token, fingerprint, Apps Script URL은 URL fragment(#)에만 존재하며
 * HTTP 서버에는 전달되지 않는다. Worker는 이름과 포털 공개 경로만 본다.
 *
 * 서버 응답 HTML에 og:title을 직접 넣기 때문에 JS를 실행하지 않는
 * 카카오톡 OG 크롤러도 학생별 제목을 가져올 수 있다.
 */
const ALLOWED_ORIGIN = "https://jbjb4790.github.io";
const DESCRIPTION = "주간 복습·총괄평가 결과, 누적 학습 분석과 오답 학습을 한 페이지에서 확인합니다.";

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function jsLiteral(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}
function cleanName(raw) {
  const name = String(raw ?? "").normalize("NFC").replace(/[\u0000-\u001f\u007f\u200b-\u200d]/g, "").trim();
  if (!name || name.length > 50) throw new Error("유효한 학생 이름이 필요합니다.");
  return name;
}
function validSite(raw) {
  const u = new URL(String(raw ?? ""));
  if (u.origin !== ALLOWED_ORIGIN || u.search || u.hash || u.username || u.password) throw new Error("허용되지 않은 포털 주소입니다.");
  if (!/^\/(?:[A-Za-z0-9._~-]+\/)*portal\.html$/.test(u.pathname)) throw new Error("portal.html 경로가 필요합니다.");
  return u;
}
function headers(extra={}) {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "public, max-age=600",
    ...extra
  };
}
function render(name, site) {
  const title = "Young's Physics " + name + " 학생 학습페이지";
  const ogImage = new URL("assets/images/logo.png", site).href;
  const nameEsc = escapeHTML(title);
  const imageEsc = escapeHTML(ogImage);
  const descEsc = escapeHTML(DESCRIPTION);
  const siteLiteral = jsLiteral(site.href);
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">
<title>${nameEsc}</title>
<meta name="description" content="${descEsc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Young's Physics">
<meta property="og:title" content="${nameEsc}">
<meta property="og:description" content="${descEsc}">
<meta property="og:image" content="${imageEsc}">
<meta property="og:image:width" content="1000"><meta property="og:image:height" content="383">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${nameEsc}">
<meta name="twitter:description" content="${descEsc}">
<meta name="twitter:image" content="${imageEsc}">
<style>html,body{margin:0;min-height:100%;background:#f4f8ff;color:#092c62;font:16px/1.6 system-ui,"Noto Sans KR",sans-serif}body{display:grid;place-items:center}.card{margin:24px;padding:28px;max-width:490px;border-radius:20px;border:1px solid #ccdff8;background:white;box-shadow:0 15px 45px #0b37701c;text-align:center}.card img{width:85%;max-width:340px;height:auto}.card h1{font-size:21px}.card p{color:#526983}.card a{display:inline-block;background:#0866df;color:white;padding:11px 20px;border-radius:10px;font-weight:700;text-decoration:none}.card small{display:block;margin-top:20px;color:#63758d}</style>
</head><body><main class="card">
<img src="${imageEsc}" alt="Young's Physics">
<h1>${nameEsc}</h1><p id="message">학생 통합 학습 페이지로 이동하는 중입니다.</p>
<a href="${escapeHTML(site.href)}" id="go" rel="noreferrer">학생 학습 페이지 열기</a>
<small>페이지가 열리지 않으면 위 버튼을 눌러 주세요.</small></main>
<script>(function(){
  "use strict";
  var base=${siteLiteral};
  var fragment=String(window.location.hash||"");
  var params=new URLSearchParams(fragment.slice(1));
  var valid=/^sp_[A-Za-z0-9_-]{20,150}$/.test(params.get("id")||"") && /^[A-Za-z0-9_-]{24,180}$/.test(params.get("fp")||"");
  var button=document.getElementById("go");
  if(!valid){button.removeAttribute("href");document.getElementById("message").textContent="학생 인증 정보가 누락되었습니다. 교사에게 직접 링크를 다시 요청해 주세요.";return;}
  var destination=base+fragment;
  button.href=destination;
  // Workers 최상위 페이지에서는 Apps Script iframe sandbox 제한을 받지 않는다.
  window.location.replace(destination);
})();</script>
</body></html>`;
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ok:true, service:"youngs-physics-og", version:"3.6.7"}), {
        headers:{"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"}
      });
    }
    if (request.method !== "GET" || url.pathname !== "/p") {
      return new Response("Not Found", {status:404, headers:{"Cache-Control":"no-store"}});
    }
    try {
      const name=cleanName(url.searchParams.get("n"));
      const site=validSite(url.searchParams.get("site"));
      // fragment는 서버에 도착하지 않으며 의도적으로 읽거나 기록하지 않는다.
      return new Response(render(name,site), {status:200,headers:headers()});
    } catch (_) {
      return new Response("Invalid share URL", {status:400,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
    }
  }
};
