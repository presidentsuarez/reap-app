import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const AK=Deno.env.get("ANTHROPIC_API_KEY")||"";const SU=Deno.env.get("SUPABASE_URL")||"";const SK=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const CH={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const MI=10;
function dc(m){const l=m.toLowerCase();const c=["general"];if(/email|gmail|reply|inbox/.test(l))c.push("email");if(/text|sms|message them/.test(l))c.push("sms");return c;}
async function bp(r,uid,msg,sb){
  const p=[];p.push(`You are ${r.name}, a ${r.role}.`);if(r.personality)p.push(r.personality);if(r.description)p.push(r.description);p.push("");
  try{const{data:s}=await sb.from("org_soul").select("*").eq("user_id",uid).eq("active",true).maybeSingle();
    if(s){p.push("=== ORGANIZATION ===");p.push(`Company: ${s.org_name}`);if(s.mission)p.push(`Mission: ${s.mission}`);if(s.vision)p.push(`Vision: ${s.vision}`);
      if(s.values?.length){p.push("Values:");s.values.forEach(v=>p.push(`  - ${v.value}: ${v.description}`));}
      if(s.voice_principles?.length){p.push("Voice:");s.voice_principles.forEach(v=>p.push(`  - ${v.principle}: ${v.description}`));}
      if(s.things_we_dont_do?.length){p.push("Don'ts:");s.things_we_dont_do.forEach(v=>p.push(`  - ${v.rule}`));}
      if(s.decision_precedents?.length){p.push("Precedents:");s.decision_precedents.forEach(v=>p.push(`  - ${v.precedent}`));}p.push("");}}catch(_){}
  try{const ch=dc(msg);const{data:rules}=await sb.from("robot_style_guide").select("*").eq("user_id",uid).eq("active",true).in("channel",ch).order("importance",{ascending:false});
    if(rules?.length){p.push("=== STYLE GUIDE ===");rules.forEach(r=>{p.push(`${r.rule_title} [${r.channel}]: DO: ${r.do_text||""} | DON'T: ${r.dont_text||""}`);});p.push("");}}catch(_){}
  try{const{data:mem}=await sb.from("robot_memories").select("*").eq("user_id",uid).order("importance",{ascending:false}).limit(10);
    if(mem?.length){p.push("=== MEMORIES ===");mem.forEach(m=>p.push(`- [${m.category}] ${m.title}: ${m.content}`));p.push("");}}catch(_){}
  try{const{data:ex}=await sb.from("robot_exemplars").select("id,title,channel,why_its_good").eq("user_id",uid).order("importance",{ascending:false}).limit(5);
    if(ex?.length){p.push("=== EXEMPLARS ===");ex.forEach(e=>p.push(`- "${e.title}" [${e.channel}]`));p.push("");}}catch(_){}
  p.push(`Today: ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}`);
  p.push("You work for Javier Suarez at REAP and Tampa Development Group.\n");
  p.push("RULES: Be concise. Use tools for real data. Never fabricate. Format $X,XXX. Outbound comms ALWAYS drafts. Use search_memories for context. You have web search available for market research.");
  return p.join("\n");
}
const ALL_TOOLS=[
  {name:"assign_task",description:"Create a task/reminder/to-do.",input_schema:{type:"object",properties:{name:{type:"string"},description:{type:"string"},priority:{type:"string",enum:["low","medium","high","urgent"]},due_date:{type:"string"}},required:["name"]}},
  {name:"query_deals",description:"Query real estate deals. Pipeline, properties, financials, REAP scores.",input_schema:{type:"object",properties:{search:{type:"string"},status:{type:"string"},sort_by:{type:"string",enum:["reap_score","asking_price","arv_value","date_added"]},limit:{type:"number"}}}},
  {name:"query_contacts",description:"Query CRM contacts. Lenders, buyers, investors, wholesalers.",input_schema:{type:"object",properties:{search:{type:"string"},contact_type:{type:"string"},limit:{type:"number"}}}},
  {name:"get_pipeline_summary",description:"Pipeline summary — counts, value, REAP score, NOI.",input_schema:{type:"object",properties:{}}},
  {name:"search_memories",description:"Search knowledge base for context and decisions.",input_schema:{type:"object",properties:{query:{type:"string"},category:{type:"string"}},required:["query"]}},
  {name:"get_exemplars",description:"Get gold-standard communication examples.",input_schema:{type:"object",properties:{channel:{type:"string"}}}},
  {name:"create_email_draft",description:"Draft an email. ALWAYS use for email requests.",input_schema:{type:"object",properties:{to:{type:"string"},cc:{type:"string"},subject:{type:"string"},body:{type:"string"},context:{type:"string"}},required:["to","subject","body"]}},
  {name:"create_text_draft",description:"Draft a text/SMS message.",input_schema:{type:"object",properties:{to_name:{type:"string"},to_number:{type:"string"},body:{type:"string"},context:{type:"string"}},required:["to_name","body"]}},
  {name:"create_memo_draft",description:"Draft a memo, report, summary, or proposal.",input_schema:{type:"object",properties:{title:{type:"string"},body:{type:"string"},doc_type:{type:"string"}},required:["title","body"]}},
  {name:"get_financial_summary",description:"Financial summary — total investment, equity, returns, NOI, cash flow.",input_schema:{type:"object",properties:{status:{type:"string"}}}},
  {name:"add_pipeline_deal",description:"Add a new deal to pipeline.",input_schema:{type:"object",properties:{address:{type:"string"},city:{type:"string"},state:{type:"string"},type:{type:"string"},asking_price:{type:"number"},sqft:{type:"number"},units:{type:"number"},notes:{type:"string"}},required:["address","city"]}},
  {name:"update_deal_stage",description:"Move a deal to a new pipeline stage.",input_schema:{type:"object",properties:{deal_id:{type:"string"},new_status:{type:"string",enum:["New","Underwriting","Offer","Under Contract","Closed","Dead","On Hold"]},note:{type:"string"}},required:["deal_id","new_status"]}},
  {name:"get_financing_summary",description:"Financing/loan summary — requests, amounts, LTV, rates.",input_schema:{type:"object",properties:{}}},
  {name:"query_support_tickets",description:"Query support tickets by status.",input_schema:{type:"object",properties:{status:{type:"string"}}}},
];
async function et(name,input,uid,rid,sb){
  try{switch(name){
    case "assign_task":{const{data,error}=await sb.from("robot_tasks").insert({user_id:uid,robot_id:rid,name:input.name,description:input.description||null,priority:input.priority||"medium",due_date:input.due_date||null,status:"open"}).select().single();return error?{error:error.message}:{success:true,task:{id:data.id,name:data.name,priority:data.priority}};}
    case "query_deals":{let q=sb.from("deals").select("id,deal_name,property_address,city,state,type,deal_status,asking_price,our_offer,arv_value,improvement_budget,sqft_net,units,reap_score,noi_annual,cap_rate,roi,cash_flow_monthly,source,date_added,owner_email,assignee_email").order("date_added",{ascending:false});
      if(input.status)q=q.eq("deal_status",input.status);if(input.search)q=q.or(`property_address.ilike.%${input.search}%,city.ilike.%${input.search}%,deal_name.ilike.%${input.search}%`);
      if(input.sort_by){const m={reap_score:"reap_score",asking_price:"asking_price",arv_value:"arv_value",date_added:"date_added"};q=q.order(m[input.sort_by]||"date_added",{ascending:false});}q=q.limit(input.limit||10);
      const{data,error}=await q;return error?{error:error.message}:{deals:data,count:data?.length||0};}
    case "query_contacts":{let q=sb.from("contacts").select("id,contact_name,company,email,phone,contact_type,temperature,notes").order("contact_name");
      if(input.search)q=q.or(`contact_name.ilike.%${input.search}%,email.ilike.%${input.search}%,company.ilike.%${input.search}%`);if(input.contact_type)q=q.ilike("contact_type",`%${input.contact_type}%`);q=q.limit(input.limit||10);
      const{data,error}=await q;return error?{error:error.message}:{contacts:data,count:data?.length||0};}
    case "get_pipeline_summary":{const{data:deals}=await sb.from("deals").select("deal_status,asking_price,our_offer,arv_value,reap_score,noi_annual,source");if(!deals)return{error:"No deals"};
      const a=deals.filter(d=>!["Dead","Closed"].includes(d.deal_status));const sc={};deals.forEach(d=>{sc[d.deal_status||"?"]=((sc[d.deal_status||"?"])||0)+1;});
      const tv=a.reduce((s,d)=>s+(parseFloat(d.our_offer)||0),0);const scored=a.filter(d=>d.reap_score&&parseFloat(d.reap_score)>0);
      const avg=scored.length?scored.reduce((s,d)=>s+parseFloat(d.reap_score),0)/scored.length:0;const noi=a.reduce((s,d)=>s+(parseFloat(d.noi_annual)||0),0);
      return{total_deals:deals.length,active_deals:a.length,status_breakdown:sc,total_pipeline_value:tv,avg_reap_score:Math.round(avg),total_noi_annual:noi};}
    case "search_memories":{let q=sb.from("robot_memories").select("*").eq("user_id",uid).order("importance",{ascending:false});
      if(input.category)q=q.eq("category",input.category);if(input.query)q=q.or(`title.ilike.%${input.query}%,content.ilike.%${input.query}%`);q=q.limit(8);
      const{data}=await q;if(data?.length){for(const m of data){await sb.from("robot_memories").update({use_count:(m.use_count||0)+1,last_used_at:new Date().toISOString()}).eq("id",m.id);}}
      return{memories:data||[],count:data?.length||0};}
    case "get_exemplars":{let q=sb.from("robot_exemplars").select("*").eq("user_id",uid).order("importance",{ascending:false});
      if(input.channel)q=q.eq("channel",input.channel);q=q.limit(3);const{data}=await q;return{exemplars:data||[],count:data?.length||0};}
    case "create_email_draft":{const{data,error}=await sb.from("robot_artifacts").insert({user_id:uid,robot_id:rid,artifact_type:"email_draft",title:`Email to ${input.to}: ${input.subject}`,summary:input.context||`Email: ${input.subject}`,payload:{to:input.to,cc:input.cc||null,subject:input.subject,body:input.body},status:"draft"}).select().single();
      return error?{error:error.message}:{success:true,artifact:{id:data.id,type:"email_draft",title:data.title},message:`Email drafted: "${input.subject}" to ${input.to}`};}
    case "create_text_draft":{const{data,error}=await sb.from("robot_artifacts").insert({user_id:uid,robot_id:rid,artifact_type:"text_draft",title:`Text to ${input.to_name}`,summary:input.context||`SMS to ${input.to_name}`,payload:{to_name:input.to_name,to_number:input.to_number||null,body:input.body},status:"draft"}).select().single();
      return error?{error:error.message}:{success:true,artifact:{id:data.id,type:"text_draft",title:data.title},message:`Text drafted to ${input.to_name}`};}
    case "create_memo_draft":{const{data,error}=await sb.from("robot_artifacts").insert({user_id:uid,robot_id:rid,artifact_type:"memo_draft",title:input.title,summary:`${input.doc_type||"memo"}: ${input.title}`,payload:{title:input.title,body:input.body,doc_type:input.doc_type||"memo"},status:"draft"}).select().single();
      return error?{error:error.message}:{success:true,artifact:{id:data.id,type:"memo_draft",title:data.title},message:`Draft created: "${input.title}"`};}
    case "get_financial_summary":{let q=sb.from("deals").select("deal_status,asking_price,our_offer,arv_value,improvement_budget,noi_annual,cap_rate,roi,cash_flow_monthly");
      if(input.status)q=q.eq("deal_status",input.status);const{data:deals}=await q;if(!deals)return{error:"No deals"};
      const a=deals.filter(d=>!["Dead","Closed"].includes(d.deal_status));
      return{active_deals:a.length,total_asking:a.reduce((s,d)=>s+(parseFloat(d.asking_price)||0),0),total_offers:a.reduce((s,d)=>s+(parseFloat(d.our_offer)||0),0),total_arv:a.reduce((s,d)=>s+(parseFloat(d.arv_value)||0),0),total_rehab:a.reduce((s,d)=>s+(parseFloat(d.improvement_budget)||0),0),total_noi:a.reduce((s,d)=>s+(parseFloat(d.noi_annual)||0),0),total_cashflow:a.reduce((s,d)=>s+(parseFloat(d.cash_flow_monthly)||0),0),avg_roi:Math.round(a.filter(d=>parseFloat(d.roi)>0).reduce((s,d,_,arr)=>s+parseFloat(d.roi)/arr.length,0)*10)/10,avg_cap:Math.round(a.filter(d=>parseFloat(d.cap_rate)>0).reduce((s,d,_,arr)=>s+parseFloat(d.cap_rate)/arr.length,0)*10)/10};}
    case "add_pipeline_deal":{const{data,error}=await sb.from("deals").insert({user_email:"javier@thesuarezcapital.com",property_address:input.address,city:input.city,state:input.state||"FL",type:input.type||null,asking_price:input.asking_price||null,sqft_net:input.sqft||null,units:input.units||null,deal_status:"New",source:"REAP App",deal_name:input.address,notes:input.notes||null,owner_email:"javier@thesuarezcapital.com",assignee_email:"javier@thesuarezcapital.com"}).select("id,property_address,city,deal_status").single();
      return error?{error:error.message}:{success:true,deal:{id:data.id,address:data.property_address,city:data.city},message:`Deal added: ${data.property_address}, ${data.city}`};}
    case "update_deal_stage":{const updates:any={deal_status:input.new_status};
      if(input.new_status==="Underwriting")updates.underwriting_date=new Date().toISOString();if(input.new_status==="Offer")updates.offer_date=new Date().toISOString();
      if(input.new_status==="Under Contract")updates.under_contract_date=new Date().toISOString();if(input.new_status==="Closed")updates.closed_date=new Date().toISOString();
      const{data,error}=await sb.from("deals").update(updates).eq("id",input.deal_id).select("id,property_address,deal_status").single();
      return error?{error:error.message}:{success:true,deal:{id:data.id,address:data.property_address,new_status:data.deal_status},message:`${data.property_address} → ${input.new_status}`};}
    case "get_financing_summary":{const{data:reqs}=await sb.from("financing_requests").select("*").order("created_at",{ascending:false});if(!reqs)return{error:"No data"};
      const active=reqs.filter(r=>r.status!=="Declined"&&r.status!=="Closed");const sc={};reqs.forEach(r=>{sc[r.status||"Pending"]=(sc[r.status||"Pending"]||0)+1;});
      return{total:reqs.length,active:active.length,total_loan:active.reduce((s,r)=>s+(parseFloat(r.total_loan_amount)||0),0),avg_ltv:Math.round((active.filter(r=>parseFloat(r.ltv)>0).reduce((s,r,_,a)=>s+parseFloat(r.ltv)/a.length,0))*10)/10,avg_rate:Math.round((active.filter(r=>parseFloat(r.interest_rate)>0).reduce((s,r,_,a)=>s+parseFloat(r.interest_rate)/a.length,0))*10)/10,status:sc,recent:reqs.slice(0,5).map(r=>({address:r.deal_address,type:r.financing_type,amount:r.total_loan_amount,rate:r.interest_rate,status:r.status}))};}
    case "query_support_tickets":{let q=sb.from("support_tickets").select("*").order("created_at",{ascending:false});if(input.status)q=q.eq("status",input.status);const{data}=await q;
      return{tickets:data||[],count:data?.length||0,open:data?.filter(t=>t.status==="open").length||0};}
    default:return{error:`Unknown: ${name}`};
  }}catch(e){return{error:e.message};}
}
serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CH});
  try{
    const{robot_id,user_id,message,history}=await req.json();
    if(!robot_id||!user_id||!message)return new Response(JSON.stringify({error:"Missing fields"}),{status:400,headers:{...CH,"Content-Type":"application/json"}});
    const sb=createClient(SU,SK);
    const{data:robot}=await sb.from("robots").select("*").eq("id",robot_id).single();
    if(!robot)return new Response(JSON.stringify({error:"Robot not found"}),{status:404,headers:{...CH,"Content-Type":"application/json"}});
    
    // Phase 7: Filter tools by robot capabilities
    const caps = robot.capabilities || [];
    const robotTools = caps.length > 0 ? ALL_TOOLS.filter(t => caps.includes(t.name)) : ALL_TOOLS;
    
    // Add web search tool (available to all robots, budgeted)
    const apiTools = [...robotTools, {type: "web_search_20250305", name: "web_search", max_uses: 8}];
    
    const sp=await bp(robot,user_id,message,sb);
    let msgs=[...(history||[]).slice(-20),{role:"user",content:message}];
    let ft="";const tc=[];const ar=[];let ti=0,to=0;
    for(let i=0;i<MI;i++){
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":AK,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:robot.model||"claude-sonnet-4-6",max_tokens:2048,system:sp,tools:apiTools,messages:msgs})});
      if(!r.ok)throw new Error(`API ${r.status}: ${await r.text()}`);
      const res=await r.json();ti+=res.usage?.input_tokens||0;to+=res.usage?.output_tokens||0;
      if(res.stop_reason==="end_turn"){ft=res.content.filter(c=>c.type==="text").map(c=>c.text).join("");break;}
      if(res.stop_reason==="tool_use"){const tr=[];for(const b of res.content){if(b.type==="tool_use"){const result=await et(b.name,b.input,user_id,robot_id,sb);tc.push({tool:b.name,input:b.input,result});
        if(result.success&&result.artifact)ar.push(result.artifact);if(result.success&&result.task)ar.push({type:"task",title:result.task.name,id:result.task.id});
        if(result.success&&result.deal)ar.push({type:"deal",title:result.deal.address||result.message,id:result.deal.id});
        tr.push({type:"tool_result",tool_use_id:b.id,content:JSON.stringify(result)});}}msgs=[...msgs,{role:"assistant",content:res.content},{role:"user",content:tr}];continue;}
      ft=res.content.filter(c=>c.type==="text").map(c=>c.text).join("")||"Done.";break;
    }
    const cost=(ti/1e6*3)+(to/1e6*15);
    await sb.from("api_usage_log").insert({service:"Anthropic",endpoint:"robot_chat",cost_estimate:cost}).catch(()=>{});
    const turn={timestamp:new Date().toISOString(),user_message:message,assistant_response:ft,tool_calls:tc,artifacts:ar};
    try{const{data:c}=await sb.from("robot_conversations").select("id,messages").eq("user_id",user_id).eq("robot_id",robot_id).eq("channel_type","workspace").maybeSingle();
      if(c){await sb.from("robot_conversations").update({messages:[...(c.messages||[]),turn],updated_at:new Date().toISOString()}).eq("id",c.id);}
      else{await sb.from("robot_conversations").insert({user_id,robot_id,channel_type:"workspace",messages:[turn]});}}catch(_){}
    return new Response(JSON.stringify({response:ft,tool_calls:tc,artifacts:ar,tokens:{input:ti,output:to,cost}}),{headers:{...CH,"Content-Type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({response:"Error: "+e.message,error:e.message}),{status:500,headers:{...CH,"Content-Type":"application/json"}});}
});
