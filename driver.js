/* 기사님 화면: 입력 / 내 내역 / 내 정보 */
const DriverApp=(()=>{

/* 기사님 전용 화면: 로그인 → 입력 / 내 내역 / 내 정보 */
const S={user:null,token:null,tab:"add",month:ym(new Date()),trips:[],places:[],loading:false,editing:null,form:null,err:""};

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
  const tabs=[["add","입력"],["list","내 내역"],["me","내 정보"]];
  app.innerHTML=`<header class="top"><div class="wrap"><img class="hdLogo" src="shinshin-logo.png" alt="SHINSHIN"><h1>${esc(S.user.name)} 기사님<small>담당 ${esc(S.user.manager||"-")}</small></h1><button class="hbtn" id="logout">로그아웃</button></div></header>
  <main><div class="wrap" id="view"></div></main>
  <nav class="tabs" aria-label="화면"><div class="in">${tabs.map(([k,l])=>`<button data-tab="${k}" aria-current="${S.tab===k?"page":"false"}">${svgIcon(k)}${l}</button>`).join("")}</div></nav>`;
  app.querySelector("#logout").onclick=App.logout;app.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>go(b.dataset.tab));
  const v=app.querySelector("#view");
  if(S.tab==="add")renderAdd(v);else if(S.tab==="list")renderList(v);else renderMe(v);
}

function renderAdd(v){
  if(!S.form)S.form=S.editing?{...S.trips.find(t=>t.id===S.editing)}:blankTrip(S.month);
  v.innerHTML=`<h2>${S.editing?"운행 내역 수정":"운행 입력"}</h2><div id="fb"></div>`;
  tripForm(v.querySelector("#fb"),{form:S.form,editing:S.editing,places:S.places,token:S.token,
    onSaved:(rec,wasEdit)=>{S.editing=null;if(wasEdit){S.form=null;S.tab="list"}else S.form={...blankTrip(S.month),trip_date:rec.trip_date};S.month=rec.trip_date.slice(0,7);load()},
    onDeleted:()=>{S.editing=null;S.form=null;S.tab="list";load()},
    onCancel:S.editing?()=>{S.editing=null;S.form=null;go("list")}:null});
}
function renderList(v){
  const mb=`<div class="monthbar"><button id="mP" aria-label="이전 달">‹</button><span>${S.month.slice(0,4)}년 ${Number(S.month.slice(5))}월</span><button id="mN" aria-label="다음 달">›</button></div>`;
  if(S.loading){v.innerHTML=mb+`<div class="card empty"><b>불러오는 중…</b></div>`}
  else{
    const trips=[...S.trips].sort((a,b)=>b.trip_date.localeCompare(a.trip_date)||String(b.created_at).localeCompare(String(a.created_at)));
    const sum=trips.reduce((s,t)=>s+calc(t).total,0),cnt=trips.reduce((s,t)=>s+num(t.cnt),0);let html="",last="";
    trips.forEach(t=>{if(t.trip_date!==last){last=t.trip_date;html+=`<div class="daylbl">${t.trip_date.slice(5).replace("-","/")} (${dayName(t.trip_date)})</div>`}
      const c=calc(t);html+=`<button class="trip" data-id="${esc(t.id)}"><span class="nm">${esc(route(t))}</span><span class="amt">${won(c.total)}원</span>
      <span class="sub">${num(t.cnt)}회 × ${won(t.per_run)} + 유류 ${won(c.fuel)}${c.night?" + 야간 "+won(c.night):""}${t.start_time||t.end_time?` · ${esc(t.start_time||"?")}~${esc(t.end_time||"?")}`:""}${t.memo?" · "+esc(t.memo):""}</span></button>`});
    v.innerHTML=`${mb}<div class="kpis"><div class="kpi main"><div class="l">이번 달 내 정산액</div><div class="v">${won(sum)}원</div></div><div class="kpi"><div class="l">운행 횟수</div><div class="v">${cnt}회</div></div><div class="kpi"><div class="l">입력 건수</div><div class="v">${trips.length}건</div></div></div>
    <section class="card">${html||'<div class="empty"><b>이 달 내역이 없습니다</b>입력 탭에서 운행을 저장하면 여기에 쌓입니다.</div>'}</section>${trips.length?'<p class="muted" style="margin:0">항목을 누르면 고치거나 지울 수 있습니다.</p>':""}`;
    v.querySelectorAll(".trip").forEach(b=>b.onclick=()=>{S.editing=b.dataset.id;S.form=null;S.tab="add";render();scrollTo(0,0)});
  }
  v.querySelector("#mP").onclick=()=>{S.month=addMonth(S.month,-1);load()};v.querySelector("#mN").onclick=()=>{S.month=addMonth(S.month,1);load()};
}
function renderMe(v){
  v.innerHTML=`<div class="card"><b>${esc(S.user.name)}</b><span class="chip">담당 ${esc(S.user.manager||"-")}</span><br><span class="muted">아이디 ${esc(S.user.login_id)}</span></div><div id="chg"></div>`;
  changeSecretForm(v.querySelector("#chg"),{token:S.token,driver:true,onDone:()=>render()});
}


return{start(u,t){Object.assign(S,{user:u,token:t,tab:"add",month:ym(new Date()),form:null,editing:null,trips:[]});document.body.classList.remove("admin");
  if(u.must_change)render();else load()},stop(){S.user=null}};
})();
