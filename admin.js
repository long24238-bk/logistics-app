/* 관리자 화면: 대시보드 / 기사님 등록 / 운행 내역(대리 입력) / 설정 */
const AdminApp=(()=>{

/* 관리자 화면: 대시보드 / 기사님 등록 / 운행 내역(대리 입력) / 설정 */
const TABS=[["dash","대시보드","dash"],["list","운행 내역","list"],["rate","단가","won"],["reg","기사님","userplus"],["me","설정","me"]];
const S={rates:{},rateDraft:null,drvDel:null,user:null,token:null,tab:"dash",month:ym(new Date()),trips:[],drivers:[],places:[],summary:[],loading:false,err:"",
  filter:"",panel:null,form:null,drvEdit:null,showOff:false,q:""};
const drv=id=>S.drivers.find(d=>d.id===id);
const sortedDrivers=all=>[...S.drivers].filter(d=>all||d.active).sort((a,b)=>(a.manager||"").localeCompare(b.manager||"","ko")||(a.sort??0)-(b.sort??0)||a.name.localeCompare(b.name,"ko"));
const managers=()=>[...new Set(sortedDrivers(true).map(d=>d.manager||"미지정"))];

async function load(){S.loading=true;render();
  try{const [t,d,p,s,r]=await Promise.all([rpc("lg_trips",{p_token:S.token,p_month:S.month}),rpc("lg_drivers_list",{p_token:S.token}),rpc("lg_places",{p_token:S.token}),
      rpc("lg_summary",{p_token:S.token,p_from:addMonth(S.month,-5),p_to:S.month}),rpc("lg_rates_list",{p_token:S.token})]);
    S.trips=t||[];S.drivers=d||[];S.places=p||[];S.summary=s||[];S.rates=Object.fromEntries((r||[]).map(x=>[x.dest,x]))}catch(e){if(e.code!=="SESSION_EXPIRED")toast(e.message)}
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
    <text x="${L-6}" y="${yy+4}" text-anchor="end" font-size="10" fill="var(--muted)">${man(top*k/4)}</text>
    <text x="${W-R+6}" y="${yy+4}" text-anchor="start" font-size="10" fill="var(--amber)">${man(ctop*k/4)}</text>`}
  vals.forEach((val,i)=>{const dt=`${S.month}-${String(i+1).padStart(2,"0")}`,we=/[일토]/.test(dayName(dt));
    if(val>0){g+=`<rect x="${(L+i*pw+pw*.15).toFixed(1)}" y="${sy(val).toFixed(1)}" width="${(pw*.7).toFixed(1)}" height="${(H-B-sy(val)).toFixed(1)}" rx="2" fill="var(--bar)"><title>${i+1}일 ${won(val)}원 · 누적 ${won(cum[i])}원</title></rect>`;
      lbl+=`<text x="${cx(i).toFixed(1)}" y="${(sy(val)-5).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--fg)" stroke="#2f3337" stroke-width="3" paint-order="stroke">${man(val)}</text>`}
    g+=`<text x="${cx(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="10" fill="${we?"var(--bad)":"var(--muted)"}">${i+1}</text>`});
  if(cmax>0&&lastIdx>=0){const pts=cum.slice(0,lastIdx+1).map((c,i)=>`${cx(i).toFixed(1)},${cy(c).toFixed(1)}`).join(" ");
    g+=`<polyline points="${pts}" fill="none" stroke="var(--amber)" stroke-width="2.2" stroke-linejoin="round"/>`;
    cum.slice(0,lastIdx+1).forEach((c,i)=>{if(vals[i]>0||i===lastIdx)g+=`<circle cx="${cx(i).toFixed(1)}" cy="${cy(c).toFixed(1)}" r="${i===lastIdx?4:2.5}" fill="var(--amber)"><title>${i+1}일까지 누적 ${won(c)}원</title></circle>`});
    const lx=cx(lastIdx),ly=cy(cum[lastIdx]);const anchor=lx>W-R-90?"end":"start";
    lbl+=`<text x="${(lx+(anchor==="end"?-8:8)).toFixed(1)}" y="${(ly-10).toFixed(1)}" text-anchor="${anchor}" font-size="12.5" font-weight="700" fill="var(--amber)" stroke="#2f3337" stroke-width="4" paint-order="stroke">누적 ${won(cum[lastIdx])}원</text>`}
  g+=lbl;
  const legend=`<div class="legend" style="margin-bottom:6px"><span><i style="background:var(--bar)"></i>일 정산액 (왼쪽 축)</span><span><i style="background:var(--amber);height:3px;vertical-align:3px"></i>누적 정산액 (오른쪽 축)</span><span class="phone-only">← 옆으로 밀어서 보기</span></div>`;
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
      ${e?`<label class="check"><input type="checkbox" id="da" ${e.active?"checked":""}> 사용 중 (끄면 로그인할 수 없고, 지난 내역은 그대로 남습니다)</label>`:""}
      <p class="err" id="derr"></p>
      <div class="row"><button class="btn primary big" type="submit">${e?"저장":"등록"}</button>${e?'<button class="btn big" type="button" id="dcancel">취소</button>':""}</div>
      ${e?'<button class="btn danger" type="button" id="ddel">이 기사님 삭제</button>':""}
      <p class="muted" style="margin:0">${e?"PIN 칸에 숫자를 넣으면 그 번호로 초기화되고, 잠긴 계정도 풀립니다.":"등록한 뒤 아이디와 처음 PIN을 기사님께 알려 주세요. 기사님이 처음 로그인할 때 본인 PIN으로 바꿉니다."}</p>
    </form>
    <section class="card stack" style="gap:10px">
      ${delBox()}
      <div class="row"><input id="dq" type="search" placeholder="이름·연락처·차량번호 검색" value="${esc(S.q)}" style="flex:2"><label class="check" style="flex:0 0 auto"><input type="checkbox" id="doff" ${S.showOff?"checked":""}> 중지된 기사님도 보기</label></div>
      ${list.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>이름</th><th>아이디</th><th>담당</th><th>연락처</th><th>차량번호</th><th>상태</th><th>마지막 입력</th><th></th></tr></thead><tbody>
      ${list.map(d=>`<tr><td class="wrap" style="min-width:90px"><b>${esc(d.name)}</b>${d.note?`<br><span class="muted">${esc(d.note)}</span>`:""}</td><td>${esc(d.login_id)}</td><td>${esc(d.manager||"-")}</td><td style="white-space:nowrap">${esc(d.phone||"-")}</td><td style="white-space:nowrap">${esc(d.car_no||"-")}</td>
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
    const p={name,manager:$("dm"),login_id:$("dl")||name,pin:$("dp"),phone:$("dph"),car_no:$("dc"),note:$("dno")};
    if(e){p.id=e.id;p.active=v.querySelector("#da").checked}
    try{await rpc("lg_driver_save",{p_token:S.token,p_driver:p});await reloadDrivers();S.drvEdit=null;
      toast(e?`${name} 기사님 정보를 저장했습니다`:`${name} 기사님을 등록했습니다 · 아이디 ${p.login_id} / PIN ${p.pin}`);render()}
    catch(err){v.querySelector("#derr").textContent=err.message}};
}

/* ---------- 운행 내역 / 대리 입력 ---------- */
function renderList(v){
  if(S.panel){
    v.innerHTML=`<div class="row"><h3 style="flex:1">${S.panel==="new"?"기사님 대신 입력":"운행 내역 수정"}</h3></div><div id="fb" style="max-width:640px"></div>`;
    tripForm(v.querySelector("#fb"),{form:S.form,editing:S.panel==="new"?null:S.panel,places:S.places,drivers:sortedDrivers(true),rates:S.rates,token:S.token,
      onSaved:rec=>{LS.set("lg_admin_drv",rec.driver_id);S.panel=null;S.form=null;S.month=rec.trip_date.slice(0,7);load()},
      onDeleted:()=>{S.panel=null;S.form=null;load()},onCancel:()=>{S.panel=null;S.form=null;render()}});
    return}
  const add=`<button class="btn primary" id="newTrip" style="flex:0 0 auto">+ 대신 입력</button>`;
  if(S.loading){v.innerHTML=monthBar(add)+loadingHtml;bindMonth(v);return}
  let trips=[...S.trips];if(S.filter)trips=trips.filter(t=>t.driver_id===S.filter);
  trips.sort((a,b)=>b.trip_date.localeCompare(a.trip_date)||String(b.created_at).localeCompare(String(a.created_at)));
  const sum=trips.reduce((s,t)=>s+calc(t).total,0),cnt=trips.reduce((s,t)=>s+num(t.cnt),0);
  v.innerHTML=`${monthBar(add)}
  <div class="row"><label style="max-width:340px">기사님<select id="flt"><option value="">전체 기사님</option>${sortedDrivers(true).map(d=>`<option value="${esc(d.id)}" ${S.filter===d.id?"selected":""}>${esc(d.name)} (${esc(d.manager||"미지정")})${d.active?"":" - 중지"}</option>`).join("")}</select></label>
    <div class="muted" style="flex:0 0 auto;align-self:end;padding-bottom:10px">${trips.length}건 · ${cnt}회 · 합계 <b style="color:var(--fg);font-family:var(--mono)">${won(sum)}원</b></div></div>
  ${noRateBanner()}
  <section class="card">${trips.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>운행일</th><th>기사님</th><th>출발지 → 경유 → 납품거래처</th><th class="n">횟수</th><th class="n">회당</th><th class="n">유류(회당)</th><th class="n">야간</th><th class="n">정산액</th><th>비고</th></tr></thead><tbody>
    ${trips.map(t=>{const c=calc(t);return `<tr class="click" data-id="${esc(t.id)}"><td style="white-space:nowrap">${esc(t.trip_date.slice(5).replace("-","/"))} (${dayName(t.trip_date)})</td><td style="white-space:nowrap">${esc(drv(t.driver_id)?.name||"?")}${t.entered_by==="admin"?'<span class="chip">대리</span>':""}${!num(t.per_run)&&!num(t.fuel)?'<span class="chip warn">단가 없음</span>':""}</td>
      <td class="wrap" style="min-width:180px">${esc(route(t))}</td><td class="n">${num(t.cnt)}</td><td class="n">${won(t.per_run)}</td><td class="n">${won(t.fuel)}</td><td class="n">${won(t.night)}</td><td class="n"><b>${won(c.total)}</b></td><td class="wrap">${esc(t.memo)}${t.start_time||t.end_time?`<br><span class="muted">${esc(t.start_time||"?")}~${esc(t.end_time||"?")}</span>`:""}</td></tr>`}).join("")}
    </tbody></table></div><p class="muted" style="margin:8px 0 0">줄을 누르면 고치거나 지울 수 있습니다.</p>`:'<div class="empty"><b>이 달 내역이 없습니다</b>기사님이 폰으로 입력하면 여기에 쌓입니다.</div>'}</section>`;
  bindMonth(v);bindNoRate(v);
  v.querySelector("#flt").onchange=e=>{S.filter=e.target.value;render()};
  v.querySelector("#newTrip").onclick=()=>{const last=S.filter||LS.get("lg_admin_drv");S.form=blankTrip(S.month,drv(last)?.active?last:"");S.panel="new";render();scrollTo(0,0)};
  v.querySelectorAll("tr[data-id]").forEach(r=>r.onclick=()=>{S.form={...S.trips.find(t=>t.id===r.dataset.id)};S.panel=r.dataset.id;render();scrollTo(0,0)});
}

/* ---------- 단가 미입력 알림 / 일괄 적용 ---------- */
function noRateBanner(){
  const miss=S.trips.filter(t=>!num(t.per_run)&&!num(t.fuel));if(!miss.length)return "";
  const can=miss.filter(t=>S.rates[t.dest]).length;
  return `<div class="banner row" style="justify-content:space-between"><span style="flex:1 1 240px">금액이 비어 있는 운행 <b>${miss.length}건</b>이 있습니다.${can?` 그중 ${can}건은 단가표로 채울 수 있습니다.`:" 단가 메뉴에서 납품거래처 단가를 먼저 넣어 주세요."}</span>
    ${can?'<button class="btn primary small" id="applyRates" style="flex:0 0 auto">단가 일괄 적용</button>':'<button class="btn small" id="goRate" style="flex:0 0 auto">단가 넣으러 가기</button>'}</div>`;
}
function bindNoRate(v){
  const a=v.querySelector("#applyRates");if(a)a.onclick=async()=>{a.disabled=true;try{const n=await rpc("lg_rates_apply",{p_token:S.token,p_month:S.month,p_overwrite:false});toast(`${n}건에 단가를 넣었습니다`);load()}catch(e){a.disabled=false;toast(e.message)}};
  const g=v.querySelector("#goRate");if(g)g.onclick=()=>go("rate");
}

/* ---------- 납품거래처 단가 ---------- */
function renderRate(v){
  const list=[...DESTS,...Object.keys(S.rates).filter(d=>!DESTS.includes(d))];
  const dr=S.rateDraft||(S.rateDraft=Object.fromEntries(list.map(d=>[d,{per_run:S.rates[d]?.per_run??"",fuel:S.rates[d]?.fuel??""}])));
  const cnt=d=>S.trips.filter(t=>t.dest===d).reduce((a,t)=>a+num(t.cnt),0);
  v.innerHTML=`<div class="row"><h3 style="flex:1">납품거래처 단가</h3></div>
  <p class="muted" style="margin:0">기사님이 운행을 입력하면 여기 단가(1회 기준)가 자동으로 붙습니다. 기사님 화면에는 금액이 보이지 않습니다. 야간수당이나 예외 금액은 '운행 내역'에서 건별로 고치면 됩니다.</p>
  <form id="rf" class="card stack" style="gap:10px">
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>납품거래처</th><th class="n">회당운행비</th><th class="n">유류비지원금(회당)</th><th class="n">이달 납품</th></tr></thead><tbody>
    ${list.map((d,i)=>`<tr><td class="wrap" style="min-width:140px">${esc(d)}${DESTS.includes(d)?"":' <span class="chip off">목록에 없음</span>'}</td>
      <td><input type="number" inputmode="numeric" min="0" step="100" data-i="${i}" data-k="per_run" value="${esc(dr[d].per_run)}" placeholder="0" style="min-width:110px;text-align:right"></td>
      <td><input type="number" inputmode="numeric" min="0" step="100" data-i="${i}" data-k="fuel" value="${esc(dr[d].fuel)}" placeholder="0" style="min-width:110px;text-align:right"></td>
      <td class="n">${cnt(d)}회</td></tr>`).join("")}</tbody></table></div>
    <label class="check"><input type="checkbox" id="rApply" checked> 저장하면서 ${Number(S.month.slice(5))}월 운행 중 금액이 비어 있는 내역에 바로 적용</label>
    <label class="check"><input type="checkbox" id="rOver"> ${Number(S.month.slice(5))}월 내역은 이미 들어간 금액도 새 단가로 바꾸기 (야간수당은 그대로)</label>
    <div class="row"><button class="btn primary big" type="submit">단가 저장</button><button class="btn big" type="button" id="rReset">되돌리기</button></div>
  </form>`;
  v.querySelectorAll("input[data-i]").forEach(inp=>inp.oninput=()=>{dr[list[inp.dataset.i]][inp.dataset.k]=inp.value});
  v.querySelector("#rReset").onclick=()=>{S.rateDraft=null;render()};
  v.querySelector("#rf").onsubmit=async e=>{e.preventDefault();const btn=e.submitter||v.querySelector("#rf button[type=submit]");btn.disabled=true;
    try{await rpc("lg_rates_save",{p_token:S.token,p_rates:list.map(d=>({dest:d,per_run:num(dr[d].per_run),fuel:num(dr[d].fuel)}))});
      let msg="단가를 저장했습니다";const over=v.querySelector("#rOver").checked;
      if(v.querySelector("#rApply").checked||over){const n=await rpc("lg_rates_apply",{p_token:S.token,p_month:S.month,p_overwrite:over});msg+=` · ${Number(S.month.slice(5))}월 ${n}건 적용`}
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
