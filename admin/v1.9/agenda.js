const $=s=>document.querySelector(s);
const state={key:sessionStorage.getItem("chefsapiens.admin.session")||"",all:[],filtered:[]};
const labels={new:"Novo",qualified:"Qualificado",contacted:"Contatado",proposal:"Proposta",won:"Ganho",lost:"Perdido"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const msg=(id,text,type="")=>{const el=$(id);el.textContent=text;el.className=`status ${type}`.trim()};
const fmt=v=>{if(!v)return"Sem data";const d=new Date(v);return Number.isNaN(d.getTime())?"Sem data":new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(d)};
const startDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const classify=r=>{const d=r.pipeline?.nextActionAt?new Date(r.pipeline.nextActionAt):null;const now=new Date(),today=startDay(now),tomorrow=new Date(today.getTime()+86400000),next7=new Date(today.getTime()+7*86400000);if(!d||Number.isNaN(d.getTime()))return"unscheduled";if(d<now&&!["won","lost"].includes(r.pipeline?.stage))return"overdue";if(d>=today&&d<tomorrow)return"today";if(d>=tomorrow&&d<next7)return"next7";return"future"};
const connected=on=>{$("#workspace").hidden=!on;$("#auth-state").textContent=on?"Conectado":"Desconectado";$("#auth-state").className=`pill ${on?"":"neutral"}`;if(on)$("#admin-key").value=""};
async function api(path,options={}){const headers=new Headers(options.headers||{});headers.set("x-admin-key",state.key);const res=await fetch(path,{...options,headers});let body={};try{body=await res.json()}catch{}if(!res.ok){const e=new Error(body?.error?.message||`Falha HTTP ${res.status}`);e.status=res.status;throw e}return body}
async function load(){msg("#agenda-status","Atualizando agenda…");const j=await api("/admin-api/pipeline");state.all=Array.isArray(j?.data?.leads)?j.data.leads:[];render();msg("#agenda-status",`${state.all.length} registro(s) carregado(s).`,"success")}
function filtered(){const q=$("#q").value.trim().toLowerCase(),owner=$("#owner").value.trim().toLowerCase(),stage=$("#stage").value,window=$("#window").value;return state.all.filter(r=>{const p=r.pipeline||{},hay=[r.contactName,r.company,r.email,p.nextAction,p.notes].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!owner||String(p.owner||"").toLowerCase().includes(owner))&&(!stage||(p.stage||"new")===stage)&&(!window||classify(r)===window)})}
function render(){
  state.filtered=filtered();
  const all=state.all;
  const count=w=>all.filter(r=>classify(r)===w).length;
  $("#m-overdue").textContent=count("overdue");
  $("#m-today").textContent=count("today");
  $("#m-next7").textContent=count("next7");
  $("#m-unscheduled").textContent=count("unscheduled");
  $("#m-proposal").textContent=all.filter(r=>r.pipeline?.stage==="proposal").length;
  for(const lane of["overdue","today","next7","unscheduled"]){
    const rows=state.filtered.filter(r=>classify(r)===lane).sort((a,b)=>new Date(a.pipeline?.nextActionAt||8640000000000000)-new Date(b.pipeline?.nextActionAt||8640000000000000));
    $(`#c-${lane}`).textContent=rows.length;
    $(`#cards-${lane}`).innerHTML=rows.length?rows.map(card).join(""):'<p class="empty">Nenhuma ação nesta faixa.</p>';
  }
  document.querySelectorAll("[data-shift]").forEach(b=>b.addEventListener("click",()=>shift(b.dataset.id,Number(b.dataset.shift))));
  document.querySelectorAll("[data-clear]").forEach(b=>b.addEventListener("click",()=>clearDate(b.dataset.id)));
}
function card(r){
  const p=r.pipeline||{},stage=p.stage||"new",kind=classify(r);
  return `<article class="card ${kind==="overdue"?"overdue":""}">
    <h4>${esc(r.company||r.contactName||"Sem empresa")}</h4>
    <p><strong>${esc(r.contactName||"Sem contato")}</strong><br>${esc(p.nextAction||"Definir próxima ação")}</p>
    <p>${esc(fmt(p.nextActionAt))} · ${esc(p.owner||"Sem responsável")}</p>
    <div class="meta"><span class="tag stage-${esc(stage)}">${esc(labels[stage]||stage)}</span><span class="tag">${esc(r.source||"—")}</span></div>
    <div class="card-actions">
      <button class="button secondary small" data-shift="1" data-id="${esc(r.id)}" type="button">Amanhã</button>
      <button class="button secondary small" data-shift="7" data-id="${esc(r.id)}" type="button">+7 dias</button>
      <button class="button secondary small" data-clear data-id="${esc(r.id)}" type="button">Sem data</button>
      <a class="button secondary small" href="/cockpit">Abrir cockpit</a>
    </div>
  </article>`
}
async function shift(id,days){const r=state.all.find(x=>x.id===id);if(!r)return;const d=new Date();d.setDate(d.getDate()+days);d.setHours(9,0,0,0);await saveDate(r,d.toISOString())}
async function clearDate(id){const r=state.all.find(x=>x.id===id);if(!r)return;await saveDate(r,null)}
async function saveDate(r,nextActionAt){
  msg("#agenda-status","Salvando reagendamento…");
  try{
    const p=r.pipeline||{};
    const j=await api(`/admin-api/pipeline/${encodeURIComponent(r.id)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({stage:p.stage||"new",owner:p.owner||"",nextAction:p.nextAction||"",nextActionAt,notes:p.notes||""})});
    r.pipeline=j.data.pipeline;render();msg("#agenda-status","Agenda atualizada.","success")
  }catch(e){msg("#agenda-status",e.message,"error")}
}
$("#auth-form").addEventListener("submit",async e=>{e.preventDefault();state.key=$("#admin-key").value.trim();if(!state.key)return;try{await load();sessionStorage.setItem("chefsapiens.admin.session",state.key);connected(true);msg("#auth-status","Acesso administrativo conectado.","success")}catch(err){state.key="";sessionStorage.removeItem("chefsapiens.admin.session");connected(false);msg("#auth-status",err.status===401?"Chave administrativa inválida.":err.message,"error")}});
["#q","#owner","#stage","#window"].forEach(id=>$(id).addEventListener("input",render));
$("#refresh").addEventListener("click",()=>load().catch(e=>msg("#agenda-status",e.message,"error")));
$("#disconnect").addEventListener("click",()=>{state.key="";state.all=[];sessionStorage.removeItem("chefsapiens.admin.session");connected(false);msg("#auth-status","Chave removida desta sessão.","success")});
$("#export").addEventListener("click",()=>{const cols=["janela","etapa","responsavel","proxima_acao","data_proxima_acao","origem","contato","email","empresa","volume","prazo"];const rows=state.filtered.map(r=>[classify(r),r.pipeline?.stage||"new",r.pipeline?.owner,r.pipeline?.nextAction,r.pipeline?.nextActionAt,r.source,r.contactName,r.email,r.company,r.volume,r.timeline]);const csv=[cols,...rows].map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`chefsapiens-agenda-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
if(state.key){load().then(()=>{connected(true);msg("#auth-status","Sessão administrativa restaurada.","success")}).catch(()=>{state.key="";sessionStorage.removeItem("chefsapiens.admin.session");connected(false)})}else connected(false);
