const $=(s)=>document.querySelector(s);
const plans=[...document.querySelectorAll(".plan")];
const form=$("#checkout-form");
plans.forEach(plan=>plan.addEventListener("click",()=>{
  plans.forEach(item=>item.classList.remove("selected"));plan.classList.add("selected");
  form.elements.plan.value=plan.dataset.plan;form.elements.volume.value=plan.dataset.volume;
  $("#selected-plan").textContent=plan.dataset.plan;
}));
form.addEventListener("submit",async event=>{
  event.preventDefault();const button=$("#submit-checkout");const status=$("#checkout-status");
  button.disabled=true;status.textContent="Registrando intenção comercial…";status.className="status";
  const raw=Object.fromEntries(new FormData(form).entries());
  const payload={contactName:raw.contactName,email:raw.email,company:raw.company,volume:raw.volume,timeline:raw.timeline,consent:true,useCase:`Interesse no plano ${raw.plan}. ${raw.useCase}`};
  try{
    const response=await fetch("/v1/leads",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const body=await response.json().catch(()=>({}));
    if(response.status!==202) throw new Error(body?.error?.message||`Falha HTTP ${response.status}`);
    $("#checkout-result").hidden=false;$("#checkout-result").scrollIntoView({behavior:"smooth"});
    form.querySelectorAll("input,select,textarea,button").forEach(el=>el.disabled=true);
    status.textContent="Interesse registrado com sucesso.";status.className="status success";
  }catch(error){status.textContent=error.message||"Não foi possível registrar.";status.className="status error";button.disabled=false}
});
