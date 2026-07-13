const $=s=>document.querySelector(s);
const state={key:sessionStorage.getItem("chefsapiens.admin.session")||"",all:[],filtered:[],active:null};
const stageLabels={new:"Novo",qualified:"Qualificado",contacted:"Contatado",proposal:"Proposta",won:"Ganho",lost:"Perdido"};
const msg=(id,text,type="")=>{const el=$(id);el.textContent=text;el.className=`status ${type}`.trim()};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmtDate=v=>{if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(d)};
const toLocal=v=>{if(!v)return"";const d=new Date(v);if(Number.isNaN(d.getTime()))return"";const z=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`};
const isOverdue=r=>r.pipeline?.nextActionAt&&new Date(r.pipeline.nextActionAt)<new Date()&&!["won","lost"].includes(r.pipeline.stage);
const score=r=>{let n=0,t=(r.timeline||"").toLowerCase(),v=(r.volume||"").toLowerCase(),u=(r.useCase||"").toLowerCase();if(t.includes("7 dias"))n+=4;else if(t.includes("30 dias"))n+=3;else if(t.includes("90 dias"))n+=1;if(v.includes("acima")||v.includes("milhão"))n+=4;else if(v.includes("150 mil"))n+=3;else if(v.includes("20 mil a"))n+=2;else n+=1;if((r.source||"")==="sales")n+=2;if(u.includes("growth")||u.includes("scale")||u.includes("enterprise"))n+=2;if(["qualified","contacted","proposal"].includes(r.pipeline?.stage))n+=2;return n};
const priority=r=>{const n=score(r);return n>=9?["Alta","p-high"]:n>=6?["Média","p-medium"]:["Baixa","p-low"]};

async function api(path,options={}){
 const headers=new Headers(options.headers||{});headers.set("x-admin-key",state.key);
 const res=await fetch(path,{...options,headers});let body={};try{body=await res.json()}catch{}
 if(!res.ok){const e=new Error(body?.error?.message||`Falha HTTP ${res.status}`);e.status=res.status;throw e}
 return body;
}
async function load(){
 msg("#table-status","Atualizando pipeline…");
 const j=await api("/admin-api/pipeline");
 state.all=Array.isArray(j?.data?.leads)?j.data.leads:[];
 render();msg("#table-status",`${state.all.length} registro(s) carregado(s).`,"success");
}
function connected(on){
 $("#workspace").hidden=!on;$("#auth-state").textContent=on?"Conectado":"Desconectado";$("#auth-state").className=`pill ${on?"":"neutral"}`;
 if(on)$("#admin-key").value="";
}
function render(){
 const q=$("#q").value.trim().toLowerCase(),src=$("#source").value,st=$("#stage").value,owner=$("#owner").value.trim().toLowerCase(),due=$("#due").value;
 const now=new Date(),todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()),todayEnd=new Date(todayStart.getTime()+86400000),next7=new Date(todayStart.getTime()+7*86400000);
 state.filtered=state.all.filter(r=>{
   const p=r.pipeline||{},hay=[r.company,r.contactName,r.email,r.useCase,p.nextAction,p.notes].join(" ").toLowerCase();
   let dueOk=true;const d=p.nextActionAt?new Date(p.nextActionAt):null;
   if(due==="overdue")dueOk=isOverdue(r);else if(due==="today")dueOk=d&&d>=todayStart&&d<todayEnd;else if(due==="next7")dueOk=d&&d>=todayStart&&d<next7;else if(due==="none")dueOk=!d;
   return(!q||hay.includes(q))&&(!src||r.source===src)&&(!st||(p.stage||"new")===st)&&(!owner||String(p.owner||"").toLowerCase().includes(owner))&&dueOk
 }).sort((a,b)=>{const ad=a.pipeline?.nextActionAt?new Date(a.pipeline.nextActionAt).getTime():Infinity,bd=b.pipeline?.nextActionAt?new Date(b.pipeline.nextActionAt).getTime():Infinity;return(isOverdue(b)-isOverdue(a))||score(b)-score(a)||(ad-bd)||new Date(b.createdAt)-new Date(a.createdAt)});
 $("#m-total").textContent=state.all.length;
 $("#m-new").textContent=state.all.filter(r=>(r.pipeline?.stage||"new")==="new").length;
 $("#m-open").textContent=state.all.filter(r=>["qualified","contacted","proposal"].includes(r.pipeline?.stage)).length;
 $("#m-overdue").textContent=state.all.filter(isOverdue).length;
 $("#m-won").textContent=state.all.filter(r=>r.pipeline?.stage==="won").length;
 $("#rows").innerHTML=state.filtered.map(r=>{
   const[p,pc]=priority(r),stage=r.pipeline?.stage||"new",dueText=r.pipeline?.nextActionAt?fmtDate(r.pipeline.nextActionAt):"Sem data";
   return`<tr><td><span class="priority ${pc}">${p}</span></td><td><span class="stage stage-${esc(stage)}">${esc(stageLabels[stage]||stage)}</span></td><td><strong>${esc(r.pipeline?.nextAction||"Definir próxima ação")}</strong><br><span class="${isOverdue(r)?"overdue":"muted"}">${esc(dueText)}</span><br><span class="muted">${esc(r.pipeline?.owner||"Sem responsável")}</span></td><td><strong>${esc(r.contactName||"—")}</strong><br><span class="muted">${esc(r.email||"—")}</span></td><td>${esc(r.company||"—")}</td><td>${esc(r.source||"—")}</td><td>${esc(r.volume||"—")}</td><td>${esc(r.timeline||"—")}</td><td class="row-action"><button class="button secondary edit" data-id="${esc(r.id)}" type="button">Editar</button></td></tr>`
 }).join("");
 $("#empty").hidden=state.filtered.length>0;
 document.querySelectorAll(".edit").forEach(btn=>btn.addEventListener("click",()=>openDrawer(btn.dataset.id)));
}
function openDrawer(id){
 const r=state.all.find(x=>x.id===id);if(!r)return;state.active=r;
 $("#lead-id").value=r.id;$("#edit-stage").value=r.pipeline?.stage||"new";$("#edit-owner").value=r.pipeline?.owner||"";$("#edit-next-action").value=r.pipeline?.nextAction||"";$("#edit-next-action-at").value=toLocal(r.pipeline?.nextActionAt);$("#edit-notes").value=r.pipeline?.notes||"";
 $("#lead-summary").innerHTML=`<p><strong>${esc(r.contactName||"—")}</strong> · ${esc(r.company||"—")}</p><p class="muted">${esc(r.email||"—")} · ${esc(r.source||"—")} · ${esc(r.volume||"—")}</p><p>${esc(r.useCase||"Sem caso de uso informado.")}</p>`;
 $("#drawer").classList.add("open");$("#drawer").setAttribute("aria-hidden","false");$("#edit-stage").focus();msg("#drawer-status","");
}
function closeDrawer(){$("#drawer").classList.remove("open");$("#drawer").setAttribute("aria-hidden","true");state.active=null}
$("#pipeline-form").addEventListener("submit",async e=>{
 e.preventDefault();const id=$("#lead-id").value,button=$("#save-pipeline");button.disabled=true;msg("#drawer-status","Salvando pipeline…");
 try{
   const payload={stage:$("#edit-stage").value,owner:$("#edit-owner").value.trim(),nextAction:$("#edit-next-action").value.trim(),nextActionAt:$("#edit-next-action-at").value?new Date($("#edit-next-action-at").value).toISOString():null,notes:$("#edit-notes").value.trim()};
   const j=await api(`/admin-api/pipeline/${encodeURIComponent(id)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
   const row=state.all.find(x=>x.id===id);if(row)row.pipeline=j.data.pipeline;render();msg("#drawer-status","Pipeline salvo.","success");setTimeout(closeDrawer,550)
 }catch(err){msg("#drawer-status",err.message,"error")}finally{button.disabled=false}
});
document.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",closeDrawer));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#drawer").classList.contains("open"))closeDrawer()});
$("#auth-form").addEventListener("submit",async e=>{e.preventDefault();state.key=$("#admin-key").value.trim();if(!state.key)return;try{await load();sessionStorage.setItem("chefsapiens.admin.session",state.key);connected(true);msg("#auth-status","Acesso administrativo conectado.","success")}catch(err){state.key="";sessionStorage.removeItem("chefsapiens.admin.session");connected(false);msg("#auth-status",err.status===401?"Chave administrativa inválida.":err.message,"error")}});
["#q","#source","#stage","#owner","#due"].forEach(id=>$(id).addEventListener("input",render));
$("#refresh").addEventListener("click",()=>load().catch(err=>msg("#table-status",err.message,"error")));
$("#disconnect").addEventListener("click",()=>{state.key="";state.all=[];state.filtered=[];sessionStorage.removeItem("chefsapiens.admin.session");connected(false);msg("#auth-status","Chave removida desta sessão.","success")});
$("#export").addEventListener("click",()=>{const cols=["prioridade","etapa","responsavel","proxima_acao","data_proxima_acao","origem","status","contato","email","empresa","volume","prazo","caso_de_uso","notas"];const rows=state.filtered.map(r=>[priority(r)[0],r.pipeline?.stage||"new",r.pipeline?.owner,r.pipeline?.nextAction,r.pipeline?.nextActionAt,r.source,r.status,r.contactName,r.email,r.company,r.volume,r.timeline,r.useCase,r.pipeline?.notes]);const csv=[cols,...rows].map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`chefsapiens-pipeline-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
if(state.key){load().then(()=>{connected(true);msg("#auth-status","Sessão administrativa restaurada.","success")}).catch(()=>{state.key="";sessionStorage.removeItem("chefsapiens.admin.session");connected(false)})}else connected(false);
