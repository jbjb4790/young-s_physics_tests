import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(import.meta.dirname,'..');
const source = fs.readFileSync(path.join(root,'site/assets/portal.js'),'utf8');
const html = fs.readFileSync(path.join(root,'site/portal.html'),'utf8');
const css = fs.readFileSync(path.join(root,'site/assets/styles.css'),'utf8');

function setup({popupBlocked=false,detailBehavior=null,reports=null}={}) {
  const elements = new Map();
  const dom = id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',onclick:null,isConnected:true,style:{},classList:{add(){},remove(){},toggle(){}}});return elements.get(id)};
  const report={reportToken:'rpt_ok_123',examId:'physics1-basic-total-mechanics',assessmentType:'comprehensive',courseId:'physics1-basic',title:'물리1 역학 총괄평가',shortTitle:'역학 총괄평가',section:'역학',score:87,maxScore:100,percent:87,counts:{full:19,partial:3,wrong:3},updatedAt:'2026-10-26T09:00:00Z'};
  const weekly={...report,reportToken:'weekly_123',examId:'physics1-basic-r07',assessmentType:'weekly',title:'물리1 7회차',shortTitle:'7회차',score:90,percent:90};
  const records = reports??[report,weekly];
  const calls=[],popups=[],notices=[];
  const fakePopup=()=>{
    const windowProxy={opener:{},closed:false,location:{replace(url){calls.push({type:'popup-nav',url})}},document:{title:'',body:{textContent:''}},close(){windowProxy.closed=true;calls.push({type:'popup-close'})}};
    popups.push(windowProxy);return popupBlocked?null:windowProxy;
  };
  const document={
    getElementById:dom,
    querySelectorAll(selector){
      // For test binding, extract the known report buttons from rendered HTML.
      const content=dom('portalTabContent').innerHTML;
      if(selector==='[data-open-tab]')return [];
      if(selector==='.portal-open-test'||selector==='.portal-open-report'){
        const className=selector.slice(1),items=[];
        for(const match of content.matchAll(/<button\b([^>]*)>/g)){
          const attrs=match[1];if(!new RegExp(`\\b${className}\\b`).test(attrs))continue;
          const token=/data-report-token="([^"]+)"/.exec(attrs)?.[1];
          if(!token)continue;
          items.push({dataset:{reportToken:token},textContent:className==='portal-open-report'?'성적표 바로 보기':'시험 결과·분석 보기',innerHTML:className==='portal-open-report'?'성적표 바로 보기 <span>↗</span>':'시험 결과·분석 보기',isConnected:true,disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},onclick:null});
        }
        calls.push({type:'bind',selector,items});return items;
      }
      return [];
    },
    querySelector(){return null},
    addEventListener(){}
  };
  const loc={href:'https://site.example/portal.html#id=stud_123&fp=stud_fp',assign(url){calls.push({type:'same-tab-nav',url})}};
  const YP={
    config:{reportPage:'report.html',portalPage:'portal.html',apiUrl:''},escapeHTML:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
    formatNumber:x=>String(x),getCourse:()=>({courseName:'물리1'}),normalizeSchool:s=>s,
    drawBarChart(){},drawRadarChart(){},
    buildPortalCumulativeComment:()=>'',toast(message){notices.push(String(message))}
  };
  const ctx={window:{open:fakePopup,location:loc},location:loc,document,URL,URLSearchParams,YP,YP_API:{apiUrl:'https://script.google.com/macros/s/DEPLOYTEST_x7/exec',async getStudentExamDetail(token,fp,rt){calls.push({type:'authorized-api',token,fp,rt});if(detailBehavior)return detailBehavior(token,fp,rt);return {record:{token:rt,fingerprint:'report-fingerprint_secret',examId:report.examId},serverInstanceId:'server-123'}}},console,Number,String,Math,setTimeout(){}};
  vm.createContext(ctx);
  vm.runInContext(source.replace('document.addEventListener("DOMContentLoaded",init);','globalThis.__portalTest={state,renderOverview,renderAssessmentList,testCard,bindTestButtons,openComprehensiveReport,renderTab,reportURL};'),ctx);
  const state=ctx.__portalTest.state;
  state.token='stud_123';state.fp='stud_fp';state.serverInstanceId='server-123';
  state.data={student:{name:'데모학생',school:'데모학교'},reports:records,cumulative:{testCount:records.length,weeklyCount:records.filter(x=>x.assessmentType!=='comprehensive').length,comprehensiveCount:records.filter(x=>x.assessmentType==='comprehensive').length,counts:{full:20,partial:2,wrong:2},averagePercent:88,latestPercent:90,units:[],strongUnits:[],weakUnits:[],trend:[]}};
  return {ctx,dom,calls,popups,notices,report,weekly};
}

test('총괄평가 카드는 성적표 CTA와 기존 시험 분석 CTA를 모두 제공, 주간 카드에는 기존 분석 CTA만 유지',()=>{
  const {ctx,report,weekly}=setup();
  const comp=ctx.__portalTest.testCard(report),week=ctx.__portalTest.testCard(weekly);
  assert.match(comp,/portal-open-report/);
  assert.match(comp,/성적표 바로 보기/);
  assert.match(comp,/portal-open-test/);
  assert.match(week,/portal-open-test/);
  assert.doesNotMatch(week,/portal-open-report|성적표 바로 보기/);
  assert.doesNotMatch(comp,/report-fingerprint_secret|\bfp=/);
});

