/**
 * Young's Physics v3.6.7 — 학생 이름이 표시되는 별도 OG 공유 링크 생성.
 * 중요: token, fp, api, sid는 URL의 fragment(#)에만 두므로 Worker 서버에 전송되지 않는다.
 */
(function (scope) {
  "use strict";
  const cfg = scope.YP_SHARE_CONFIG || {};
  function workerBase() {
    try {
      const url = new URL(String(cfg.previewBaseUrl || "").trim());
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return "";
      if (!/^[a-z0-9.-]+$/i.test(url.hostname)) return "";
      return url.origin;
    } catch (_) { return ""; }
  }
  function previewURL(student, directURL) {
    const base = workerBase();
    if (!base || !student || !student.name || !directURL) return "";
    try {
      const portal = new URL(String(directURL));
      if (portal.protocol !== "https:" || !/\/portal\.html$/i.test(portal.pathname)) return "";
      const fragment = new URLSearchParams(portal.hash.replace(/^#/, ""));
      if (!fragment.get("id") || !fragment.get("fp")) return "";
      const url = new URL("/p", base);
      url.searchParams.set("n", String(student.name).trim());
      url.searchParams.set("site", portal.origin + portal.pathname);
      // 브라우저만 보는 부분. HTTP 요청 및 카카오 OG 수집에는 포함되지 않는다.
      url.hash = fragment.toString();
      return url.toString();
    } catch (_) { return ""; }
  }
  function shareURL(student, directURL) { return previewURL(student, directURL) || directURL; }
  function copyText(student, directURL) {
    const generated = previewURL(student, directURL);
    return generated || ("Young's Physics " + String(student && student.name || "학생") + " 학생 학습페이지\n" + String(directURL || ""));
  }
  scope.YP_SHARE = Object.freeze({ isConfigured: () => !!workerBase(), previewURL, shareURL, copyText });
})(window);
