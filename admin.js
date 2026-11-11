/* 관리자 화면: 대시보드 / 기사님 등록 / 운행 내역(대리 입력) / 설정 */
const AdminApp=(()=>{

/* 관리자 화면: 대시보드 / 기사님 등록 / 운행 내역(대리 입력) / 설정 */
const TABS=[["dash","대시보드","dash"],["list","운행 내역","list"],["rate","단가","won"],["reg","기사님","userplus"],["me","설정","me"]];
const S={imp:null,rates:{},rateDraft:null,drvDel:null,user:null,token:null,tab:"dash",month:ym(new Date()),trips:[],drivers:[],places:[],summary:[],loading:false,err:"",
  filter:"",panel:null,form:null,drvEdit:null,showOff:false,q:""};
const drv=id=>S.drivers.find(d=>d.id===id);
const sortedDrivers=all=>[...S.drivers].filter(d=>all||d.active).sort((a,b)=>(a.manager||"").localeCompare(b.manager||"","ko")||(a.sort??0)-(b.sort??0)||a.name.localeCompare(b.name,"ko"));
const managers=()=>[...new Set(sortedDrivers(true).map(d=>d.manager||"미지정"))];

async function load(){S.loading=true;render();
  try{const [t,d,p,s,r]=await Promise.all([rpc("lg_trips",{p_token:S.token,p_month:S.month}),rpc("lg_drivers_list",{p_token:S.token}),rpc("lg_places",{p_token:S.token}),
      rpc("lg_summary",{p_token:S.token,p_from:addMonth(S.month,-5),p_to:S.month}),rpc("lg_rates_list",{p_token:S.token})]);
    S.trips=t||[];S.drivers=d||[];S.places=p||[];S.summary=s||[];S.rates=Object.fromEntries((r||[]).map(x=>[x.driver_id,x]));S.rateDraft=null}catch(e){if(e.code!=="SESSION_EXPIRED")toast(e.message)}
  S.loading=false;render()}
async function reloadDrivers(){S.drivers=await rpc("lg_drivers_list",{p_token:S.token})}
function go(tab){S.drvDel=null;S.rateDraft=null;S.tab=tab;S.panel=null;S.form=null;scrollTo(0,0);if(tab==="dash"||tab==="list")load();else render()}

/* ---------- 틀 ---------- */
function render(){
  document.getElementById("demoBar").hidden=!DEMO;
  const app=document.getElementById("app");
  if(!S.user)return App.showLogin();
  if(S.user.must_change){document.body.classList.remove("has-tabs");
    app.innerHTML=`<div class="wrap"><div class="login"><p style="margin:0 0 12px"><b>${esc(S.user.name)}</b> 관리자님, 처음 로그인입니다.</p><div id="chg"></div><button class="btn" id="lo" style="margin-top:12px;width:100%">로그아웃</button></div></div>`;
    changeSecretForm(app.querySelector("#chg"),{token:S.token,driver:false,forced:true,onDone:()=>{S.user.must_change=false;load()}});app.querySelector("#lo").onclick=App.logout;return}
  document.body.classList.add("has-tabs");
  app.innerHTML=`<header class="top"><div class="wrap"><img class="hdLogo" src="shinshin-logo.png" alt="SHINSHIN"><h1>기사님 물류비 관리<small>${esc(S.user.name)} · 관리자</small></h1><button class="hbtn" id="logout">로그아웃</button></div></header>
  <div class="admin-shell">
    <aside class="side" aria-label="메뉴">${TABS.map(([k,l,ic])=>`<button data-tab="${k}" aria-current="${S.tab===k?"page":"false"}">${svgIcon(ic)}${l}</button>`).join("")}
      <div class="foot">기사님도 같은 주소에서 '기사님'으로 로그인합니다 · ${DEMO?"데모 모드":"운영 중"}</div></aside>
    <main><div class="wrap" id="view"></div></main>
  </div>
  <nav class="tabs" aria-label="화면"><div class="in">${TABS.map(([k,l,ic])=>`<button data-tab="${k}" aria-current="${S.tab===k?"page":"false"}">${svgIcon(ic)}${l}</button>`).join("")}</div></nav>`;
  app.querySelector("#logout").onclick=App.logout;
  app.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>go(b.dataset.tab));
  const v=app.querySelector("#view");
  ({dash:renderDash,reg:renderReg,list:renderList,rate:renderRate,me:renderMe})[S.tab](v);
}
function monthBar(extra=""){return `<div class="row" style="justify-content:space-between"><div class="monthbar" style="flex:0 0 auto"><button id="mP" aria-label="이전 달">‹</button><span>${S.month.slice(0,4)}년 ${Number(S.month.slice(5))}월</span><button id="mN" aria-label="다음 달">›</button></div>${extra}</div>`}
function bindMonth(v){v.querySelector("#mP").onclick=()=>{S.month=addMonth(S.month,-1);load()};v.querySelector("#mN").onclick=()=>{S.month=addMonth(S.month,1);load()}}
const loadingHtml='<div class="card empty"><b>불러오는 중…</b></div>';

/* ---------- 대시보드 ---------- */
function renderDash(v){
  const exp=`<button class="btn primary" id="exp" style="flex:0 0 auto">${Number(S.month.slice(5))}월 엑셀 내려받기</button>`;
  if(S.loading){v.innerHTML=monthBar()+loadingHtml;bindMonth(v);return}
  const trips=S.trips,blank=()=>({run:0,fuel:0,night:0,total:0,cnt:0,n:0,last:""});const per={};let tot=0,cnt=0;
  trips.forEach(t=>{const c=calc(t);tot+=c.total;cnt+=num(t.cnt);const p=per[t.driver_id]||(per[t.driver_id]=blank());p.run+=c.run;p.fuel+=c.fuel;p.night+=c.night;p.total+=c.total;p.cnt+=num(t.cnt);p.n++;if(t.trip_date>p.last)p.last=t.trip_date});
  const list=sortedDrivers(true).filter(d=>d.active||per[d.id]);
  const activeN=sortedDrivers(false).length,enteredN=list.filter(d=>per[d.id]).length;
  const max=Math.max(1,...Object.values(per).map(p=>p.total));const w=x=>(x/max*100).toFixed(1)+"%";
  const prevTot=S.summary.filter(s=>s.month===addMonth(S.month,-1)).reduce((a,s)=>a+num(s.total),0);
  const diff=prevTot?Math.round((tot-prevTot)/prevTot*100):null;
  const mg={};list.forEach(d=>{const k=d.manager||"미지정";const r=mg[k]||(mg[k]={total:0,n:0,cnt:0,people:0});const p=per[d.id]||blank();r.total+=p.total;r.n+=p.n;r.cnt+=p.cnt;r.people++});
  const missing=sortedDrivers(false).filter(d=>!per[d.id]);
  const G=list.reduce((g,d)=>{const p=per[d.id]||blank();["n","cnt","run","fuel","night","total"].forEach(k=>g[k]+=p[k]);return g},blank());
  const rows=list.map(d=>{const p=per[d.id]||blank();return `<tr class="click" data-drv="${esc(d.id)}"><td><b>${esc(d.name)}</b>${d.active?"":'<span class="chip off">중지</span>'}</td><td>${esc(d.manager||"-")}</td>
    <td class="n">${p.n}</td><td class="n">${p.cnt}</td><td class="n">${won(p.run)}</td><td class="n">${won(p.fuel)}</td><td class="n">${won(p.night)}</td><td class="n"><b>${won(p.total)}</b></td>
    <td style="width:110px"><div class="minibar"><i style="width:${w(p.run)};background:var(--bar)"></i><i style="width:${w(p.fuel)};background:var(--bar-2)"></i><i style="width:${w(p.night)};background:var(--amber)"></i></div></td></tr>`}).join("");
  v.innerHTML=`${monthBar(exp)}
  <div class="kpis four" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
    <div class="kpi main"><div class="l">${Number(S.month.slice(5))}월 정산액 합계</div><div class="v">${won(tot)}원</div><div class="s">${diff===null?"전월 자료 없음":`전월 대비 ${diff>=0?"+":""}${diff}%`}</div></div>
    <div class="kpi"><div class="l">운행 횟수</div><div class="v">${cnt}회</div><div class="s">입력 ${trips.length}건</div></div>
    <div class="kpi"><div class="l">입력한 기사님</div><div class="v">${enteredN} / ${activeN}명</div><div class="s">${missing.length?`미입력 ${missing.length}명`:"전원 입력"}</div></div>
    <div class="kpi"><div class="l">1회 평균 정산액</div><div class="v">${cnt?won(tot/cnt):0}원</div><div class="s">정산액 ÷ 운행 횟수</div></div>
  </div>
  ${noRateBanner()}
  <div class="dash-grid">
    <section class="card stack" style="gap:10px"><div class="row"><h2 style="flex:1">기사님별 정산</h2><div class="legend" style="flex:0 0 auto"><span><i style="background:var(--bar)"></i>운행비</span><span><i style="background:var(--bar-2)"></i>유류비</span><span><i style="background:var(--amber)"></i>야간</span></div></div>
      ${list.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>기사님</th><th>담당</th><th class="n">건수</th><th class="n">횟수</th><th class="n">운행비</th><th class="n">유류비</th><th class="n">야간</th><th class="n">정산액</th><th></th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><td>합계</td><td></td><td class="n">${G.n}</td><td class="n">${G.cnt}</td><td class="n">${won(G.run)}</td><td class="n">${won(G.fuel)}</td><td class="n">${won(G.night)}</td><td class="n">${won(G.total)}</td><td></td></tr></tfoot></table></div>
      <p class="muted" style="margin:0">줄을 누르면 그 기사님 운행 내역으로 갑니다.</p>`:`<div class="empty"><b>등록된 기사님이 없습니다</b><button class="btn primary" id="toReg" style="margin-top:8px">기사님 등록하기</button></div>`}
    </section>
    <div class="stack">
      <section class="card stack" style="gap:8px"><h2>담당자별</h2>${Object.entries(mg).map(([k,r])=>`<div class="mgr"><span>${esc(k)} <span class="muted">· ${r.people}명 · ${r.cnt}회</span></span><b>${won(r.total)}원</b></div>`).join("")||'<span class="muted">자료 없음</span>'}</section>
      <section class="card stack" style="gap:8px"><h2>이번 달 미입력 기사님</h2>${missing.length?`<div class="row" style="gap:6px;justify-content:flex-start">${missing.map(d=>`<span class="chip warn" style="margin:0;font-size:13px;padding:3px 10px">${esc(d.name)}</span>`).join("")}</div>`:'<span class="muted">모든 기사님이 입력했습니다.</span>'}</section>
      <section class="card stack" style="gap:8px"><h2>최근 6개월 정산액</h2><div class="chart">${trendChart()}</div></section>
    </div>
  </div>
  <section class="card stack" style="gap:8px"><h2>일자별 정산액 · 누적</h2><div class="chart">${dayChart(trips)}</div></section>`;
  bindMonth(v);bindNoRate(v);v.querySelector("#exp").onclick=()=>exportXlsx(S.month,S.trips,sortedDrivers(true));
  v.querySelectorAll("tr[data-drv]").forEach(r=>r.onclick=()=>{S.filter=r.dataset.drv;go("list")});
  const tr=v.querySelector("#toReg");if(tr)tr.onclick=()=>go("reg");
}
function axis(top,sy,L,W,R){let g="";for(let i=0;i<=4;i++){const val=top*i/4,yy=sy(val);g+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${L-6}" y="${yy+4}" text-anchor="end" font-size="10" fill="var(--muted)">${man(val)}</text>`}return g}
const nice=x=>{if(x<=0)return 100000;const p=Math.pow(10,Math.floor(Math.log10(x)));return [1,2,2.5,5,10].map(k=>k*p).find(k=>k>=x)};
function dayChart(trips){
  // 막대 = 일 정산액(왼쪽 축), 선 = 누적 정산액(오른쪽 축). 막대 위에 일 금액, 선 끝에 누적 합계 표시
  const [y,m]=S.month.split("-").map(Number),days=new Date(y,m,0).getDate(),vals=Array(days).fill(0);
  trips.forEach(t=>{const d=Number(String(t.trip_date).slice(8,10));if(d>=1&&d<=days)vals[d-1]+=calc(t).total});
  let run=0;const cum=vals.map(v=>run+=v);const max=Math.max(...vals),cmax=cum[days-1];
  const lastIdx=(()=>{const td=today();if(td.slice(0,7)===S.month)return Number(td.slice(8,10))-1;let k=-1;vals.forEach((v,i)=>{if(v>0)k=i});return S.month<td.slice(0,7)?days-1:k})();
  const W=980,H=280,L=56,R=64,T=30,B=30,pw=(W-L-R)/days,top=nice(max),ctop=nice(cmax),
    sy=v=>T+(H-T-B)*(1-v/top),cy=v=>T+(H-T-B)*(1-v/ctop),cx=i=>L+i*pw+pw/2;
  let g="",lbl="";
  for(let k=0;k<=4;k++){const yy=sy(top*k/4);g+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="var(--line)"/>
    <text x="${L-6}" y="${yy+4}" text-anchor="end" font-size="10" fill="var(--muted)">${Math.round(top*k/4/10000).toLocaleString("ko-KR")}</text>
    <text x="${W-R+6}" y="${yy+4}" text-anchor="start" font-size="10" fill="var(--amber)">${Math.round(ctop*k/4/10000).toLocaleString("ko-KR")}</text>`}
  vals.forEach((val,i)=>{const dt=`${S.month}-${String(i+1).padStart(2,"0")}`,we=/[일토]/.test(dayName(dt));
    if(val>0){g+=`<rect x="${(L+i*pw+pw*.15).toFixed(1)}" y="${sy(val).toFixed(1)}" width="${(pw*.7).toFixed(1)}" height="${(H-B-sy(val)).toFixed(1)}" rx="2" fill="var(--bar)"><title>${i+1}일 ${won(val)}원 · 누적 ${won(cum[i])}원</title></rect>`;
      lbl+=`<text x="${cx(i).toFixed(1)}" y="${(sy(val)-5).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--fg)" stroke="#2f3337" stroke-width="3" paint-order="stroke">${Math.round(val/10000).toLocaleString("ko-KR")}</text>`}
    g+=`<text x="${cx(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="10" fill="${we?"var(--bad)":"var(--muted)"}">${i+1}</text>`});
  if(cmax>0&&lastIdx>=0){const pts=cum.slice(0,lastIdx+1).map((c,i)=>`${cx(i).toFixed(1)},${cy(c).toFixed(1)}`).join(" ");
    g+=`<polyline points="${pts}" fill="none" stroke="var(--amber)" stroke-width="2.2" stroke-linejoin="round"/>`;
    cum.slice(0,lastIdx+1).forEach((c,i)=>{if(vals[i]>0||i===lastIdx)g+=`<circle cx="${cx(i).toFixed(1)}" cy="${cy(c).toFixed(1)}" r="${i===lastIdx?4:2.5}" fill="var(--amber)"><title>${i+1}일까지 누적 ${won(c)}원</title></circle>`});
    const lx=cx(lastIdx),ly=cy(cum[lastIdx]);const anchor=lx>W-R-90?"end":"start";
    lbl+=`<text x="${(lx+(anchor==="end"?-8:8)).toFixed(1)}" y="${(ly-10).toFixed(1)}" text-anchor="${anchor}" font-size="12.5" font-weight="700" fill="var(--amber)" stroke="#2f3337" stroke-width="4" paint-order="stroke">누적 ${won(cum[lastIdx])}원</text>`}
  g+=lbl;
  const legend=`<div class="legend" style="margin-bottom:6px"><span style="color:var(--fg)">단위: 만원</span><span><i style="background:var(--bar)"></i>일 정산액 (왼쪽 축)</span><span><i style="background:var(--amber);height:3px;vertical-align:3px"></i>누적 정산액 (오른쪽 축)</span><span class="phone-only">← 옆으로 밀어서 보기</span></div>`;
  const rows=vals.map((v,i)=>({d:`${S.month}-${String(i+1).padStart(2,"0")}`,v,c:cum[i]})).filter(r=>r.v>0);
  const table=rows.length?`<details style="margin-top:8px"><summary>날짜별 금액·누적 표 보기</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>날짜</th><th class="n">일 정산액</th><th class="n">누적 정산액</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>${r.d.slice(5).replace("-","/")} (${dayName(r.d)})</td><td class="n">${won(r.v)}원</td><td class="n">${won(r.c)}원</td></tr>`).join("")}</tbody>
    <tfoot><tr><td>합계</td><td class="n">${won(cmax)}원</td><td class="n">${won(cmax)}원</td></tr></tfoot></table></div></details>`:"";
  return legend+`<svg viewBox="0 0 ${W} ${H}" style="min-width:760px" role="img" aria-label="일자별 정산액과 누적 정산액">${g}</svg>`+(max===0?'<p class="muted" style="margin:4px 0 0">이 달에 입력된 운행이 아직 없습니다.</p>':"")+table;
}
function trendChart(){
  const months=[...Array(6)].map((_,i)=>addMonth(S.month,i-5));const vals=months.map(mo=>S.summary.filter(s=>s.month===mo).reduce((a,s)=>a+num(s.total),0));
  const max=Math.max(...vals),W=420,H=190,L=46,R=8,T=16,B=26,pw=(W-L-R)/6,top=nice(max),sy=val=>T+(H-T-B)*(1-val/top);let g=axis(top,sy,L,W,R);
  vals.forEach((val,i)=>{const cur=i===5;if(val>0){g+=`<rect x="${(L+i*pw+pw*.2).toFixed(1)}" y="${sy(val).toFixed(1)}" width="${(pw*.6).toFixed(1)}" height="${(H-B-sy(val)).toFixed(1)}" rx="3" fill="${cur?"var(--bar)":"var(--bar-2)"}"><title>${months[i]} ${won(val)}원</title></rect>`;
      g+=`<text x="${(L+i*pw+pw/2).toFixed(1)}" y="${(sy(val)-4).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--fg)">${man(val)}</text>`}
    g+=`<text x="${(L+i*pw+pw/2).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="11" fill="${cur?"var(--fg)":"var(--muted)"}" font-weight="${cur?700:400}">${Number(months[i].slice(5))}월</text>`});
  return `<svg viewBox="0 0 ${W} ${H}" style="min-width:300px" role="img" aria-label="최근 6개월 정산액">${g}</svg>`;
}

