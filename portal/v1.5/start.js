const $=(s)=>document.querySelector(s);
const status=(text,type="")=>{const el=$("#trial-status");el.textContent=text;el.className=`status ${type}`.trim()};
const form=$("#trial-form");
form.addEventListener("submit",async event=>{
  event.preventDefault();
  const button=$("#submit-trial");
  button.disabled=true; status("Criando ambiente de trial…");
  const data=Object.fromEntries(new FormData(form).entries());
  data.consent=true;
  try{
    const response=await fetch("/v1/trials",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body?.data?.apiKey) throw new Error(body?.error?.message||`Falha HTTP ${response.status}`);
    const issued=body.data;
    sessionStorage.setItem("chefsapiens.session.key",issued.apiKey);
    sessionStorage.removeItem("chefsapiens.session.called");
    $("#issued-key").value=issued.apiKey;
    $("#trial-expiry").textContent=issued.expiresAt?new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(new Date(issued.expiresAt)):"14 dias";
    $("#trial-quota").textContent=new Intl.NumberFormat("pt-BR").format(issued.quota||1000);
    $("#trial-result").hidden=false;
    $("#trial-result").scrollIntoView({behavior:"smooth",block:"start"});
    form.querySelectorAll("input,select,textarea,button").forEach(el=>el.disabled=true);
    status("Trial criado. Copie a chave e abra a área do cliente.","success");
  }catch(error){status(error.message||"Não foi possível criar o trial.","error");button.disabled=false}
});
$("#toggle-key").addEventListener("click",()=>{
  const input=$("#issued-key");const show=input.type==="password";input.type=show?"text":"password";$("#toggle-key").textContent=show?"Ocultar":"Mostrar";
});
$("#copy-key").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText($("#issued-key").value);$("#copy-key").textContent="Copiada";setTimeout(()=>$("#copy-key").textContent="Copiar",1800)}
  catch{$("#issued-key").type="text";$("#issued-key").select()}
});