test('기본 누적 화면에서 총괄평가를 별도로 먼저 보여주고 최근 주간 복습과 구분',()=>{
  const {ctx,dom}=setup();
  ctx.__portalTest.renderOverview();
  const page=dom('portalTabContent').innerHTML;
  const spotlight=page.indexOf('총괄평가 성적표 바로 보기'),chart=page.indexOf('portalTrendChart'),weekly=page.indexOf('최근 주간 복습 결과');
  assert.ok(spotlight>=0&&spotlight<chart&&chart<weekly);
  assert.match(page,/portal-comprehensive-spotlight/);
  assert.match(page,/data-open-tab="comprehensive"/);
  assert.match(page,/주간 복습 전체 보기/);
  assert.equal((page.match(/portal-open-report/g)||[]).length,1);
});

test('총괄 탭에서도 성적표 CTA를 상단으로 표시',()=>{
  const {ctx,dom}=setup();
  ctx.__portalTest.renderAssessmentList('comprehensive');
  const page=dom('portalTabContent').innerHTML;
  assert.match(page,/누적 데이터 기반 학습 코멘트|총괄평가 결과/);
  assert.ok(page.indexOf('portal-open-report')<page.indexOf('portal-open-test'));
});

test('학생 권한 검증 후에만 개별 성적표를 열고 fingerprint는 API 응답에서 획득',async()=>{
  const {ctx,calls,dom}=setup();
  ctx.__portalTest.renderAssessmentList('comprehensive');
  const buttons=calls.filter(x=>x.type==='bind'&&x.selector==='.portal-open-report').at(-1).items;
  assert.equal(buttons.length,1);
  await buttons[0].onclick();
  const api=calls.find(x=>x.type==='authorized-api');
  assert.equal(api.token,'stud_123');assert.equal(api.fp,'stud_fp');assert.equal(api.rt,'rpt_ok_123');
  const nav=calls.find(x=>x.type==='popup-nav');assert.ok(nav);
  const u=new URL(nav.url);
  assert.equal(u.pathname,'/report.html');
  const hash=new URLSearchParams(u.hash.slice(1));
  assert.equal(hash.get('id'),'rpt_ok_123');assert.equal(hash.get('fp'),'report-fingerprint_secret');
  assert.equal(hash.get('sid'),'server-123');
  assert.equal(hash.get('api'),'https://script.google.com/macros/s/DEPLOYTEST_x7/exec');
  assert.equal(buttons[0].disabled,false);
  assert.equal(buttons[0].attrs['aria-busy'],undefined);
});

test('잘못된 학생·시험 매칭 응답은 성적표를 열지 않고 팝업을 닫음',async()=>{
  const {ctx,calls,popups,notices}=setup({detailBehavior:async()=>({record:{token:'someone_elses_token',fingerprint:'must-not-leak',examId:'physics1-basic-total-mechanics'}})});
  await ctx.__portalTest.openComprehensiveReport('rpt_ok_123',{textContent:'성적표 바로 보기',innerHTML:'성적표 바로 보기',disabled:false,isConnected:true,setAttribute(){},removeAttribute(){}});
  assert.equal(calls.filter(x=>x.type==='popup-nav').length,0);
  assert.equal(popups[0].closed,true);
  assert.match(notices[0],/성적표 연결 정보를 확인/);
});

test('팝업 차단 시 인증을 거친 뒤 현재 탭으로 성적표 연결',async()=>{
  const {ctx,calls}=setup({popupBlocked:true});
  await ctx.__portalTest.openComprehensiveReport('rpt_ok_123',{textContent:'성적표 바로 보기',innerHTML:'성적표 바로 보기',disabled:false,isConnected:true,setAttribute(){},removeAttribute(){}});
  assert.equal(calls.filter(x=>x.type==='same-tab-nav').length,1);
  assert.equal(calls.filter(x=>x.type==='authorized-api').length,1);
});

test('총괄평가가 없는 학생의 누적 요약에는 빈 성적표 전용 영역을 표시하지 않음',()=>{
  const {ctx,dom}=setup({reports:[]});ctx.__portalTest.renderOverview();
  assert.doesNotMatch(dom('portalTabContent').innerHTML,/portal-comprehensive-spotlight/);
});

test('버전 갱신과 반응형·인쇄 스타일 확인; Apps Script 변경 없이 기존 보고서 페이지로 연결',()=>{
  assert.match(html,/assets\/portal\.js\?v=3\.7\.8/);
  assert.match(html,/assets\/styles\.css\?v=3\.7\.8/);
  assert.match(css,/portal-comprehensive-spotlight/);
  assert.match(css,/@media print\{\.portal-comprehensive-spotlight/);
  assert.match(source,/reportURL\(record\.token,record\.fingerprint\)/);
});
