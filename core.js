/* 신신사 기사님 물류비 — 공통 기능 (기사님 화면 index.html, 관리자 화면 admin.html 이 함께 씀) */

/* ---------- 설정 / 서버 통신 ---------- */
const CFG=(()=>{let c={...(window.LG_CONFIG||{})};try{const o=JSON.parse(localStorage.getItem("lg_cfg")||"null");if(o&&o.SUPABASE_URL)c=o}catch(e){}return c})();
const DEMO=!(CFG.SUPABASE_URL&&CFG.SUPABASE_KEY);
const ERR={LOGIN_FAILED:"아이디 또는 비밀번호(PIN)가 맞지 않습니다.",LOCKED:"5번 틀려서 10분 동안 잠겼습니다. 잠시 후 다시 하거나 관리자에게 PIN 초기화를 요청하세요.",
  SESSION_EXPIRED:"로그인이 만료되었습니다. 다시 로그인해 주세요.",PIN_FORMAT:"PIN은 숫자 4~6자리로 넣어 주세요.",PW_FORMAT:"비밀번호는 6자 이상으로 넣어 주세요.",
  WRONG_OLD:"지금 쓰는 비밀번호(PIN)가 맞지 않습니다.",NOT_FOUND:"내역을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.",NO_DATE:"운행일을 넣어 주세요.",
  NO_DRIVER:"기사님을 선택해 주세요.",DUP_LOGIN:"이미 쓰고 있는 아이디입니다. 다른 아이디를 넣어 주세요.",REQUIRED:"이름과 아이디를 넣어 주세요.",NETWORK:"서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.",HAS_TRIPS:"운행 내역이 있는 기사님입니다. 내역까지 함께 삭제할지 선택해 주세요."};
class AppErr extends Error{constructor(code){super(ERR[code]||code);this.code=code}}
let onSessionExpired=()=>{};
async function rpc(fn,args={}){
  if(DEMO){const j=await Demo.call(fn,args);if(j&&j.error)throw new AppErr(j.error);return j}
  CFG.SUPABASE_KEY=String(CFG.SUPABASE_KEY).trim();const h={"apikey":CFG.SUPABASE_KEY,"Content-Type":"application/json"};
  if(!CFG.SUPABASE_KEY.startsWith("sb_"))h.Authorization="Bearer "+CFG.SUPABASE_KEY;
  let r;try{r=await fetch(String(CFG.SUPABASE_URL).trim().replace(/\/+$/,"").replace(/\/rest\/v1$/,"")+"/rest/v1/rpc/"+fn,{method:"POST",headers:h,body:JSON.stringify(args)})}catch(e){throw new AppErr("NETWORK")}
  const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
  if(!r.ok){const m=(j&&j.message)||"";const code=Object.keys(ERR).find(k=>m.includes(k));if(code==="SESSION_EXPIRED")onSessionExpired();throw new AppErr(code||m||("오류 "+r.status))}
  if(j&&j.error)throw new AppErr(j.error);
  return j;
}

