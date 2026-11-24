import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const bytes=f=>fs.readFileSync(path.join(ROOT,f));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hash=f=>sha(bytes(f));
const objectHash=o=>sha(JSON.stringify(o));
const deep=o=>JSON.parse(JSON.stringify(o));
const compact=s=>String(s).replace(/\s+/g,'');
const catalog=JSON.parse(read('site/assets/data/catalog.json'));
const baseline=JSON.parse(read('tests/fixtures/r03-basic-baseline-v3715.json'));
const assets=JSON.parse(read('docs/validation/physics2-basic-r03-original-assets.json'));
const ID='physics2-basic-r03';
const exam=catalog.exams.find(e=>e.examId===ID);
const context={window:{YP_CATALOG:catalog,YP_CONFIG:{}},console,URL,TextEncoder,TextDecoder,Blob,setTimeout,clearTimeout,navigator:{},document:{}};
vm.createContext(context);vm.runInContext(read('site/assets/core.js'),context);const YP=context.window.YP;
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

// Decode the actual PNG pixels using Node's built-ins; no browser, service or student data.
function decodePNG(file){
 const b=bytes(file);assert.deepEqual(b.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
 let width,height,depth,type,interlace,palette;const idat=[];
 for(let off=8;off<b.length;){const length=b.readUInt32BE(off),kind=b.toString('ascii',off+4,off+8),data=b.subarray(off+8,off+8+length);
  if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];type=data[9];interlace=data[12];}
  if(kind==='PLTE')palette=data;if(kind==='IDAT')idat.push(data);off+=12+length;
 }
 assert.equal(depth,8,'rendered assets must retain 8-bit pixels');assert.equal(interlace,0);
 const channels={0:1,2:3,3:1,4:2,6:4}[type];assert.ok(channels,'supported PNG color type');
 const raw=zlib.inflateSync(Buffer.concat(idat)),stride=width*channels,decoded=Buffer.alloc(stride*height),rgb=Buffer.alloc(width*height*3);
 assert.equal(raw.length,(stride+1)*height);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];assert.ok(filter<=4);
  for(let x=0;x<stride;x++){const index=y*stride+x,a=x>=channels?decoded[index-channels]:0,up=y?decoded[index-stride]:0,upperLeft=y&&x>=channels?decoded[index-stride-channels]:0;
   const adjustment=filter===0?0:filter===1?a:filter===2?up:filter===3?Math.floor((a+up)/2):paeth(a,up,upperLeft);
   decoded[index]=(raw[y*(stride+1)+1+x]+adjustment)&255;
  }
  for(let x=0;x<width;x++){const src=y*stride+x*channels,dst=(y*width+x)*3;
   if(type===2||type===6){decoded.copy(rgb,dst,src,src+3);}else if(type===3){assert.ok(palette);palette.copy(rgb,dst,decoded[src]*3,decoded[src]*3+3);}else{rgb[dst]=rgb[dst+1]=rgb[dst+2]=decoded[src];}
   if(type===4||type===6)assert.equal(decoded[src+channels-1],255,'source crops must be opaque');
  }
 }
 return {width,height,rgb};
}
const pngCache=new Map();
function png(relative){if(!pngCache.has(relative))pngCache.set(relative,decodePNG('site/'+relative));return pngCache.get(relative);}
function pixelCrop(img,[x,y,w,h]){assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=img.width&&y+h<=img.height);const out=Buffer.alloc(w*h*3);for(let row=0;row<h;row++)img.rgb.copy(out,row*w*3,((y+row)*img.width+x)*3,((y+row)*img.width+x+w)*3);return out;}