/* ---------- 기사님 등록 ---------- */
function delBox(){
  const d=S.drvDel&&drv(S.drvDel);if(!d)return "";const n=d.trip_count||0;
  return `<div class="confirm" id="delbox"><b style="color:var(--fg)">${esc(d.name)} 기사님을 삭제할까요?</b>
    ${n?`<span>이 기사님의 운행 내역이 <b>${n}건</b> 있습니다. 삭제하면 그 내역도 함께 지워지고 대시보드·엑셀 합계에서 빠지며, 되돌릴 수 없습니다.<br>지난 내역을 남기려면 <b>사용 중지</b>를 고르세요 (로그인만 막힘).</span>
      <div class="row"><button type="button" class="btn danger" data-delgo="all">내역까지 모두 삭제</button><button type="button" class="btn" id="delOff">사용 중지만</button><button type="button" class="btn" id="delNo">취소</button></div>`
    :`<span>운행 내역이 없는 기사님입니다. 삭제하면 계정이 없어지고 되돌릴 수 없습니다.</span>
      <div class="row"><button type="button" class="btn danger" data-delgo="one">삭제</button><button type="button" class="btn" id="delNo">취소</button></div>`}</div>`;
}
function renderReg(v){
  const e=S.drvEdit;
  let list=sortedDrivers(S.showOff);const q=S.q.trim();
  if(q)list=list.filter(d=>[d.name,d.login_id,d.manager,d.phone,d.car_no].some(x=>String(x||"").includes(q)));
  const status=d=>!d.active?'<span class="chip off" style="margin:0">사용 중지</span>':d.locked?'<span class="chip warn" style="margin:0">잠김</span>':d.must_change?'<span class="chip warn" style="margin:0">첫 로그인 전</span>':'<span class="chip ok" style="margin:0">사용 중</span>';
  v.innerHTML=`<div class="row"><h3 style="flex:1">기사님 등록</h3><span class="muted" style="flex:0 0 auto">사용 중 ${sortedDrivers(false).length}명 · 전체 ${S.drivers.length}명</span></div>
  <div class="reg-grid">
    <form id="df" class="card sticky" autocomplete="off">
      <h2>${e?esc(e.name)+" 기사님 정보 수정":"새 기사님 등록"}</h2>
      <div class="grid2"><label>이름 *<input id="dn" value="${esc(e?.name||"")}" required></label><label>담당자<input id="dm" list="dlM" value="${esc(e?e.manager:S.user.name)}"></label></div>
      <datalist id="dlM">${managers().map(m=>`<option value="${esc(m)}">`).join("")}</datalist>
      <div class="grid2"><label>로그인 아이디<input id="dl" value="${esc(e?.login_id||"")}" placeholder="비우면 이름으로"></label>
        <label>${e?"PIN 초기화":"처음 PIN *"}<input id="dp" inputmode="numeric" maxlength="6" class="pin" ${e?"":"required"} placeholder="${e?"바꿀 때만":"0000"}"></label></div>
      <div class="grid2"><label>연락처<input id="dph" type="tel" value="${esc(e?.phone||"")}" placeholder="010-0000-0000"></label><label>차량번호<input id="dc" value="${esc(e?.car_no||"")}" placeholder="예) 12가3456"></label></div>
      <label>메모<input id="dno" value="${esc(e?.note||"")}" placeholder="예) 1톤 탑차, 야간 전담"></label>
      <div class="grid2"><label>회당운행비 (단가)<input id="drp" type="number" inputmode="numeric" min="0" step="100" value="${esc(e?num(e.rate_per_run)||"":"")}" placeholder="0"></label><label>유류비지원금 (회당)<input id="drf" type="number" inputmode="numeric" min="0" step="100" value="${esc(e?num(e.rate_fuel)||"":"")}" placeholder="0"></label></div>
      <div class="grid2"><label>2단가 하루 기준 (회까지 1번 단가)<input id="drl" type="number" inputmode="numeric" min="0" step="1" value="${esc(e?num(e.rate_limit)||"":"")}" placeholder="안 씀"></label><label>2번 단가 (기준 초과분)<input id="dr2" type="number" inputmode="numeric" min="0" step="100" value="${esc(e?num(e.rate_per_run2)||"":"")}" placeholder="안 씀"></label></div>
      ${e?`<label class="check"><input type="checkbox" id="da" ${e.active?"checked":""}> 사용 중 (끄면 로그인할 수 없고, 지난 내역은 그대로 남습니다)</label>`:""}
      <p class="err" id="derr"></p>
      <div class="row"><button class="btn primary big" type="submit">${e?"저장":"등록"}</button>${e?'<button class="btn big" type="button" id="dcancel">취소</button>':""}</div>
      ${e?'<button class="btn danger" type="button" id="ddel">이 기사님 삭제</button>':""}
      <p class="muted" style="margin:0">${e?"PIN 칸에 숫자를 넣으면 그 번호로 초기화되고, 잠긴 계정도 풀립니다.":"등록한 뒤 아이디와 처음 PIN을 기사님께 알려 주세요. 기사님이 처음 로그인할 때 본인 PIN으로 바꿉니다."}</p>
    </form>
    <section class="card stack" style="gap:10px">
      ${delBox()}
      <div class="row"><input id="dq" type="search" placeholder="이름·연락처·차량번호 검색" value="${esc(S.q)}" style="flex:2"><label class="check" style="flex:0 0 auto"><input type="checkbox" id="doff" ${S.showOff?"checked":""}> 중지된 기사님도 보기</label></div>
      ${list.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>이름</th><th>아이디</th><th>담당</th><th>연락처</th><th>차량번호</th><th class="n">단가(운행/유류)</th><th>상태</th><th>마지막 입력</th><th></th></tr></thead><tbody>
      ${list.map(d=>`<tr><td class="wrap" style="min-width:90px"><b>${esc(d.name)}</b>${d.note?`<br><span class="muted">${esc(d.note)}</span>`:""}</td><td>${esc(d.login_id)}</td><td>${esc(d.manager||"-")}</td><td style="white-space:nowrap">${esc(d.phone||"-")}</td><td style="white-space:nowrap">${esc(d.car_no||"-")}</td><td class="n">${num(d.rate_per_run)||num(d.rate_fuel)?`${won(d.rate_per_run)} / ${won(d.rate_fuel)}${num(d.rate_limit)>0?`<br><span class="muted">${num(d.rate_limit)}회 초과 ${won(d.rate_per_run2)}</span>`:""}`:'<span class="chip warn" style="margin:0">미정</span>'}</td>
        <td>${status(d)}</td><td class="n">${d.last_trip?esc(String(d.last_trip).slice(5).replace("-","/")):"-"}</td><td><div class="row" style="flex-wrap:nowrap;gap:6px"><button class="btn small" data-ed="${esc(d.id)}">수정</button><button class="btn small danger" data-del="${esc(d.id)}">삭제</button></div></td></tr>`).join("")}</tbody></table></div>`
      :`<div class="empty"><b>${q?"검색 결과가 없습니다":"등록된 기사님이 없습니다"}</b>${q?"":"왼쪽(폰은 위쪽)에서 이름과 처음 PIN을 넣어 등록해 주세요."}</div>`}
    </section>
  </div>`;
  const askDel=id=>{S.drvDel=id;render();document.querySelector("#delbox")?.scrollIntoView({behavior:"smooth",block:"center"})};
  v.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>askDel(b.dataset.del));
  if(v.querySelector("#ddel"))v.querySelector("#ddel").onclick=()=>askDel(e.id);
  if(v.querySelector("#delNo"))v.querySelector("#delNo").onclick=()=>{S.drvDel=null;render()};
  v.querySelectorAll("[data-delgo]").forEach(b=>b.onclick=async()=>{const d=drv(S.drvDel);b.disabled=true;
    try{await rpc("lg_driver_delete",{p_token:S.token,p_id:d.id,p_with_trips:b.dataset.delgo==="all"});if(S.drvEdit?.id===d.id)S.drvEdit=null;S.drvDel=null;
      toast(`${d.name} 기사님을 삭제했습니다`);await load();S.tab="reg";render()}catch(err){b.disabled=false;toast(err.message)}});
  if(v.querySelector("#delOff"))v.querySelector("#delOff").onclick=async()=>{const d=drv(S.drvDel);
    try{await rpc("lg_driver_save",{p_token:S.token,p_driver:{id:d.id,name:d.name,login_id:d.login_id,manager:d.manager,phone:d.phone,car_no:d.car_no,note:d.note,active:false}});await reloadDrivers();S.drvDel=null;toast(`${d.name} 기사님을 사용 중지했습니다`);render()}catch(err){toast(err.message)}};
  v.querySelectorAll("[data-ed]").forEach(b=>b.onclick=()=>{S.drvDel=null;S.drvEdit=drv(b.dataset.ed);render();v.querySelector("#df")?.scrollIntoView({behavior:"smooth",block:"start"})});
  const dq=v.querySelector("#dq");dq.oninput=()=>{S.q=dq.value;const pos=dq.selectionStart;render();const n=document.querySelector("#dq");n.focus();n.setSelectionRange(pos,pos)};
  v.querySelector("#doff").onchange=ev=>{S.showOff=ev.target.checked;render()};
  if(v.querySelector("#dcancel"))v.querySelector("#dcancel").onclick=()=>{S.drvEdit=null;render()};
  v.querySelector("#df").onsubmit=async ev=>{ev.preventDefault();const $=id=>v.querySelector("#"+id).value.trim();const name=$("dn");
    const p={name,manager:$("dm"),login_id:$("dl")||name,pin:$("dp"),phone:$("dph"),car_no:$("dc"),note:$("dno"),rate_per_run:num($("drp")),rate_fuel:num($("drf")),rate_limit:num($("drl"))&&num($("dr2"))?num($("drl")):0,rate_per_run2:num($("drl"))&&num($("dr2"))?num($("dr2")):0};
    if(e){p.id=e.id;p.active=v.querySelector("#da").checked}
    try{await rpc("lg_driver_save",{p_token:S.token,p_driver:p});await reloadDrivers();S.drvEdit=null;
      toast(e?`${name} 기사님 정보를 저장했습니다`:`${name} 기사님을 등록했습니다 · 아이디 ${p.login_id} / PIN ${p.pin}`);render()}
    catch(err){v.querySelector("#derr").textContent=err.message}};
}

/* ---------- 운행 내역 / 대리 입력 ---------- */
function renderList(v){
  if(S.panel==="import")return renderImport(v);
  if(S.panel){
    v.innerHTML=`<div class="row"><h3 style="flex:1">${S.panel==="new"?"기사님 대신 입력":"운행 내역 수정"}</h3></div><div id="fb" style="max-width:640px"></div>`;
    tripForm(v.querySelector("#fb"),{form:S.form,editing:S.panel==="new"?null:S.panel,places:S.places,drivers:sortedDrivers(true),rates:S.rates,token:S.token,
      onSaved:rec=>{LS.set("lg_admin_drv",rec.driver_id);S.panel=null;S.form=null;S.month=rec.trip_date.slice(0,7);load()},
      onDeleted:()=>{S.panel=null;S.form=null;load()},onCancel:()=>{S.panel=null;S.form=null;render()}});
    return}
  const add=`<div class="row" style="flex:0 0 auto;gap:6px"><button class="btn" id="impTrip">엑셀로 입력</button><button class="btn primary" id="newTrip">+ 대신 입력</button></div>`;
  if(S.loading){v.innerHTML=monthBar(add)+loadingHtml;bindMonth(v);v.querySelector("#impTrip").onclick=()=>{S.panel="import";S.imp=null;render()};v.querySelector("#newTrip").disabled=true;return}
  let trips=[...S.trips];if(S.filter)trips=trips.filter(t=>t.driver_id===S.filter);
  trips.sort((a,b)=>b.trip_date.localeCompare(a.trip_date)||String(b.created_at).localeCompare(String(a.created_at)));
  const sum=trips.reduce((s,t)=>s+calc(t).total,0),cnt=trips.reduce((s,t)=>s+num(t.cnt),0);
  v.innerHTML=`${monthBar(add)}
  <div class="row"><label style="max-width:340px">기사님<select id="flt"><option value="">전체 기사님</option>${sortedDrivers(true).map(d=>`<option value="${esc(d.id)}" ${S.filter===d.id?"selected":""}>${esc(d.name)} (${esc(d.manager||"미지정")})${d.active?"":" - 중지"}</option>`).join("")}</select></label>
    <div class="muted" style="flex:0 0 auto;align-self:end;padding-bottom:10px">${trips.length}건 · ${cnt}회 · 합계 <b style="color:var(--fg);font-family:var(--mono)">${won(sum)}원</b></div></div>
  ${noRateBanner()}
  <section class="card">${trips.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>운행일</th><th>기사님</th><th>출발지 → 경유 → 납품거래처</th><th class="n">횟수</th><th class="n">회당</th><th class="n">유류(회당)</th><th class="n">야간</th><th class="n">정산액</th><th>비고</th></tr></thead><tbody>
    ${trips.map(t=>{const c=calc(t);return `<tr class="click" data-id="${esc(t.id)}"><td style="white-space:nowrap">${esc(t.trip_date.slice(5).replace("-","/"))} (${dayName(t.trip_date)})</td><td style="white-space:nowrap">${esc(drv(t.driver_id)?.name||"?")}${t.entered_by==="admin"?'<span class="chip">대리</span>':""}${!num(t.per_run)&&!num(t.fuel)?'<span class="chip warn">단가 없음</span>':""}</td>
      <td class="wrap" style="min-width:180px">${esc(route(t))}</td><td class="n">${num(t.cnt)}</td><td class="n">${won(t.per_run)}${c.hi?`<br><span class="muted" style="font-size:12px">${c.hi}회는 ${won(t.per_run2)}</span>`:""}</td><td class="n">${won(t.fuel)}</td><td class="n">${won(t.night)}</td><td class="n"><b>${won(c.total)}</b></td><td class="wrap">${esc(t.memo)}${t.start_time||t.end_time?`<br><span class="muted">${esc(t.start_time||"?")}~${esc(t.end_time||"?")}</span>`:""}</td></tr>`}).join("")}
    </tbody></table></div><p class="muted" style="margin:8px 0 0">줄을 누르면 고치거나 지울 수 있습니다.</p>`:'<div class="empty"><b>이 달 내역이 없습니다</b>기사님이 폰으로 입력하면 여기에 쌓입니다.</div>'}</section>`;
  bindMonth(v);bindNoRate(v);
  v.querySelector("#flt").onchange=e=>{S.filter=e.target.value;render()};
  v.querySelector("#impTrip").onclick=()=>{S.panel="import";S.imp=null;render();scrollTo(0,0)};
  v.querySelector("#newTrip").onclick=()=>{const last=S.filter||LS.get("lg_admin_drv");S.form=blankTrip(S.month,drv(last)?.active?last:"");S.panel="new";render();scrollTo(0,0)};
  v.querySelectorAll("tr[data-id]").forEach(r=>r.onclick=()=>{S.form={...S.trips.find(t=>t.id===r.dataset.id)};S.panel=r.dataset.id;render();scrollTo(0,0)});
}

