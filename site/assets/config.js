window.YP_CONFIG = {
  apiUrl: localStorage.getItem("yp_api_url") || "",
  demoMode: !(localStorage.getItem("yp_api_url") || ""),
  writeKeyStorage: "yp_write_key",
  apiUrlStorage: "yp_api_url",
  cachePrefix: "yp_weekly_",
  reportPage: "report.html",
  appTitle: "Young's Physics 주간 기본 복습 테스트"
};