import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const code=read('apps-script/Code.gs');
const app=read('site/assets/app.js');
const portal=read('site/assets/portal.js');
const index=read('site/index.html');
const html=read('site/portal.html');

function renderShare(name){
  const start=code.indexOf('function studentPortalShareHtml_(');
  const end=code.indexOf('function escapeHtmlForMeta_(',start);
  assert.ok(start>=0&&end>start);
  const source=code.slice(start,end);
  const fakeService='https://script.google.com/macros/s/ABC123_x-9/exec';
  const ctx={
    findStudentProfileByPortal_:()=>({Name:name,PortalToken:'sp_demo_for_testing',PortalFingerprint:'fingerprint_demo_123'}),
    validateBridgeOrigin_:()=> 'https://jbjb4790.github.io',
    getServerInstanceId_:()=> 'dbid123456',
    constantTimeEqual_:(a,b)=>a===b,
    ScriptApp:{getService:()=>({getUrl:()=>fakeService})},
    HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput:html=>({html,setTitle(x){this.title=x;return this},setXFrameOptionsMode(x){this.frameMode=x;return this}})},
    escapeHtmlForMeta_:(value)=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  return ctx.studentPortalShareHtml_('token','fingerprint','https://jbjb4790.github.io/young-s_physics_tests/portal.html','dbid123456');
}

test('개인화 Open Graph 제목과 이미지 메타 유지',()=>{
  const out=renderShare('테스트학생');
  assert.match(out.html,/Young&#39;s Physics 테스트학생 학생 학습페이지/);
  assert.match(out.html,/property="og:title"/);
  assert.match(out.html,/property="og:image"/);
  assert.equal(out.frameMode,'ALLOWALL');
});

test('Apps Script 공유 페이지는 자동 iframe 리디렉션을 사용하지 않고 직접 포털 열기 버튼을 제공',()=>{
  const out=renderShare('테스트학생');
  assert.doesNotMatch(out.html,/window\.location\.replace|location\.assign|http-equiv="refresh"/);
  assert.match(out.html,/target="_blank" rel="noopener noreferrer"/);
  assert.match(out.html,/href="https:\/\/jbjb4790\.github\.io\/young-s_physics_tests\/portal\.html#id=/);
  assert.match(out.html,/학생 학습 페이지 열기/);
});

test('공유 페이지는 인코딩된 학생 토큰·지문과 서버 식별자를 보존',()=>{
  const out=renderShare('테스트학생');
  assert.match(out.html,/#id=sp_demo_for_testing&amp;fp=fingerprint_demo_123/);
  assert.match(out.html,/sid=dbid123456/);
  assert.match(out.html,/view=portalShare/);
});

test('학생 이름은 공유 메타 HTML에서 이스케이프 처리',()=>{
  const out=renderShare('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(out.html,/<img src=x onerror=alert\(1\)>/);
  assert.match(out.html,/&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('교사용 화면에서 안전한 기본 링크를 직접 복사할 수 있으며 열기 버튼은 공유 브리지를 거치지 않음',()=>{
  assert.match(index,/id="selectedStudentPortalDirectCopyBtn"/);
  assert.match(app,/data-student-action="copy-direct"/);
  assert.match(app,/portalDirectURL\(student\)/);
  assert.match(app,/student\?portalDirectURL\(student\):portal/);
  assert.match(app,/href="\$\{YP\.escapeHTML\(directUrl\)\}"/);
});

test('학생 포털에서도 공유 링크와 직접 링크 복사를 구분',()=>{
  assert.match(html,/id="portalCopyDirectBtn"/);
  assert.match(portal,/function portalShareURL/);
  assert.match(portal,/function portalDirectURL/);
  assert.match(portal,/YP\.copyText\(portalDirectURL\(\)\)/);
});

test('이전 Apps Script 공유 링크는 로컬 복구 도구에서 새 GitHub 직접 링크로 변환되며 구배포 API를 끌고 가지 않음',()=>{
  const html=read('tools/old-share-link-to-direct.html');
  assert.doesNotMatch(html,/\bfetch\s*\(|\bXMLHttpRequest\b|localStorage\./);
  const elements={};
  for(const id of ['src','result','convert','copy','open','status']){
    elements[id]={value:'',disabled:false,hidden:false,href:'',handlers:{},addEventListener(ev,cb){this.handlers[ev]=cb},select(){}};
  }
  const src='https://script.google.com/macros/s/oldDeploy_X1/exec?'+new URLSearchParams({
    view:'portalShare',token:'sp_test_t',fp:'fp_test_123',site:'https://jbjb4790.github.io/repo/portal.html',sid:'sameServer123'
  }).toString();
  elements.src.value=src;
  const ctx={document:{getElementById:id=>elements[id]},URL,URLSearchParams,navigator:{clipboard:{writeText:async()=>{}}}};
  vm.createContext(ctx);
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
  elements.convert.handlers.click();
  assert.match(elements.result.value,/^https:\/\/jbjb4790\.github\.io\/repo\/portal\.html#id=/);
  assert.match(elements.result.value,/fp=fp_test_123/);
  assert.match(elements.result.value,/sid=sameServer123/);
  assert.doesNotMatch(elements.result.value,/oldDeploy_X1/);
});