/* ---------- 데모 저장소 (Supabase 함수와 같은 규칙, 이 기기에만 저장) ---------- */
const Demo={
  load(){let d=null;try{d=JSON.parse(localStorage.getItem("lg_demo")||"null")}catch(e){}
    if(!d){const D=[["김희정","안봉국"],["허두영","안봉국"],["김경덕","안봉국"],["김학렬","최귀만"],["박성형","최귀만"],["서춘근","최귀만"],["유재영","최귀만"],["하종규","최귀만"]];
      d={admins:[{id:"a1",login_id:"admin",name:"안봉국",pw:"shinshin1234",must_change:true}],
        drivers:D.map(([n,m],i)=>({id:"d"+(i+1),login_id:n,name:n,manager:m,pin:"0000",must_change:true,active:true,sort:i+1,fail:0,locked:0,phone:"",car_no:"",note:"",created_at:new Date().toISOString()})),trips:[],sessions:{}}}
    return d},
  save(d){try{localStorage.setItem("lg_demo",JSON.stringify(d))}catch(e){}},
  uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)},
  auth(d,tok,role){const s=d.sessions[tok];if(!s||(role&&s.role!==role))throw new AppErr("SESSION_EXPIRED");
    if(s.role==="driver"&&!d.drivers.find(x=>x.id===s.uid&&x.active))throw new AppErr("SESSION_EXPIRED");return s},
  call(fn,a){const d=this.load();const out=this[fn](d,a);this.save(d);return Promise.resolve(JSON.parse(JSON.stringify(out??null)))},
  lg_login(d,{p_role,p_login,p_secret}){const list=p_role==="admin"?d.admins:d.drivers.filter(x=>x.active);const u=list.find(x=>x.login_id===String(p_login).trim());
    if(!u)return{error:"LOGIN_FAILED"};if(u.locked>Date.now())return{error:"LOCKED"};
    if((p_role==="admin"?u.pw:u.pin)===p_secret){u.fail=0;u.locked=0;const tok=this.uid();d.sessions[tok]={role:p_role,uid:u.id};
      return{token:tok,role:p_role,id:u.id,name:u.name,login_id:u.login_id,must_change:u.must_change,manager:p_role==="driver"?u.manager:null}}
    u.fail=(u.fail||0)+1;if(u.fail>=5){u.fail=0;u.locked=Date.now()+600000}return{error:"LOGIN_FAILED"}},
  lg_logout(d,{p_token}){delete d.sessions[p_token]},
  lg_me(d,{p_token}){const s=this.auth(d,p_token);const u=(s.role==="admin"?d.admins:d.drivers).find(x=>x.id===s.uid);
    return{role:s.role,id:u.id,name:u.name,login_id:u.login_id,must_change:u.must_change,manager:u.manager}},
  lg_change_secret(d,{p_token,p_old,p_new}){const s=this.auth(d,p_token);const u=(s.role==="admin"?d.admins:d.drivers).find(x=>x.id===s.uid);
    if(s.role==="driver"){if(!/^[0-9]{4,6}$/.test(p_new))throw new AppErr("PIN_FORMAT");if(u.pin!==p_old)throw new AppErr("WRONG_OLD");u.pin=p_new}
    else{if((p_new||"").length<6)throw new AppErr("PW_FORMAT");if(u.pw!==p_old)throw new AppErr("WRONG_OLD");u.pw=p_new}u.must_change=false},
  lg_trips(d,{p_token,p_month}){const s=this.auth(d,p_token);return d.trips.map(t=>this.hide(s,t)).filter(t=>t.trip_date.slice(0,7)===p_month&&(s.role==="admin"||t.driver_id===s.uid)).sort((a,b)=>a.trip_date.localeCompare(b.trip_date)||a.created_at.localeCompare(b.created_at))},
  lg_last_trip(d,{p_token,p_driver}){const s=this.auth(d,p_token);const did=s.role==="admin"?p_driver:s.uid;
    return this.hide(s,d.trips.filter(t=>t.driver_id===did).sort((a,b)=>b.trip_date.localeCompare(a.trip_date)||b.created_at.localeCompare(a.created_at))[0]||null)},
  lg_places(d,{p_token}){const s=this.auth(d,p_token);const c={};d.trips.filter(t=>s.role==="admin"||t.driver_id===s.uid).forEach(t=>["from_name","client","dest","via1","via2","via3","via4"].forEach(k=>{if(t[k])c[t[k]]=(c[t[k]]||0)+1}));
    return Object.keys(c).sort((a,b)=>c[b]-c[a]).slice(0,150)},
  hide(s,t){if(!t||s.role==="admin")return t;const c={...t};delete c.per_run;delete c.fuel;delete c.night;return c},
  lg_trip_save(d,{p_token,p_trip}){const s=this.auth(d,p_token);const did=s.role==="admin"?p_trip.driver_id:s.uid;
    if(!d.drivers.find(x=>x.id===did))throw new AppErr("NO_DRIVER");if(!p_trip.trip_date)throw new AppErr("NO_DATE");
    const f={};["from_name","client","dest","via1","via2","via3","via4","start_time","end_time","memo"].forEach(k=>f[k]=p_trip[k]||"");f.cnt=parseInt(p_trip.cnt??1)||0;
    const dv=d.drivers.find(x=>x.id===did)||{},rate={per_run:dv.rate_per_run||0,fuel:dv.rate_fuel||0};const now=new Date().toISOString();
    const old=p_trip.id?d.trips.find(x=>x.id===p_trip.id&&(s.role==="admin"||x.driver_id===s.uid)):null;if(p_trip.id&&!old)throw new AppErr("NOT_FOUND");
    if(s.role==="admin"){f.per_run=p_trip.per_run!=null?Number(p_trip.per_run)||0:Number(rate.per_run)||0;f.fuel=p_trip.fuel!=null?Number(p_trip.fuel)||0:Number(rate.fuel)||0;f.night=Number(p_trip.night)||0}
    else if(!old||(!old.per_run&&!old.fuel)){f.per_run=Number(rate.per_run)||0;f.fuel=Number(rate.fuel)||0;f.night=old?old.night:0}
    else{f.per_run=old.per_run;f.fuel=old.fuel;f.night=old.night}
    if(old){Object.assign(old,f,{driver_id:did,trip_date:p_trip.trip_date,updated_at:now});return this.hide(s,old)}
    const t={id:this.uid(),driver_id:did,trip_date:p_trip.trip_date,...f,entered_by:s.role,created_at:now,updated_at:now};d.trips.push(t);return this.hide(s,t)},
  lg_rates_list(d,{p_token}){this.auth(d,p_token,"admin");return d.drivers.map(x=>({driver_id:x.id,per_run:x.rate_per_run||0,fuel:x.rate_fuel||0}))},
  lg_rates_save(d,{p_token,p_rates}){this.auth(d,p_token,"admin");(p_rates||[]).forEach(r=>{const x=d.drivers.find(y=>y.id===r.driver_id);if(x){x.rate_per_run=num(r.per_run);x.rate_fuel=num(r.fuel)}})},
  lg_rates_apply(d,{p_token,p_month,p_overwrite}){this.auth(d,p_token,"admin");let n=0;d.trips.forEach(t=>{const x=d.drivers.find(y=>y.id===t.driver_id);if(x&&(x.rate_per_run||x.rate_fuel)&&t.trip_date.slice(0,7)===p_month&&(p_overwrite||(!t.per_run&&!t.fuel))){t.per_run=x.rate_per_run||0;t.fuel=x.rate_fuel||0;n++}});return n},
  lg_trip_delete(d,{p_token,p_id}){const s=this.auth(d,p_token);const i=d.trips.findIndex(x=>x.id===p_id&&(s.role==="admin"||x.driver_id===s.uid));if(i<0)throw new AppErr("NOT_FOUND");d.trips.splice(i,1)},
  lg_drivers_list(d,{p_token}){this.auth(d,p_token,"admin");return d.drivers.map(x=>({id:x.id,login_id:x.login_id,name:x.name,manager:x.manager,active:x.active,sort:x.sort,must_change:x.must_change,
    phone:x.phone||"",car_no:x.car_no||"",note:x.note||"",rate_per_run:x.rate_per_run||0,rate_fuel:x.rate_fuel||0,locked:x.locked>Date.now(),created_at:x.created_at,
    last_trip:d.trips.filter(t=>t.driver_id===x.id).map(t=>t.trip_date).sort().pop()||null,trip_count:d.trips.filter(t=>t.driver_id===x.id).length}))},
  lg_driver_delete(d,{p_token,p_id,p_with_trips}){this.auth(d,p_token,"admin");if(!d.drivers.find(x=>x.id===p_id))throw new AppErr("NOT_FOUND");
    if(d.trips.some(t=>t.driver_id===p_id)){if(!p_with_trips)throw new AppErr("HAS_TRIPS");d.trips=d.trips.filter(t=>t.driver_id!==p_id)}
    Object.keys(d.sessions).forEach(k=>{if(d.sessions[k].uid===p_id)delete d.sessions[k]});d.drivers=d.drivers.filter(x=>x.id!==p_id)},
  lg_driver_save(d,{p_token,p_driver:p}){this.auth(d,p_token,"admin");const pin=p.pin||null;
    if(pin&&!/^[0-9]{4,6}$/.test(pin))throw new AppErr("PIN_FORMAT");if(!String(p.login_id||"").trim()||!String(p.name||"").trim())throw new AppErr("REQUIRED");
    if(d.drivers.find(x=>x.login_id===p.login_id.trim()&&x.id!==p.id))throw new AppErr("DUP_LOGIN");
    const extra={phone:(p.phone||"").trim(),car_no:(p.car_no||"").trim(),note:(p.note||"").trim()};if(p.rate_per_run!=null)extra.rate_per_run=num(p.rate_per_run);if(p.rate_fuel!=null)extra.rate_fuel=num(p.rate_fuel);
    if(!p.id){if(!pin)throw new AppErr("PIN_FORMAT");d.drivers.push({id:this.uid(),login_id:p.login_id.trim(),name:p.name.trim(),manager:(p.manager||"").trim(),pin,must_change:true,active:true,
      sort:p.sort||Math.max(0,...d.drivers.map(x=>x.sort||0))+1,fail:0,locked:0,created_at:new Date().toISOString(),...extra});return}
    const u=d.drivers.find(x=>x.id===p.id);Object.assign(u,{login_id:p.login_id.trim(),name:p.name.trim(),manager:(p.manager||"").trim(),...extra});
    if(p.active!==undefined)u.active=!!p.active;if(pin){u.pin=pin;u.must_change=true;u.fail=0;u.locked=0}
    if(p.active===false)Object.keys(d.sessions).forEach(k=>{if(d.sessions[k].uid===u.id)delete d.sessions[k]})},
  lg_summary(d,{p_token,p_from,p_to}){this.auth(d,p_token,"admin");const g={};
    d.trips.filter(t=>{const m=t.trip_date.slice(0,7);return m>=p_from&&m<=p_to}).forEach(t=>{const k=t.trip_date.slice(0,7)+"|"+t.driver_id;const c=calc(t);
      const r=g[k]||(g[k]={month:t.trip_date.slice(0,7),driver_id:t.driver_id,n:0,cnt:0,total:0});r.n++;r.cnt+=num(t.cnt);r.total+=c.total});return Object.values(g)}
};