test('기존 물리2 3회 ID를 활성화: 원문8문항·20/10/10/10/10/10/10/20점·100점',()=>{
 assert.ok(exam);assert.equal(catalog.exams.filter(e=>e.examId===ID).length,1);
 assert.equal(exam.courseId,'physics2-basic');assert.equal(exam.round,3);assert.equal(exam.status,'ready');assert.equal(exam.assessmentType,'weekly');assert.equal(exam.section,'mechanics');
 assert.equal(exam.questionCount,8);assert.equal(exam.maxScore,100);assert.deepEqual(exam.questions.map(q=>q.no),[1,2,3,4,5,6,7,8]);assert.deepEqual(exam.questions.map(q=>q.maxPoints),[20,10,10,10,10,10,10,20]);
 assert.deepEqual(exam.questions[0].rubric.map(x=>x.points),[5,5,5,5]);assert.deepEqual(exam.questions[7].rubric.map(x=>x.points),[7,7,6]);
});
test('v3.7.15의 나머지46시험·기존 문항JSON31개·학생링크/서버/운영설정20개 보존',()=>{
 assert.equal(Object.keys(baseline.examHashes).length,47);let unchanged=0;
 for(const [id,expected] of Object.entries(baseline.examHashes)){if(id===ID)continue;const old=deep(catalog.exams.find(e=>e.examId===id));assert.ok(old,id);if(id==='physics2-advanced-total')old.historyExamIds=old.historyExamIds.filter(x=>x!=='physics2-advanced-r07');assert.equal(objectHash(old),expected,id);unchanged++;}assert.equal(unchanged,46);
 assert.equal(Object.keys(baseline.existingBankHashes).length,31);
 for(const [f,expected] of Object.entries(baseline.existingBankHashes))assert.equal(hash(f),expected,f);
 for(const [f,expected] of Object.entries(baseline.protectedSha))if(!['apps-script/Code.gs', 'site/assets/core.js', 'site/assets/api.js', 'site/assets/app.js', 'site/assets/report.js', 'site/assets/portal.js'].includes(f))assert.equal(hash(f),expected,f);
 assert.deepEqual(catalog.courses,baseline.courses);const previousPolicy=deep(catalog.operatingPolicy);previousPolicy.weeklyRounds['physics2-advanced']=previousPolicy.weeklyRounds['physics2-advanced'].filter(r=>r!==7);assert.deepEqual(previousPolicy,baseline.operatingPolicy);
});
test('49시험(보관1)·준비33시험·333문항 및 물리2 역학 총괄의 기존 r03 연결 유지',()=>{
 assert.equal(catalog.exams.length,49);assert.equal(catalog.exams.filter(e=>e.status==='ready').length,33);assert.equal(catalog.exams.filter(e=>e.status==='ready').flatMap(e=>e.questions||[]).length,333);
 const total=YP.getExam('physics2-basic-total-mechanics');assert.ok(total.historyExamIds.includes(ID));assert.equal(total.historyExamIds.length,8);
});
test('문제·해설 PDF는 첨부본과 SHA256 및 바이트수가 완전히 동일',()=>{
 for(const [kind,expected] of Object.entries(baseline.originalSources)){const b=bytes(expected.file);assert.equal(b.subarray(0,4).toString(),'%PDF');assert.equal(b.length,expected.size);assert.equal(sha(b),expected.sha256);assert.equal(assets[kind].sha256,expected.sha256);}
 assert.equal(exam.pdf,'assets/documents/physics2/r03-weekly-v3717-original.pdf');assert.equal(exam.solutionPdf,'assets/documents/physics2/r03-weekly-v3717-original-solution.pdf');
 assert.equal(hash('site/'+exam.pdf),baseline.originalSources.questionPdf.sha256);assert.equal(hash('site/'+exam.solutionPdf),baseline.originalSources.solutionPdf.sha256);
 assert.equal(exam.assetProvenance.redrawn,false);assert.equal(exam.assetProvenance.retypedQuestionText,false);
});
test('원본2쪽과 공유지문 합성2개를 기존 단일 crop API에 연결',()=>{
 assert.deepEqual(exam.pages,['assets/pages/physics2/r03-weekly-v3717-p1.png','assets/pages/physics2/r03-weekly-v3717-p2.png','assets/pages/physics2/r03-weekly-v3717-q05.png','assets/pages/physics2/r03-weekly-v3717-q07.png']);
 for(let i=0;i<exam.pages.length;i++){const rel=exam.pages[i],img=png(rel),meta=assets.pages[rel];assert.ok(meta,rel);assert.equal(hash('site/'+rel),meta.sha256,rel);assert.deepEqual([img.width,img.height],[meta.width,meta.height]);if(i<2)assert.deepEqual([img.width,img.height],[1653,2337]);}
 for(const q of exam.questions){assert.ok(q.image.page>=1&&q.image.page<=4);const image=png(exam.pages[q.image.page-1]),actual=pixelCrop(image,q.image.crop),recorded=assets.crops[String(q.no)];assert.deepEqual(q.image,{page:recorded.page,crop:recorded.crop});assert.equal(sha(actual),recorded.pixel_sha256,`Q${q.no} RGB pixels`);}
 assert.equal(exam.questions[4].image.page,3);assert.equal(exam.questions[6].image.page,4);
});
test('5·7번 공통지문과 개별문항의 모든 픽셀은 원본에서 무변형 복사·여백만 추가',()=>{
 for(const [index,sourcePage] of [[2,1],[3,2]]){const rel=exam.pages[index],image=png(rel),meta=assets.composites[rel];assert.ok(meta);assert.equal(meta.parts.length,2);assert.equal(meta.gap,16);
  const expected=Buffer.alloc(image.width*image.height*3,255);let priorBottom=0;
  for(const [partIndex,p] of meta.parts.entries()){assert.equal(p.sourcePage,sourcePage);const [dx,dy,w,h]=p.destination;assert.equal(p.sourceCrop[2],w);assert.equal(p.sourceCrop[3],h);assert.ok(dx>=0&&dy>=0&&dx+w<=image.width&&dy+h<=image.height);if(partIndex)assert.equal(dy-priorBottom,meta.gap);
   const original=pixelCrop(png(exam.pages[sourcePage-1]),p.sourceCrop);for(let y=0;y<h;y++)original.copy(expected,((dy+y)*image.width+dx)*3,y*w*3,(y+1)*w*3);priorBottom=dy+h;
  }
  assert.deepEqual(image.rgb,expected,rel);
  const shared=meta.parts[0].sourceCrop,question=meta.parts[1].sourceCrop;assert.ok(question[1]>shared[1]+shared[3]);
  // Independent PDF inspection placed shared passages near y=420pt and y=95pt.
  assert.ok(Math.abs(shared[1]-([0,420,95][sourcePage]*200/72))<12);
  assert.ok(Math.abs(question[1]-([0,675,527][sourcePage]*200/72))<12);
 }
});
test('독립 문항 JSON·catalog.js/json 일치 및 v3.7.18 카탈로그 캐시 갱신',()=>{
 assert.deepEqual(JSON.parse(read('site/assets/data/questions/physics2-basic-r03.json')),exam);
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(read('site/assets/data/catalog.js'),ctx);assert.deepEqual(deep(ctx.window.YP_CATALOG),catalog);
 assert.equal(JSON.parse(read('package.json')).version,'3.7.18');assert.equal(catalog.featureVersion,'3.7.18-physics2-advanced-r07');for(const p of ['index.html','report.html','portal.html'])assert.match(read('site/'+p),/catalog\.js\?v=3\.7\.18-r07/);
});
test('교사 만점/0점/P1/소수부분점수/공란과 초과점수 거절; 보너스 자동가산 없음',()=>{
 assert.equal(YP.calculateResult(exam,Array(8).fill('1')).score,100);assert.equal(YP.calculateResult(exam,Array(8).fill('0')).score,0);
 const result=YP.calculateResult(exam,['1','0','P1','4.5','1','7.5','','1']);assert.equal(result.valid,true);assert.equal(result.score,63);assert.equal(result.counts.ungraded,1);
 assert.equal(YP.parseQuestionInput('20.1',exam.questions[0]).valid,false);assert.equal(YP.parseQuestionInput('10.1',exam.questions[1]).valid,false);assert.equal(YP.parseQuestionInput('-1',exam.questions[1]).valid,false);
});
test('가상 신규성적 정규화와 역학누적에 연결해도 StudentId/token/fingerprint 불변',()=>{
 const source={examId:ID,courseId:exam.courseId,studentId:'synthetic-stable-id',token:'synthetic-stable-token',fingerprint:'synthetic-stable-fingerprint',name:'가상학생',school:'가상학교',resultInputs:Array(8).fill('1'),partialModes:Array(8).fill(false),createdAt:'2026-11-21T00:00:00Z',updatedAt:'2026-11-21T00:00:00Z'};
 const before=JSON.stringify(source),record=YP.normalizeRecord(source);assert.equal(record.score,100);for(const key of ['studentId','token','fingerprint'])assert.equal(record[key],source[key]);assert.equal(JSON.stringify(source),before);
 const other={...source,name:'다른가상학생',token:'synthetic-other-token'};const history=YP.computeHistorySummary(YP.getExam('physics2-basic-total-mechanics'),record,[source,other]);assert.equal(history.count,1);assert.equal(history.score,100);assert.equal(history.records[0].examId,ID);for(const key of ['studentId','token','fingerprint'])assert.equal(history.records[0][key],source[key]);
});
test('8문항 부분점수 합계·원문/동형16개의 객관식 유일 정답과 공개 가능 상태',()=>{
 for(const q of exam.questions){assert.equal(q.type,'subjective');assert.equal(q.inputMode,'achievement');assert.equal(q.rubric.reduce((sum,r)=>sum+r.points,0),q.maxPoints);assert.ok(q.explanation.length>=2);assert.ok(q.formulas.length>=1);assert.ok(q.commonMistakes.length>=1);assert.ok(!['ambiguous','needs-review'].includes(q.reviewStatus));
  for(const kind of ['originalRetry','similarProblem']){const challenge=q[kind];assert.equal(challenge.inputMode,'choice');assert.ok([4,5].includes(challenge.choices.length));assert.equal(new Set(challenge.choices.map(compact)).size,challenge.choices.length);assert.equal(challenge.answer,challenge.choices[challenge.correctChoice-1]);for(let i=1;i<=challenge.choices.length;i++)assert.equal(YP.checkChoiceAnswer(String(i),challenge),i===challenge.correctChoice);}
 }
});
test('포물선·수평투사·깃대 정답은 수직/수평 독립운동과 부합',()=>{
 const initial=20,theta=Math.PI/6,g=10,vy=initial*Math.sin(theta),vx=initial*Math.cos(theta),flight=2*vy/g;approx(vy/g,1);approx(vy*vy/(2*g),5);approx(flight,2);approx(vx*flight,20*Math.sqrt(3));
 const a=compact(exam.questions[0].answer);for(const expected of ['1s','5m','2s','20√3m'])assert.ok(a.includes(expected),expected);
 const fall=Math.sqrt(2*19.6/9.8);approx(fall,2);approx(20/fall,10);approx(9.8*fall,19.6);assert.ok(compact(exam.questions[3].answer).includes('10m/s'));assert.ok(compact(exam.questions[4].answer).includes('19.6m/s'));
 const total=2+4,horizontal=10/2,vertical=g*total/2;approx(horizontal*total,30);approx(vertical*2-g*2*2/2,40);assert.ok(compact(exam.questions[5].answer).includes('30m'));assert.ok(compact(exam.questions[6].answer).includes('40m'));
});
test('2번 실제 속력비4:1은 3h/5이며 해답의2:1 전제와 구분',()=>{
 const g=10,u=50,t=4,h=u*t,height=h-g*t*t/2;approx(g*t/(u-g*t),4);approx(height/h,3/5);
 const q=exam.questions[1];assert.equal(q.reviewStatus,'corrected');assert.ok(compact(q.answer).includes('3h/5'));assert.ok(compact(q.originalRetry.answer).includes('3h/5'));assert.match(q.explanation.join(' '),/4/);
 assert.doesNotMatch(compact(q.correctionNote),/3h\/5|2h\/3/,'pre-submit note must not reveal the answer');
});
test('8번은 높은궤도A 체공시간이 길고 여각에는 동일초속력 조건이 필요',()=>{
 const text=compact([exam.questions[7].answer,...exam.questions[7].explanation].join(' '));assert.match(text,/A.*>.*B|A.*길/);assert.match(text,/초기.*속력.*같|같.*초기.*속력|동일.*초기.*속력/);assert.match(text,/90/);
 // Same range alone admits non-complementary launch angles: tan(theta)=4H/R.
 const range=10,angleA=Math.atan(4*4/range),angleB=Math.atan(4*1/range);assert.ok(angleA>angleB);assert.ok(Math.abs(angleA+angleB-Math.PI/2)>0.1);
 approx(2*Math.sqrt(2*4/10)/(2*Math.sqrt(2*1/10)),2);
});
test('8번 공기저항 사거리는 부족한 조건을 명시하고 문제지7/7/6점을 사용',()=>{
 const q=exam.questions[7],text=[q.answer,...q.explanation].join(' ');assert.match(text,/공기.*저항|저항.*조건/);assert.match(text,/확정|단정|부족|불충분|판단.*(불가|수 없)/);
 assert.deepEqual(q.rubric.map(r=>r.points),[7,7,6]);assert.equal(q.maxPoints,20);
 assert.doesNotMatch(compact(q.correctionNote),/A>B|T_A>T_B|Tₐ>Tᵦ/,'pre-submit note must not reveal the answer');
});
