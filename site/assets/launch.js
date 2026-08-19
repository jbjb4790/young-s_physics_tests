(function(){
  "use strict";
  const params=new URLSearchParams(location.search||"");
  const queryChannel=String(params.get("ypBridgeChannel")||"").trim();
  const embedded=window.parent!==window&&(params.get("ypEmbedded")==="1"||!!queryChannel||sessionStorage.getItem("yp_hosted_bridge")==="1");
  if(embedded){
    if(queryChannel)sessionStorage.setItem("yp_hosted_bridge_channel",queryChannel);
    sessionStorage.setItem("yp_hosted_bridge","1");
    window.YP_HOSTED_BRIDGE=Object.freeze({
      enabled:true,
      channel:queryChannel||sessionStorage.getItem("yp_hosted_bridge_channel")||""
    });
    return;
  }
  window.YP_HOSTED_BRIDGE=Object.freeze({enabled:false,channel:""});

  const normalizeApiUrl=value=>{
    const url=String(value||"").trim().replace(/\/$/,"");
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)?url:"";
  };
  const runtime=window.YP_RUNTIME_CONFIG||{};
  let apiUrl=normalizeApiUrl(runtime.apiUrl);
  if(/(?:^|\/)report\.html$/i.test(String(location.pathname||""))){
    try{
      const hash=new URLSearchParams(location.hash.replace(/^#/,""));
      apiUrl=normalizeApiUrl(hash.get("api"))||apiUrl;
    }catch(e){}
  }
  if(!apiUrl)return;

  try{
    const site=new URL(location.href);
    site.searchParams.delete("ypEmbedded");
    site.searchParams.delete("ypBridgeChannel");
    const host=new URL(apiUrl);
    host.searchParams.set("view","host");
    host.searchParams.set("site",site.toString());
    location.replace(host.toString());
  }catch(e){
    console.error("Young's Physics hosted bridge launch failed",e);
  }
})();