/* ---------- 도우미 ---------- */
const HEAD=["출발지명","거래처","납품거래처","경유1","경유2","경유3","경유4","횟수","회당운행비","운행비 합계","유류비지원금","유류비합계","정산액","운행 시작시간","운행 종료시간","야간수당","비고"];
function ym(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
function addMonth(m,delta){const [y,mm]=m.split("-").map(Number);return ym(new Date(y,mm-1+delta,1))}
function today(){const d=new Date();return ym(d)+"-"+String(d.getDate()).padStart(2,"0")}
const won=n=>Math.round(Number(n)||0).toLocaleString("ko-KR");
const man=n=>{n=Number(n)||0;return n>=10000?(n/10000).toLocaleString("ko-KR",{maximumFractionDigits:1})+"만":won(n)};
const num=v=>{const n=Number(String(v??"").replace(/,/g,""));return isFinite(n)?n:0};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
function calc(t){const c=num(t.cnt),run=c*num(t.per_run),fuel=c*num(t.fuel),night=num(t.night);return{run,fuel,night,total:run+fuel+night}}
function route(t){return [t.from_name,t.via1,t.via2,t.via3,t.via4,t.dest||t.client].filter(Boolean).join(" → ")||"(경로 미입력)"}
function dayName(date){return "일월화수목금토"[new Date(date+"T00:00").getDay()]}
function toast(m){const el=document.getElementById("toast");el.textContent=m;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2600)}
const ICON={dash:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',add:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  drivers:'<path d="M3 16V7h11v9M14 10h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',me:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  won:'<path d="M3 7l3 10 3-8 3 8 3-8 3 8 3-10"/><path d="M2 11h20M2 14h20"/>',
  userplus:'<circle cx="9" cy="8" r="4"/><path d="M2 21c1-4 3.5-6 7-6s6 2 7 6M19 8v6M16 11h6"/>'};
