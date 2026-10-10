import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../cloudflare-worker/index.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(dir,'../site/assets');
const shareJS = fs.readFileSync(path.join(assets,'share-link.js'),'utf8');
const directBase='https://jbjb4790.github.io/young-s_physics_tests/portal.html';
const tok='sp_'+ 'a'.repeat(40), fp='B'.repeat(43);
const api='https://script.google.com/macros/s/'+'C'.repeat(46)+'/exec';
const direct=directBase+'#'+new URLSearchParams({id:tok,fp,api,sid:'abc-def_2026'}).toString();
const student={name:'김물리',portalToken:tok,portalFingerprint:fp};
function browser(base) {let w={YP_SHARE_CONFIG:{previewBaseUrl:base},URL,URLSearchParams};w.window=w;vm.runInNewContext(shareJS,w);return w.YP_SHARE;}
const good=browser('https://youngs-og.example.workers.dev');

test('학생명은 쿼리이고 비밀 링크 값은 fragment에만 존재한다', () => {
 const generated=good.previewURL(student,direct),u=new URL(generated);
 assert.equal(u.origin,'https://youngs-og.example.workers.dev');
 assert.equal(u.pathname,'/p');
 assert.equal(u.searchParams.get('n'),'김물리');
 assert.equal(u.searchParams.get('site'),directBase);
 assert.ok(u.hash.includes(encodeURIComponent(api)));
 for(const secret of [tok,fp,api]) assert.equal(u.search.includes(secret),false);
 assert.equal(new URLSearchParams(u.hash.slice(1)).get('id'),tok);
 assert.equal(good.copyText(student,direct),generated);
});

test('Worker 응답이 JS 실행 없이 학생 이름 OG 태그를 반환한다',async()=>{
 const u=good.previewURL(student,direct);
 const r=await worker.fetch(new Request(u.split('#')[0]));
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-type'),/^text\/html/);
 const html=await r.text();
 assert.match(html,/<meta property="og:title" content="Young&#39;s Physics 김물리 학생 학습페이지">/);
 assert.match(html,/<meta property="og:image" content="https:\/\/jbjb4790.github.io\/young-s_physics_tests\/assets\/images\/logo.png">/);
 assert.match(html,/<title>Young&#39;s Physics 김물리 학생 학습페이지<\/title>/);
 assert.doesNotMatch(html,/<meta property="og:url"/);
 for(const secret of [tok,fp,api])assert.ok(!html.includes(secret),'OG 서버 HTML이 학생 링크 비밀값을 포함하면 안 됩니다');
 assert.match(html,/window.location.replace\(destination\)/);
 assert.match(html,/window.location.hash/);
});

test('서로 다른 학생 이름이면 OG 제목도 달라진다',async()=>{
 const a=await worker.fetch(new Request(good.previewURL({name:'이서준'},direct).split('#')[0]));
 const b=await worker.fetch(new Request(good.previewURL({name:'박지우'},direct).split('#')[0]));
 assert.match(await a.text(),/이서준 학생 학습페이지/);
 assert.match(await b.text(),/박지우 학생 학습페이지/);
});

test('HTML 인젝션 학생 이름도 OG 태그에서 안전하게 인코딩된다',async()=>{
 const u=good.previewURL({name:'홍<img src=x onerror=alert(1)>'},direct);
 const t=await (await worker.fetch(new Request(u.split('#')[0]))).text();
 assert.ok(t.includes('홍&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!t.includes('<img src=x onerror=alert(1)>'));
});

test('Worker는 외부 사이트로 임의 리디렉션을 허용하지 않는다',async()=>{
 for(const site of ['https://evil.example/portal.html', 'https://jbjb4790.github.io.evil.example/portal.html','http://jbjb4790.github.io/portal.html','https://jbjb4790.github.io/abc/other.html']) {
   const r=await worker.fetch(new Request('https://worker.example.workers.dev/p?n=%ED%99%8D%EA%B8%B8%EB%8F%99&site='+encodeURIComponent(site)));
   assert.equal(r.status,400,site);
 }
});

test('Worker health, unknown paths and invalid names',async()=>{
 const r=await worker.fetch(new Request('https://og.workers.dev/health'));
 assert.equal((await r.json()).ok,true);
 assert.equal((await worker.fetch(new Request('https://og.workers.dev/nope'))).status,404);
 assert.equal((await worker.fetch(new Request('https://og.workers.dev/p?n=&site='+encodeURIComponent(directBase)))).status,400);
});

test('미리보기 서버 미설정 시 학생명과 직접 링크를 문자로 복사한다',()=>{
 const fallback=browser('');
 assert.equal(fallback.isConfigured(),false);
 assert.equal(fallback.shareURL(student,direct),direct);
 assert.equal(fallback.copyText(student,direct),"Young's Physics 김물리 학생 학습페이지\n"+direct);
});

test('잘못된 설정 주소는 사용하지 않는다',()=>{
 for(const url of ['javascript:alert(1)','http://worker.invalid','https://user:pass@worker.invalid','not-a-url']){
  const b=browser(url);assert.equal(b.isConfigured(),false);
 }
});

test('운영 HTML은 공유 전용 스크립트를 앱 로딩 전에 읽는다',()=>{
 for(const page of ['index.html','portal.html']){
   const s=fs.readFileSync(path.join(dir,'../site',page),'utf8');
   assert.ok(s.indexOf('share-config.js?v=3.6.7')<s.indexOf('share-link.js?v=3.6.7'));
   const last = page==='index.html'?'app.js?v=3.6.6':'portal.js?v=3.6.9';
   assert.ok(s.indexOf('share-link.js?v=3.6.7')<s.indexOf(last));
 }
});

test('브라우저에서만 학생 토큰·지문을 재결합해 원래 학부모 페이지로 이동한다',async()=>{
 const sample=good.previewURL(student,direct), u=new URL(sample);
 const html=await (await worker.fetch(new Request(u.origin+u.pathname+u.search))).text();
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const button={href:'',removeAttribute(){this.href=''}};
 const message={textContent:''};
 let navigated='';
 const ctx={window:{location:{hash:u.hash,replace(x){navigated=x}}},document:{getElementById:id=>id==='go'?button:message},URLSearchParams};
 vm.runInNewContext(script,ctx);
 assert.equal(navigated,direct);
 assert.equal(button.href,direct);
});

test('메신저가 URL fragment를 누락했다면 학생정보를 임의 추정하지 않고 중단한다',async()=>{
 const u=new URL(good.previewURL(student,direct));
 const html=await (await worker.fetch(new Request(u.origin+u.pathname+u.search))).text();
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const button={href:'test',removeAttribute(){this.href=''}};
 const message={textContent:''};
 let navigated=false;
 const ctx={window:{location:{hash:'',replace(){navigated=true}}},document:{getElementById:id=>id==='go'?button:message},URLSearchParams};
 vm.runInNewContext(script,ctx);
 assert.equal(navigated,false);assert.equal(button.href,'');
 assert.match(message.textContent,/학생 인증 정보가 누락/);
});