/* ---------- 엑셀로 한꺼번에 입력 ---------- */
const IMP_COLS=["운행일","기사님","출발지명","납품거래처","경유1","경유2","경유3","경유4","횟수","운행 시작시간","운행 종료시간","회당운행비","유류비지원금","야간수당","비고"];
const IMP_ALIAS={trip_date:["운행일","날짜","일자","운행일자"],driver:["기사님","기사","기사명","기사 이름","이름"],from_name:["출발지명","출발지"],dest:["납품거래처","납품처","거래처"],
  via1:["경유1"],via2:["경유2"],via3:["경유3"],via4:["경유4"],cnt:["횟수","납품 횟수","납품횟수","회수"],start_time:["운행 시작시간","시작시간","운행시작","시작"],end_time:["운행 종료시간","종료시간","운행종료","종료"],
  per_run:["회당운행비","운행단가","단가"],fuel:["유류비지원금","유류비"],night:["야간수당","야간"],memo:["비고","메모"]};
function impTemplate(){
  if(typeof XLSX==="undefined")return toast("엑셀 도구를 불러오지 못했습니다");
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([IMP_COLS]);ws["!cols"]=IMP_COLS.map(h=>({wch:Math.max(10,h.length*2+2)}));XLSX.utils.book_append_sheet(wb,ws,"입력");
  const act=sortedDrivers(false),n=Math.max(act.length,ORIGINS.length,DESTS.length);
  const lst=[["기사님","출발지명","납품거래처"],...Array.from({length:n},(_,i)=>[act[i]?.name||"",ORIGINS[i]||"",DESTS[i]||""])];
  const w2=XLSX.utils.aoa_to_sheet(lst);w2["!cols"]=[{wch:12},{wch:22},{wch:26}];XLSX.utils.book_append_sheet(wb,w2,"목록");
  const guide=[["작성 방법"],["1. '입력' 시트 2번째 줄부터 한 줄에 운행 1건씩 적습니다."],["2. 운행일은 2026-11-20 처럼, 기사님·출발지명·납품거래처는 '목록' 시트의 이름 그대로 적습니다."],
    ["3. 횟수를 비우면 1회로 들어갑니다."],["4. 회당운행비·유류비지원금을 비우면 그 기사님 단가가 자동으로 들어갑니다 (2단가 기사님은 2단가도 자동)."],
    ["5. 다 적은 뒤 앱의 '엑셀로 입력'에서 이 파일을 올리면 미리보기로 확인하고 저장합니다."],["※ 앱에서 내려받은 엑셀의 '전체내역' 시트도 그대로 올릴 수 있습니다."]];
  const w3=XLSX.utils.aoa_to_sheet(guide);w3["!cols"]=[{wch:90}];XLSX.utils.book_append_sheet(wb,w3,"안내");
  const blob=new Blob([XLSX.write(wb,{type:"array",bookType:"xlsx"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="운행 일괄입력 양식.xlsx";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
function impDate(v){
  if(v instanceof Date&&!isNaN(v))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;
  if(typeof v==="number"&&v>20000&&v<80000){const d=new Date(Math.round((v-25569)*86400000));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`}
  const t=String(v??"").trim();let m=t.match(/^(\d{4})[.\-\/년\s]+(\d{1,2})[.\-\/월\s]+(\d{1,2})/);
  if(m)return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  m=t.match(/^(\d{1,2})[.\-\/월\s]+(\d{1,2})/);if(m)return `${S.month.slice(0,4)}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;
  return "";
}
function impTime(v){
  if(v instanceof Date&&!isNaN(v))return `${String(v.getHours()).padStart(2,"0")}:${String(v.getMinutes()).padStart(2,"0")}`;
  if(typeof v==="number"&&v>=0&&v<1){const mm=Math.round(v*1440);return `${String(Math.floor(mm/60)).padStart(2,"0")}:${String(mm%60).padStart(2,"0")}`}
  const m=String(v??"").trim().match(/^(\d{1,2})[:시]\s*(\d{1,2})?/);return m?`${m[1].padStart(2,"0")}:${String(m[2]||"0").padStart(2,"0")}`:"";
}
function impParse(buf,fileName){
  const wb=XLSX.read(buf,{type:"array",cellDates:false});
  // '입력' → '전체내역' → 첫 시트 순서로, 머리글 줄(운행일·기사님이 있는 줄)을 찾아 읽음
  const names=[...wb.SheetNames].sort((a,b)=>(b==="입력")-(a==="입력")||(b==="전체내역")-(a==="전체내역"));
  for(const sn of names){
    const aoa=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:""});
    const hi=aoa.findIndex(r=>r.some(c=>IMP_ALIAS.trip_date.includes(String(c).trim()))&&r.some(c=>IMP_ALIAS.driver.includes(String(c).trim())));
    if(hi<0)continue;
    const head=aoa[hi].map(c=>String(c).trim());const col={};
    Object.entries(IMP_ALIAS).forEach(([k,al])=>{const i=head.findIndex(h=>al.includes(h));if(i>=0)col[k]=i});
    if(col.dest===undefined){const i=head.indexOf("거래처");if(i>=0)col.dest=i}
    const rows=[];
    aoa.slice(hi+1).forEach((r,ri)=>{
      const g=k=>col[k]===undefined?"":r[col[k]];
      if(r.every(c=>String(c).trim()===""))return;
      const name=String(g("driver")).trim();if(!name&&!String(g("trip_date")).trim())return;
      const d=S.drivers.find(x=>x.name===name)||S.drivers.find(x=>x.login_id===name);
      const rec={driver_id:d?.id||"",trip_date:impDate(g("trip_date")),from_name:String(g("from_name")).trim(),dest:String(g("dest")).trim(),
        via1:String(g("via1")).trim(),via2:String(g("via2")).trim(),via3:String(g("via3")).trim(),via4:String(g("via4")).trim(),
        cnt:String(g("cnt")).trim()===""?1:num(g("cnt")),start_time:impTime(g("start_time")),end_time:impTime(g("end_time")),memo:String(g("memo")).trim()};
      if(String(g("per_run")).trim()!==""&&num(g("per_run"))>0)rec.per_run=num(g("per_run"));
      if(String(g("fuel")).trim()!==""&&num(g("fuel"))>0)rec.fuel=num(g("fuel"));
      if(String(g("night")).trim()!=="")rec.night=num(g("night"));
      const errs=[],warns=[];
      if(!d)errs.push(name?`'${name}' 기사님이 없습니다`:"기사님 이름이 없습니다");else if(!d.active)warns.push("사용 중지된 기사님");
      if(!rec.trip_date||isNaN(new Date(rec.trip_date+"T00:00")))errs.push("운행일을 읽을 수 없습니다");
      if(!rec.dest)errs.push("납품거래처가 없습니다");else if(!DESTS.includes(rec.dest))warns.push("납품거래처 목록에 없는 이름");
      if(rec.from_name&&!ORIGINS.includes(rec.from_name))warns.push("출발지 목록에 없는 이름");
      if(!(rec.cnt>0))errs.push("횟수가 0입니다");
      if(rec.trip_date&&S.trips.some(t=>t.driver_id===rec.driver_id&&t.trip_date===rec.trip_date&&t.dest===rec.dest&&num(t.cnt)===rec.cnt))warns.push("같은 내역이 이미 있음");
      rows.push({line:hi+ri+2,name,rec,errs,warns});
    });
    return {sheet:sn,file:fileName,rows};
  }
  throw new Error("머리글 줄(운행일·기사님)을 찾지 못했습니다. 양식 파일을 받아서 그 형식대로 적어 주세요.");
}
function renderImport(v){
  const imp=S.imp;
  const ok=imp?imp.rows.filter(r=>!r.errs.length):[],bad=imp?imp.rows.filter(r=>r.errs.length):[];
  v.innerHTML=`<div class="row"><h3 style="flex:1">엑셀로 한꺼번에 입력</h3><button class="btn" id="impBack" style="flex:0 0 auto">← 운행 내역</button></div>
  <section class="card stack" style="gap:10px">
    <h2>1. 양식 받기</h2>
    <p class="muted" style="margin:0">양식의 '입력' 시트에 한 줄에 운행 1건씩 적습니다. 회당운행비·유류비를 비우면 기사님 단가가 자동으로 들어갑니다. 앱에서 받은 엑셀의 '전체내역' 시트도 올릴 수 있습니다.</p>
    <div class="row" style="justify-content:flex-start"><button class="btn" id="impTpl" style="flex:0 0 auto">입력 양식 내려받기</button></div>
    <h2>2. 다 적은 엑셀 올리기</h2>
    <label class="btn primary" style="flex-direction:row;justify-content:center;color:var(--accent-fg);max-width:320px">엑셀 파일 선택<input type="file" id="impFile" accept=".xlsx,.xls,.csv" hidden></label>
  </section>
  ${imp?`<section class="card stack" style="gap:10px">
    <h2>3. 확인하고 저장 — ${esc(imp.file)} · '${esc(imp.sheet)}' 시트</h2>
    <div class="row" style="justify-content:flex-start;gap:8px"><span class="chip ok" style="margin:0;font-size:13px;padding:3px 10px;flex:0 0 auto">저장 가능 ${ok.length}건 · ${ok.reduce((a,r)=>a+num(r.rec.cnt),0)}회</span>${bad.length?`<span class="chip warn" style="margin:0;font-size:13px;padding:3px 10px;color:var(--bad);flex:0 0 auto">오류 ${bad.length}건 (저장 안 됨)</span>`:""}</div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>엑셀 줄</th><th>상태</th><th>운행일</th><th>기사님</th><th>출발지 → 납품거래처</th><th class="n">횟수</th><th class="n">회당운행비</th><th class="n">유류비</th><th class="n">야간</th><th>비고</th></tr></thead><tbody>
    ${imp.rows.map(r=>`<tr><td class="n">${r.line}</td><td class="wrap" style="min-width:120px">${r.errs.length?`<span style="color:var(--bad)">✕ ${esc(r.errs.join(", "))}</span>`:r.warns.length?`<span style="color:var(--amber)">확인: ${esc(r.warns.join(", "))}</span>`:'<span style="color:var(--good)">✓</span>'}</td>
      <td>${esc(r.rec.trip_date||"?")}</td><td>${esc(r.name||"?")}</td><td class="wrap" style="min-width:160px">${esc([r.rec.from_name,r.rec.via1,r.rec.via2,r.rec.via3,r.rec.via4,r.rec.dest].filter(Boolean).join(" → "))}</td>
      <td class="n">${num(r.rec.cnt)}</td><td class="n">${r.rec.per_run!=null?won(r.rec.per_run):'<span class="muted">단가 자동</span>'}</td><td class="n">${r.rec.fuel!=null?won(r.rec.fuel):'<span class="muted">자동</span>'}</td><td class="n">${r.rec.night!=null?won(r.rec.night):"0"}</td><td class="wrap">${esc(r.rec.memo)}</td></tr>`).join("")||'<tr><td colspan="10" class="muted">읽은 줄이 없습니다.</td></tr>'}
    </tbody></table></div>
    <p class="err" id="impErr"></p>
    <div class="row"><button class="btn primary big" id="impSave" ${ok.length?"":"disabled"}>${bad.length?`오류 줄은 빼고 ${ok.length}건 저장`:`${ok.length}건 저장`}</button><button class="btn big" id="impClear">다시 올리기</button></div>
  </section>`:""}`;
  v.querySelector("#impBack").onclick=()=>{S.panel=null;S.imp=null;render()};
  v.querySelector("#impTpl").onclick=impTemplate;
  v.querySelector("#impFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;
    if(typeof XLSX==="undefined")return toast("엑셀 도구를 불러오지 못했습니다");
    try{S.imp=impParse(await f.arrayBuffer(),f.name);render()}catch(err){toast(err.message||"엑셀 파일을 읽지 못했습니다")}};
  const c=v.querySelector("#impClear");if(c)c.onclick=()=>{S.imp=null;render()};
  const sv=v.querySelector("#impSave");if(sv)sv.onclick=async()=>{sv.disabled=true;
    try{const n=await rpc("lg_trips_import",{p_token:S.token,p_rows:ok.map(r=>r.rec)});
      const months=[...new Set(ok.map(r=>r.rec.trip_date.slice(0,7)))].sort();toast(`${n}건을 저장했습니다`);
      S.panel=null;S.imp=null;if(!months.includes(S.month))S.month=months[months.length-1];await load()}
    catch(err){sv.disabled=false;v.querySelector("#impErr").textContent=err.row?`${err.message} (미리보기의 ${ok[err.row-1]?.line??"?"}번째 엑셀 줄) — 아무것도 저장되지 않았습니다.`:err.message}};
}

/* ---------- 단가 미입력 알림 / 일괄 적용 ---------- */
function noRateBanner(){
  const miss=S.trips.filter(t=>!num(t.per_run)&&!num(t.fuel));if(!miss.length)return "";
  const can=miss.filter(t=>{const r=S.rates[t.driver_id];return r&&(num(r.per_run)||num(r.fuel))}).length;
  return `<div class="banner row" style="justify-content:space-between"><span style="flex:1 1 240px">금액이 비어 있는 운행 <b>${miss.length}건</b>이 있습니다.${can?` 그중 ${can}건은 기사님 단가로 채울 수 있습니다.`:" 단가 메뉴에서 기사님별 단가를 먼저 넣어 주세요."}</span>
    ${can?'<button class="btn primary small" id="applyRates" style="flex:0 0 auto">단가 일괄 적용</button>':'<button class="btn small" id="goRate" style="flex:0 0 auto">단가 넣으러 가기</button>'}</div>`;
}
function bindNoRate(v){
  const a=v.querySelector("#applyRates");if(a)a.onclick=async()=>{a.disabled=true;try{const n=await rpc("lg_rates_apply",{p_token:S.token,p_month:S.month,p_overwrite:false});toast(`${n}건에 단가를 넣었습니다`);load()}catch(e){a.disabled=false;toast(e.message)}};
  const g=v.querySelector("#goRate");if(g)g.onclick=()=>go("rate");
}

/* ---------- 기사님별 단가 ---------- */
function renderRate(v){
  const per={};S.trips.forEach(t=>{const p=per[t.driver_id]||(per[t.driver_id]={cnt:0,miss:0});p.cnt+=num(t.cnt);if(!num(t.per_run)&&!num(t.fuel))p.miss++});
  const list=sortedDrivers(true).filter(d=>d.active||per[d.id]);
  const dr=S.rateDraft||(S.rateDraft=Object.fromEntries(list.map(d=>{const r=S.rates[d.id]||{};return [d.id,{per_run:num(r.per_run)||"",fuel:num(r.fuel)||"",two:num(r.limit)>0,limit:num(r.limit)||3,per_run2:num(r.per_run2)||""}]})));
  const mo=Number(S.month.slice(5));
  v.innerHTML=`<div class="row"><h3 style="flex:1">기사님별 단가</h3></div>
  <p class="muted" style="margin:0">기사님마다 1회 기준 회당운행비·유류비지원금을 정해 두면, 그 기사님이 입력한 운행에 자동으로 붙습니다. <b>2단가</b>를 켜면 하루 기준 회수까지는 1번 단가, 그 이후 횟수는 2번 단가로 계산됩니다(하루 합계 기준, 입력 순서대로). 기사님 화면에는 금액이 보이지 않습니다.</p>
  <form id="rf" class="card stack" style="gap:10px">
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>기사님</th><th>담당</th><th class="n">회당운행비 (1번 단가)</th><th class="n">유류비지원금(회당)</th><th>2단가</th><th class="n">하루 기준</th><th class="n">2번 단가 (초과분)</th><th class="n">${mo}월 납품</th></tr></thead><tbody>
    ${list.map(d=>`<tr><td class="wrap" style="min-width:80px"><b>${esc(d.name)}</b>${d.active?"":'<span class="chip off">중지</span>'}${per[d.id]?.miss?`<span class="chip warn">금액 없음 ${per[d.id].miss}건</span>`:""}</td><td>${esc(d.manager||"-")}</td>
      <td><input type="number" inputmode="numeric" min="0" step="100" data-d="${esc(d.id)}" data-k="per_run" value="${esc(dr[d.id]?.per_run??"")}" placeholder="0" style="min-width:110px;text-align:right"></td>
      <td><input type="number" inputmode="numeric" min="0" step="100" data-d="${esc(d.id)}" data-k="fuel" value="${esc(dr[d.id]?.fuel??"")}" placeholder="0" style="min-width:110px;text-align:right"></td>
      <td><label class="check" style="white-space:nowrap"><input type="checkbox" data-two="${esc(d.id)}" ${dr[d.id]?.two?"checked":""}> 사용</label></td>
      <td class="n"><span style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap">${dr[d.id]?.two?"":'<span class="muted">-</span>'}<input type="number" inputmode="numeric" min="1" step="1" data-d="${esc(d.id)}" data-k="limit" value="${esc(dr[d.id]?.limit??3)}" style="width:64px;text-align:right" ${dr[d.id]?.two?"":"hidden"}>${dr[d.id]?.two?"회까지":""}</span></td>
      <td><input type="number" inputmode="numeric" min="0" step="100" data-d="${esc(d.id)}" data-k="per_run2" value="${esc(dr[d.id]?.per_run2??"")}" placeholder="0" style="min-width:110px;text-align:right" ${dr[d.id]?.two?"":"hidden"}></td>
      <td class="n">${per[d.id]?.cnt||0}회</td></tr>`).join("")||'<tr><td colspan="8" class="muted">등록된 기사님이 없습니다.</td></tr>'}</tbody></table></div>
    <label class="check"><input type="checkbox" id="rApply" checked> 저장하면서 ${mo}월 운행 중 금액이 비어 있는 내역에 바로 적용</label>
    <label class="check"><input type="checkbox" id="rOver"> ${mo}월 내역은 이미 들어간 금액도 새 단가로 바꾸기 (야간수당은 그대로)</label>
    <div class="row"><button class="btn primary big" type="submit">단가 저장</button><button class="btn big" type="button" id="rReset">되돌리기</button></div>
  </form>`;
  v.querySelectorAll("input[data-d]").forEach(inp=>inp.oninput=()=>{(dr[inp.dataset.d]=dr[inp.dataset.d]||{})[inp.dataset.k]=inp.value});
  v.querySelectorAll("input[data-two]").forEach(cb=>cb.onchange=()=>{const x=dr[cb.dataset.two]=dr[cb.dataset.two]||{};x.two=cb.checked;if(cb.checked&&!num(x.limit))x.limit=3;render()});
  v.querySelector("#rReset").onclick=()=>{S.rateDraft=null;render()};
  v.querySelector("#rf").onsubmit=async e=>{e.preventDefault();const btn=v.querySelector("#rf button[type=submit]");btn.disabled=true;
    try{await rpc("lg_rates_save",{p_token:S.token,p_rates:list.map(d=>{const x=dr[d.id]||{},two=!!x.two&&num(x.per_run2)>0&&num(x.limit)>0;return {driver_id:d.id,per_run:num(x.per_run),fuel:num(x.fuel),limit:two?num(x.limit):0,per_run2:two?num(x.per_run2):0}})});
      let msg="단가를 저장했습니다";const over=v.querySelector("#rOver").checked;
      if(v.querySelector("#rApply").checked||over){const n=await rpc("lg_rates_apply",{p_token:S.token,p_month:S.month,p_overwrite:over});msg+=` · ${mo}월 ${n}건 적용`}
      toast(msg);S.rateDraft=null;await load()}catch(err){btn.disabled=false;toast(err.message)}};
}

/* ---------- 설정 ---------- */
function renderMe(v){
  v.innerHTML=`<h3>설정</h3><div style="max-width:520px" class="stack"><div class="card"><b>${esc(S.user.name)}</b><span class="chip">관리자</span><br><span class="muted">아이디 ${esc(S.user.login_id)}</span></div><div id="chg"></div>
  <details class="card"><summary>서버 연결 (Supabase)</summary><form id="sf"><p class="muted" style="margin:0">보통은 config.js 파일에 넣어 두면 됩니다. 여기 넣은 값은 이 기기에만 저장됩니다.</p>
    <label>Project URL<input id="su" value="${esc(CFG.SUPABASE_URL||"")}" placeholder="https://xxxx.supabase.co"></label>
    <label>Publishable key<input id="sk" value="${esc(CFG.SUPABASE_KEY||"")}" placeholder="sb_publishable_…"></label>
    <div class="row"><button class="btn primary" type="submit">저장 후 다시 시작</button><button class="btn" type="button" id="sclr">이 기기 설정 지우기</button></div></form></details>
  <p class="muted" style="margin:0">현재 모드: ${DEMO?"데모 (이 기기에만 저장)":"운영 (Supabase 공용 저장소)"}</p></div>`;
  changeSecretForm(v.querySelector("#chg"),{token:S.token,driver:false,onDone:()=>render()});
  const sf=v.querySelector("#sf");sf.onsubmit=e=>{e.preventDefault();LS.set("lg_cfg",JSON.stringify({SUPABASE_URL:sf.querySelector("#su").value.trim(),SUPABASE_KEY:sf.querySelector("#sk").value.trim()}));LS.del("lg_session");location.reload()};
  v.querySelector("#sclr").onclick=()=>{LS.del("lg_cfg");LS.del("lg_session");location.reload()};
}


return{start(u,t){Object.assign(S,{user:u,token:t,tab:"dash",month:ym(new Date()),panel:null,form:null,drvEdit:null,filter:""});document.body.classList.add("admin");
  if(u.must_change)render();else load()},stop(){S.user=null;document.body.classList.remove("admin")}};
})();