const svgIcon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

/* ---------- 운행 입력 폼 (기사님·관리자 공용) ----------
   opts: {form, editing, places, drivers(관리자만), token, onSaved(rec, wasEdit), onDeleted(), onCancel()} */
const ORIGINS=window.LG_ORIGINS||[],DESTS=window.LG_DESTS||[];
const FIELDS=["trip_date","from_name","dest","via1","via2","via3","via4","cnt","per_run","fuel","start_time","end_time","night","memo"];
function sel(list,cur,ph){const opts=[...list];if(cur&&!opts.includes(cur))opts.push(cur);return `<option value="">${esc(ph)}</option>`+opts.map(x=>`<option value="${esc(x)}" ${x===cur?"selected":""}>${esc(x)}${list.includes(x)?"":" (목록에 없음)"}</option>`).join("")}
function blankTrip(month,driverId){return{driver_id:driverId||"",trip_date:month===ym(new Date())?today():month+"-01",from_name:LS.get("lg_last_origin")||ORIGINS[0]||"",dest:"",via1:"",via2:"",via3:"",via4:"",cnt:1,per_run:"",fuel:"",start_time:"",end_time:"",night:"",memo:""}}
function tripForm(box,o){
  // 기사님: 운행 정보만 입력 (금액 칸 없음, 금액은 관리자가 정한 기사님별 단가로 자동)
  // 관리자: 금액까지 입력. 기사님을 고르면 그 기사님 단가가 자동으로 채워짐
  const f=o.form,ed=!!o.editing,admin=!!o.drivers,rates=o.rates||{};let confirmDel=false;
  const FLD=admin?FIELDS:FIELDS.filter(k=>!["per_run","fuel","night"].includes(k));
  const draw=()=>{
    const pick=admin?`<label>기사님<select id="driver_id"><option value="">기사님 선택</option>${[...new Set(o.drivers.map(d=>d.manager||"미지정"))].map(mg=>`<optgroup label="담당 ${esc(mg)}">${o.drivers.filter(d=>(d.manager||"미지정")===mg&&(d.active||d.id===f.driver_id)).map(d=>`<option value="${esc(d.id)}" ${f.driver_id===d.id?"selected":""}>${esc(d.name)}</option>`).join("")}</optgroup>`).join("")}</select></label>`:"";
    const hasVia=f.via1||f.via2||f.via3||f.via4;
    const cntBox=`<label>납품 횟수<div class="stepper"><button type="button" id="cm" aria-label="횟수 줄이기">−</button><input type="number" id="cnt" inputmode="numeric" min="0" value="${esc(f.cnt)}"><button type="button" id="cp" aria-label="횟수 늘리기">+</button></div></label>`;
    box.innerHTML=`<form class="card tf" autocomplete="off">${pick}
      <div class="grid2"><label>운행일<input type="date" id="trip_date" value="${esc(f.trip_date)}" required></label><label><span>&nbsp;</span><button type="button" class="btn" id="copyLast">지난 입력 복사</button></label></div>
      <label>출발지<select id="from_name">${sel(ORIGINS,f.from_name,"출발지 선택")}</select></label>
      <label>납품거래처<select id="dest" required>${sel(DESTS,f.dest,"납품거래처 선택")}</select></label>
      <details ${hasVia?"open":""}><summary>경유지 넣기 (최대 4곳)</summary><div class="grid2">${[1,2,3,4].map(i=>`<label>경유${i}<select id="via${i}">${sel(DESTS,f["via"+i],"없음")}</select></label>`).join("")}</div></details>
      ${admin?`<div class="grid3">${cntBox}
        <label>회당운행비<input type="number" id="per_run" inputmode="numeric" min="0" step="100" value="${esc(f.per_run)}" placeholder="0"></label>
        <label>유류비지원금<input type="number" id="fuel" inputmode="numeric" min="0" step="100" value="${esc(f.fuel)}" placeholder="회당"></label></div>
        <div class="grid3"><label>운행 시작<input type="time" id="start_time" value="${esc(f.start_time)}"></label><label>운행 종료<input type="time" id="end_time" value="${esc(f.end_time)}"></label><label>야간수당<input type="number" id="night" inputmode="numeric" min="0" step="100" value="${esc(f.night)}" placeholder="0"></label></div>`
      :`<div class="grid3">${cntBox}<label>운행 시작<input type="time" id="start_time" value="${esc(f.start_time)}"></label><label>운행 종료<input type="time" id="end_time" value="${esc(f.end_time)}"></label></div>`}
      <label>비고<textarea id="memo" placeholder="${admin?"":"특이사항이 있으면 적어 주세요"}">${esc(f.memo)}</textarea></label>
      <div class="calc" id="calc"></div>
      <div class="row"><button class="btn primary big" id="save" type="submit">${ed?"수정 저장":"저장"}</button>${ed||o.onCancel?'<button type="button" class="btn big" id="cancel">취소</button>':""}</div>
      ${ed?(confirmDel?`<div class="confirm"><span>이 운행 내역을 삭제할까요? 되돌릴 수 없습니다.</span><div class="row"><button type="button" class="btn danger" id="delYes">삭제</button><button type="button" class="btn" id="delNo">그대로 두기</button></div></div>`:'<button type="button" class="btn danger" id="del">이 내역 삭제</button>'):""}
    </form>`;
    const $=id=>box.querySelector("#"+id);
    const read=()=>{FLD.forEach(k=>f[k]=$(k).value);if(admin)f.driver_id=$("driver_id").value};
    const upd=()=>{read();
      if(admin){const c=calc(f);$("calc").innerHTML=`<span>운행비 합계 (${num(f.cnt)}회 × ${won(f.per_run)})</span><b>${won(c.run)}원</b><span>유류비합계 (${num(f.cnt)}회 × ${won(f.fuel)})</span><b>${won(c.fuel)}원</b><span>야간수당</span><b>${won(c.night)}원</b><span class="tot">정산액</span><b class="tot">${won(c.total)}원</b>`}
      else $("calc").innerHTML=`<span class="tot" style="border:0;padding:0;margin:0">${f.trip_date?esc(f.trip_date.slice(5).replace("-","/"))+" ("+dayName(f.trip_date)+") · ":""}${esc(f.dest||"납품거래처를 고르세요")}</span><b class="tot" style="border:0;padding:0;margin:0">${num(f.cnt)}회</b>`};
    const form=box.querySelector("form");form.addEventListener("input",upd);form.addEventListener("change",upd);
    if(admin){let lastDrv=f.driver_id;const fill=(force)=>{const r=rates[$("driver_id").value],pr=rates[lastDrv];
      const blank=!num($("per_run").value)&&!num($("fuel").value),same=pr&&num($("per_run").value)===num(pr.per_run)&&num($("fuel").value)===num(pr.fuel);
      if(r&&(num(r.per_run)||num(r.fuel))&&(blank||same||force)){$("per_run").value=r.per_run;$("fuel").value=r.fuel;toast("이 기사님 단가를 넣었습니다")}lastDrv=$("driver_id").value;upd()};
      $("driver_id").addEventListener("change",()=>fill(false));if(!ed&&f.driver_id&&!num(f.per_run)&&!num(f.fuel))fill(false);}
    upd();
    $("cm").onclick=()=>{$("cnt").value=Math.max(0,num($("cnt").value)-1);upd()};
    $("cp").onclick=()=>{$("cnt").value=num($("cnt").value)+1;upd()};
    $("copyLast").onclick=async()=>{read();if(admin&&!f.driver_id)return toast("기사님을 먼저 선택해 주세요");
      try{const t=await rpc("lg_last_trip",{p_token:o.token,p_driver:admin?f.driver_id:null});if(!t)return toast("지난 입력이 없습니다");
        ["from_name","dest","via1","via2","via3","via4","cnt","per_run","fuel","start_time","end_time","night"].filter(k=>$(k)).forEach(k=>{const el=$(k);if(el.tagName==="SELECT"&&t[k]&&![...el.options].some(x=>x.value===t[k]))el.add(new Option(t[k]+" (목록에 없음)",t[k]));el.value=t[k]??""});
        if(t.via1||t.via2||t.via3||t.via4)box.querySelector("details").open=true;upd();toast(`${t.trip_date} 입력을 불러왔습니다`)}catch(e){toast(e.message)}};
    form.onsubmit=async e=>{e.preventDefault();read();if(admin&&!f.driver_id)return toast("기사님을 선택해 주세요");if(!f.trip_date)return toast("운행일을 넣어 주세요");
      const rec={trip_date:f.trip_date,cnt:num(f.cnt)};
      if(admin){rec.per_run=num(f.per_run);rec.fuel=num(f.fuel);rec.night=num(f.night)}
      ["from_name","dest","via1","via2","via3","via4","start_time","end_time","memo"].forEach(k=>rec[k]=String(f[k]||"").trim());rec.client="";
      if(!rec.dest)return toast("납품거래처를 선택해 주세요");if(!rec.cnt)return toast("납품 횟수를 1회 이상 넣어 주세요");if(rec.from_name)LS.set("lg_last_origin",rec.from_name);
      if(admin)rec.driver_id=f.driver_id;if(ed)rec.id=o.editing;
      $("save").disabled=true;
      try{await rpc("lg_trip_save",{p_token:o.token,p_trip:rec});
        toast(ed?"수정했습니다":admin?`저장했습니다 · 정산액 ${won(calc(rec).total)}원`:`저장했습니다 · ${rec.dest} ${rec.cnt}회`);o.onSaved&&o.onSaved(rec,ed)}
      catch(err){$("save").disabled=false;toast(err.message)}};
    if($("cancel"))$("cancel").onclick=()=>o.onCancel&&o.onCancel();
    if($("del"))$("del").onclick=()=>{read();confirmDel=true;draw()};
    if($("delNo"))$("delNo").onclick=()=>{read();confirmDel=false;draw()};
    if($("delYes"))$("delYes").onclick=async()=>{try{await rpc("lg_trip_delete",{p_token:o.token,p_id:o.editing});toast("삭제했습니다");o.onDeleted&&o.onDeleted()}catch(err){toast(err.message)}};
  };
  draw();
}

