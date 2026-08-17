(function(){
  const runtime=window.YP_RUNTIME_CONFIG||{};
  const normalizeApiUrl=value=>{
    const url=String(value||"").trim().replace(/\/$/,"");
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)?url:"";
  };
  const runtimeUrl=normalizeApiUrl(runtime.apiUrl);
  const legacyUrl=normalizeApiUrl(localStorage.getItem("yp_api_url")||"");
  const isReportPage=/(?:^|\/)report\.html$/i.test(String(location.pathname||""));
  let linkUrl="",linkServerInstanceId="";
  if(isReportPage){
    try{
      const params=new URLSearchParams(location.hash.replace(/^#/,""));
      linkUrl=normalizeApiUrl(params.get("api"));
      linkServerInstanceId=String(params.get("sid")||"").trim();
    }catch(e){}
  }
  const production=String(location.protocol||"")==="https:"||/\.github\.io$/i.test(String(location.hostname||""));
  // 학생 링크에 기록된 /exec 주소를 최우선으로 사용한다. 이 주소는 비밀값이 아니며,
  // 링크를 만든 성적 DB와 조회 DB가 달라져 토큰을 찾지 못하는 문제를 방지한다.
  // 운영 Pages에서는 runtime-config가 있으면 오래된 localStorage 주소는 사용하지 않는다.
  const apiUrl=linkUrl||runtimeUrl||(!production?legacyUrl:"");
  window.YP_CONFIG={
    apiUrl,
    demoMode:!apiUrl,
    apiUrlSource:linkUrl?"report-link":runtimeUrl?"deployment":legacyUrl?"legacy-local":"none",
    linkApiUrl:linkUrl,
    linkServerInstanceId,
    runtimeApiUrl:runtimeUrl,
    legacyApiUrl:legacyUrl,
    sessionStorage:"yp_teacher_session_v1",
    sessionMetaStorage:"yp_teacher_session_meta_v1",
    catalogSyncStorage:"yp_catalog_sync_version_v1",
    legacyApiUrlStorage:"yp_api_url",
    cachePrefix:"yp_weekly_",
    reportPage:"report.html",
    appTitle:"Young's Physics 주간 기본 복습 테스트",
    buildVersion:String(runtime.buildVersion||"3.2.4-report-token-affinity")
  };
})();
