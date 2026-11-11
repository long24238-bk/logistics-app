/* 기사님 화면: 입력 / 내 내역 / 내 정보 */
const DriverApp=(()=>{
/* 달력·납품 현황 디자인 (style.css가 예전 파일이어도 모양이 깨지지 않게 여기서 직접 넣음) */
(()=>{if(document.getElementById("drv-style"))return;const st=document.createElement("style");st.id="drv-style";st.textContent=`/* 기사님 납품 현황 달력 */
.cal-h,.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal-h span{text-align:center;font-size:12px;color:var(--muted);padding-bottom:4px}
.cal-h .sun,.cal-d.sun .dn{color:var(--bad)} .cal-h .sat,.cal-d.sat .dn{color:#7fb2ff}
.cal-d{border:1px solid var(--line);background:var(--field);color:var(--fg);border-radius:8px;min-height:52px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;cursor:pointer;font:inherit;min-width:0}
.cal-d .dn{font-size:12px;color:var(--muted)}
.cal-d b{font-size:13px;color:#fff;background:var(--accent);border-radius:999px;padding:0 6px;line-height:1.5;font-variant-numeric:tabular-nums}
.cal-d.today{border-color:var(--accent)}
.cal-d.sel{outline:2px solid #fff;outline-offset:-2px}
.cal-d:not(.has) b{display:none}
.destrow{display:grid;grid-template-columns:minmax(0,1.4fr) 1fr auto;gap:10px;align-items:center;font-size:14px}
.destrow span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.destrow .bar{height:8px;background:var(--field);border-radius:4px;overflow:hidden}
.destrow .bar i{display:block;height:100%;background:var(--accent)}
.destrow b{font-variant-numeric:tabular-nums;min-width:3em;text-align:right}`;document.head.appendChild(st)})();

/* 기사님 전용 화면: 로그인 → 입력 / 내 내역 / 내 정보 */
const S={day:null,view:"cal",user:null,token:null,tab:"add",month:ym(new Date()),trips:[],places:[],loading:false,editing:null,form:null,err:""};

async function load(){S.loading=true;render();
  try{const [t,p]=await Promise.all([rpc("lg_trips",{p_token:S.token,p_month:S.month}),rpc("lg_places",{p_token:S.token})]);S.trips=t||[];S.places=p||[]}catch(e){if(e.code!=="SESSION_EXPIRED")toast(e.message)}
  S.loading=false;render()}
function go(tab){if(tab==="add"){S.editing=null;S.form=null}S.tab=tab;render();scrollTo(0,0)}

function render(){
  document.getElementById("demoBar").hidden=!DEMO;
  const app=document.getElementById("app");
  if(!S.user)return App.showLogin();
  if(S.user.must_change){document.body.classList.remove("has-tabs");
    app.innerHTML=`<div class="wrap"><div class="login"><p style="margin:0 0 12px"><b>${esc(S.user.name)}</b> 기사님, 환영합니다.</p><div id="chg"></div><button class="btn" id="lo" style="margin-top:12px;width:100%">로그아웃</button></div></div>`;
    changeSecretForm(app.querySelector("#chg"),{token:S.token,driver:true,forced:true,onDone:()=>{S.user.must_change=false;load()}});app.querySelector("#lo").onclick=App.logout;return}
  document.body.classList.add("has-tabs");
  const tabs=[["add","입력"],["list","납품 현황"],["me","내 정보"]];
  app.innerHTML=`<header class="top"><div class="wrap"><img class="hdLogo" src="shinshin-logo.png" alt="SHINSHIN"><h1>${esc(S.user.name)} 기사님<small>담당 ${esc(S.user.manager||"-")}</small></h1><button class="hbtn" id="logout">로그아웃</button></div></header>
  <main><div class="wrap" id="view"></div></main>
  <nav class="tabs" aria-label="화면"><div class="in">${tabs.map(([k,l])=>`<button data-tab="${k}" aria-current="${S.tab===k?"page":"false"}">${svgIcon(k)}${l}</button>`).join("")}</div></nav>`;
  app.querySelector("#logout").onclick=App.logout;app.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>go(b.dataset.tab));
  const v=app.querySelector("#view");
  if(S.tab==="add")renderAdd(v);else if(S.tab==="list")renderList(v);else renderMe(v);
}

function dayCount(date){return S.trips.filter(t=>t.trip_date===date).reduce((a,t)=>a+num(t.cnt),0)}
function renderAdd(v){
  if(!S.form)S.form=S.editing?{...S.trips.find(t=>t.id===S.editing)}:blankTrip(S.month);
  const td=today(),tc=S.month===td.slice(0,7)?dayCount(td):null;
  v.innerHTML=`${!S.editing&&tc!==null?`<div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi main" style="grid-column:auto"><div class="l">오늘 납품</div><div class="v">${tc}회</div></div><div class="kpi"><div class="l">이번 달 납품</div><div class="v">${S.trips.reduce((a,t)=>a+num(t.cnt),0)}회</div></div></div>`:""}
    <h2>${S.editing?"운행 내역 수정":"운행 입력"}</h2><div id="fb"></div>
    <p class="muted" style="margin:0">물류비 금액은 관리자가 단가에 맞춰 정산합니다.</p>`;
  tripForm(v.querySelector("#fb"),{form:S.form,editing:S.editing,places:S.places,token:S.token,
    onSaved:(rec,wasEdit)=>{S.editing=null;if(wasEdit){S.form=null;S.tab="list";S.day=rec.trip_date}else S.form={...blankTrip(S.month),trip_date:rec.trip_date,from_name:rec.from_name};S.month=rec.trip_date.slice(0,7);load()},
    onDeleted:()=>{S.editing=null;S.form=null;S.tab="list";load()},
    onCancel:S.editing?()=>{S.editing=null;S.form=null;go("list")}:null});
}
/* 납품 현황: 월별 합계 + 달력(일별 횟수) + 날짜별 목록 + 거래처별 횟수 */
function renderList(v){
  const mb=`<div class="monthbar"><button id="mP" aria-label="이전 달">‹</button><span>${S.month.slice(0,4)}년 ${Number(S.month.slice(5))}월</span><button id="mN" aria-label="다음 달">›</button></div>`;
  if(S.loading){v.innerHTML=mb+`<div class="card empty"><b>불러오는 중…</b></div>`;bindM(v);return}
  const trips=[...S.trips].sort((a,b)=>a.trip_date.localeCompare(b.trip_date)||String(a.created_at).localeCompare(String(b.created_at)));
  const byDay={};trips.forEach(t=>{(byDay[t.trip_date]=byDay[t.trip_date]||[]).push(t)});
  const total=trips.reduce((a,t)=>a+num(t.cnt),0),days=Object.keys(byDay).length;
  const byDest={};trips.forEach(t=>{const k=t.dest||"(미선택)";byDest[k]=(byDest[k]||0)+num(t.cnt)});
  const destRows=Object.entries(byDest).sort((a,b)=>b[1]-a[1]);const dmax=Math.max(1,...destRows.map(r=>r[1]));
  const [y,m]=S.month.split("-").map(Number),nd=new Date(y,m,0).getDate(),first=new Date(y,m-1,1).getDay(),td=today();
  if(S.day&&S.day.slice(0,7)!==S.month)S.day=null;
  let cal=`<div class="cal-h">${"일월화수목금토".split("").map((d,i)=>`<span class="${i===0?"sun":i===6?"sat":""}">${d}</span>`).join("")}</div><div class="cal">`;
  for(let i=0;i<first;i++)cal+=`<span class="cal-e"></span>`;
  for(let d=1;d<=nd;d++){const ds=`${S.month}-${String(d).padStart(2,"0")}`,c=byDay[ds]?byDay[ds].reduce((a,t)=>a+num(t.cnt),0):0,wd=(first+d-1)%7;
    cal+=`<button type="button" class="cal-d${c?" has":""}${ds===td?" today":""}${ds===S.day?" sel":""}${wd===0?" sun":wd===6?" sat":""}" data-day="${ds}"><span class="dn">${d}</span>${c?`<b>${c}회</b>`:""}</button>`}
  cal+=`</div>`;
  const dayList=(ds)=>{const ts=byDay[ds]||[];const c=ts.reduce((a,t)=>a+num(t.cnt),0);
    return `<div class="daylbl" style="display:flex;justify-content:space-between"><span>${ds.slice(5).replace("-","/")} (${dayName(ds)})</span><span style="color:var(--fg)">총 ${c}회</span></div>`+
      ts.map(t=>`<button class="trip" data-id="${esc(t.id)}"><span class="nm">${esc(t.dest||"(납품거래처 없음)")}</span><span class="amt">${num(t.cnt)}회</span>
      <span class="sub">${esc(t.from_name||"")}${[t.via1,t.via2,t.via3,t.via4].filter(Boolean).length?" · 경유 "+esc([t.via1,t.via2,t.via3,t.via4].filter(Boolean).join(", ")):""}${t.start_time||t.end_time?` · ${esc(t.start_time||"?")}~${esc(t.end_time||"?")}`:""}${t.memo?" · "+esc(t.memo):""}</span></button>`).join("")};
  let detail="";
  if(S.view==="cal"){detail=S.day?(byDay[S.day]?dayList(S.day):`<div class="empty"><b>${S.day.slice(5).replace("-","/")} (${dayName(S.day)}) 납품 없음</b><button class="btn primary" id="addDay" style="margin-top:8px">이 날짜로 입력하기</button></div>`)
      :'<p class="muted" style="margin:0">날짜를 누르면 그날 납품 내역이 나옵니다.</p>'}
  else detail=Object.keys(byDay).sort().reverse().map(dayList).join("")||'<div class="empty"><b>이 달 납품 내역이 없습니다</b>입력 탭에서 운행을 저장하면 여기에 쌓입니다.</div>';
  v.innerHTML=`${mb}
  <div class="kpis"><div class="kpi main"><div class="l">${m}월 납품 횟수</div><div class="v">${total}회</div></div><div class="kpi"><div class="l">운행한 날</div><div class="v">${days}일</div></div><div class="kpi"><div class="l">입력 건수</div><div class="v">${trips.length}건</div></div></div>
  <div class="seg" role="group" aria-label="보기"><button type="button" data-v="cal" aria-pressed="${S.view==="cal"}">달력으로 보기</button><button type="button" data-v="days" aria-pressed="${S.view==="days"}">날짜별 목록</button></div>
  ${S.view==="cal"?`<section class="card">${cal}</section>`:""}
  <section class="card">${detail}</section>
  ${destRows.length?`<section class="card stack" style="gap:8px"><h2>${m}월 납품거래처별 횟수</h2>${destRows.map(([k,c])=>`<div class="destrow"><span>${esc(k)}</span><span class="bar"><i style="width:${(c/dmax*100).toFixed(1)}%"></i></span><b>${c}회</b></div>`).join("")}</section>`:""}
  ${trips.length?'<p class="muted" style="margin:0">내역을 누르면 고치거나 지울 수 있습니다.</p>':""}`;
  bindM(v);
  v.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{S.view=b.dataset.v;render()});
  v.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{S.day=S.day===b.dataset.day?null:b.dataset.day;render()});
  v.querySelectorAll(".trip").forEach(b=>b.onclick=()=>{S.editing=b.dataset.id;S.form=null;S.tab="add";render();scrollTo(0,0)});
  const ad=v.querySelector("#addDay");if(ad)ad.onclick=()=>{S.editing=null;S.form={...blankTrip(S.month),trip_date:S.day};S.tab="add";render();scrollTo(0,0)};
}
function bindM(v){v.querySelector("#mP").onclick=()=>{S.month=addMonth(S.month,-1);S.day=null;load()};v.querySelector("#mN").onclick=()=>{S.month=addMonth(S.month,1);S.day=null;load()}}
function renderMe(v){
  v.innerHTML=`<div class="card"><b>${esc(S.user.name)}</b><span class="chip">담당 ${esc(S.user.manager||"-")}</span><br><span class="muted">아이디 ${esc(S.user.login_id)}</span></div><div id="chg"></div>`;
  changeSecretForm(v.querySelector("#chg"),{token:S.token,driver:true,onDone:()=>render()});
}


return{start(u,t){Object.assign(S,{user:u,token:t,tab:"add",month:ym(new Date()),form:null,editing:null,trips:[]});document.body.classList.remove("admin");
  if(u.must_change)render();else load()},stop(){S.user=null}};
})();