/* ---------- 비밀번호/PIN 바꾸기 폼 ---------- */
function changeSecretForm(box,{token,driver,forced,onDone}){
  const kind=driver?"PIN":"비밀번호",pin=driver?'inputmode="numeric" class="pin" maxlength="6"':"";
  box.innerHTML=`<form class="card"><h2>${forced?"처음 로그인 — 본인 "+kind+"으로 바꿔 주세요":kind+" 바꾸기"}</h2>
    <label>지금 ${kind}<input id="c0" type="password" ${pin} autocomplete="current-password" required></label>
    <label>새 ${driver?"PIN (숫자 4~6자리)":"비밀번호 (6자 이상)"}<input id="c1" type="password" ${pin} autocomplete="new-password" required></label>
    <label>새 ${kind} 확인<input id="c2" type="password" ${pin} autocomplete="new-password" required></label>
    <p class="err" id="cerr"></p><button class="btn primary big" type="submit">바꾸기</button></form>`;
  const f=box.querySelector("form");
  f.onsubmit=async e=>{e.preventDefault();const o=f.querySelector("#c0").value,n=f.querySelector("#c1").value,n2=f.querySelector("#c2").value,er=f.querySelector("#cerr");
    if(n!==n2){er.textContent="새로 넣은 두 값이 서로 다릅니다.";return}
    try{await rpc("lg_change_secret",{p_token:token,p_old:o,p_new:n});toast("바꿨습니다");onDone&&onDone()}catch(err){er.textContent=err.message}};
}

