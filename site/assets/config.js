(function(){
  const runtime=window.YP_RUNTIME_CONFIG||{};
  const runtimeUrl=String(runtime.apiUrl||"").trim();
  const legacyUrl=String(localStorage.getItem("yp_api_url")||"").trim();
  const apiUrl=runtimeUrl||legacyUrl;
  window.YP_CONFIG={
    apiUrl,
    demoMode:!apiUrl,
    apiUrlSource:runtimeUrl?"deployment":legacyUrl?"legacy-local":"none",
    sessionStorage:"yp_teacher_session_v1",
    sessionMetaStorage:"yp_teacher_session_meta_v1",
    catalogSyncStorage:"yp_catalog_sync_version_v1",
    legacyApiUrlStorage:"yp_api_url",
    cachePrefix:"yp_weekly_",
    reportPage:"report.html",
    appTitle:"Young's Physics 주간 기본 복습 테스트",
    buildVersion:String(runtime.buildVersion||"3.2.0-excel-batch-import")
  };
})();