/* ---------- 엑셀 (물류비신청_sgerp 양식, 기사님별 시트) ---------- */
function exportXlsx(month,trips,drivers){
  if(typeof XLSX==="undefined")return toast("엑셀 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.");
  trips=[...trips].sort((a,b)=>a.trip_date.localeCompare(b.trip_date)||String(a.created_at).localeCompare(String(b.created_at)));
  const [y,m]=month.split("-");const wb=XLSX.utils.book_new();
  const list=drivers.filter(d=>d.active||trips.some(t=>t.driver_id===d.id));
  const sum=[[`${y}년 ${Number(m)}월 기사님 물류비 요약`],["기사님","담당자","입력 건수","운행 횟수","운행비 합계","유류비합계","야간수당","정산액"]];let G=[0,0,0,0,0,0];
  list.forEach(d=>{const r=[0,0,0,0,0,0];trips.filter(t=>t.driver_id===d.id).forEach(t=>{const c=calc(t);r[0]++;r[1]+=num(t.cnt);r[2]+=c.run;r[3]+=c.fuel;r[4]+=c.night;r[5]+=c.total});sum.push([d.name,d.manager||"",...r]);G=G.map((g,i)=>g+r[i])});
  sum.push(["합계","",...G]);const s0=XLSX.utils.aoa_to_sheet(sum);s0["!cols"]=[12,10,10,10,14,14,12,14].map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,s0,"요약");
  const used=new Set();
  list.forEach(d=>{const aoa=[["물류비신청_sgerp"],HEAD];
    trips.filter(t=>t.driver_id===d.id).forEach(t=>{const c=calc(t);aoa.push([t.from_name,t.client,t.dest,t.via1,t.via2,t.via3,t.via4,num(t.cnt),num(t.per_run),c.run,num(t.fuel),c.fuel,c.total,t.start_time,t.end_time,num(t.night),[t.trip_date,t.memo].filter(Boolean).join(" ")])});
    const ws=XLSX.utils.aoa_to_sheet(aoa);ws["!cols"]=HEAD.map(h=>({wch:Math.max(9,h.length*2+2)}));
    let nm=`${d.name} ${d.manager||""}`.trim().replace(/[\\\/\?\*\[\]:]/g,"").slice(0,31);while(used.has(nm))nm=nm.slice(0,28)+"_"+used.size;used.add(nm);XLSX.utils.book_append_sheet(wb,ws,nm)});
  const all=[["운행일","기사님","담당자",...HEAD]];const byId=Object.fromEntries(drivers.map(d=>[d.id,d]));
  trips.forEach(t=>{const c=calc(t),d=byId[t.driver_id];all.push([t.trip_date,d?.name||"",d?.manager||"",t.from_name,t.client,t.dest,t.via1,t.via2,t.via3,t.via4,num(t.cnt),num(t.per_run),c.run,num(t.fuel),c.fuel,c.total,t.start_time,t.end_time,num(t.night),t.memo])});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(all),"전체내역");
  const blob=new Blob([XLSX.write(wb,{type:"array",bookType:"xlsx"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`기사님 물류비_${y}${m}.xlsx`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
