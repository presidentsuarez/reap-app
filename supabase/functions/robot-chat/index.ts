import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const AK = Deno.env.get("ANTHROPIC_API_KEY")||"";
const SU = Deno.env.get("SUPABASE_URL")||"";
const SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const CH = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const MI = 10;
function dc(m){const l=m.toLowerCase();const c=["general"];if(/email|gmail|reply|inbox|draft.*email/.test(l))c.push("email");if(/text|sms|message them|send.*text/.test(l))c.push("sms");return c;}
async function bp(r,uid,msg,sb){
  const p=[];
  p.push(`You are ${r.name}, a ${r.role}.`);if(r.personality)p.push(r.personality);if(r.description)p.push(r.description);p.push("");
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
  p.push("RULES:");
  p.push("- Be concise. Use tools for real data. Never make up numbers.");
  p.push("- Format currency as $X,XXX. Percentages as X.X%.");
  p.push("- Emails, texts, and messages are ALWAYS created as DRAFTS using the draft tools. Never imply you sent something — say 'drafted for your review.'");
  p.push("- When user asks to draft/write/compose an email, use create_email_draft. When they ask to draft a text/SMS, use create_text_draft.");
  p.push("- Use search_memories for contextual knowledge you don't see in your memories.");
  return p.join("\n");
}
const tools=[
  {name:"assign_task",description:"Create a task/reminder/to-do.",input_schema:{type:"object",properties:{name:{type:"string"},description:{type:"string"},priority:{type:"string",enum:["low","medium","high","urgent"]},due_date:{type:"string"}},required:["name"]}},
  {name:"query_deals",description:"Query real estate deals. Look up pipeline, properties, financials, REAP scores.",input_schema:{type:"object",properties:{search:{type:"string"},status:{type:"string"},sort_by:{type:"string",enum:["reap_score","asking_price","arv_value","date_added"]},limit:{type:"number"}}}},
  {name:"query_contacts",description:"Query contacts from CRM. Look up lenders, buyers, investors, wholesalers.",input_schema:{type:"object",properties:{search:{type:"string"},contact_type:{type:"string"},limit:{type:"number"}}}},
  {name:"get_pipeline_summary",description:"Get pipeline summary — counts, total value, avg REAP score.",input_schema:{type:"object",properties:{}}},
  {name:"search_memories",description:"Search knowledge base for context, decisions, preferences.",input_schema:{type:"object",properties:{query:{type:"string"},category:{type:"string"}},required:["query"]}},
  {name:"get_exemplars",description:"Get gold-standard communication examples.",input_schema:{type:"object",properties:{channel:{type:"string"}}}},
  {name:"create_email_draft",description:"Draft an email for the user to review before sending. Use when user asks to write, draft, compose, or reply to an email. ALWAYS use this tool for email-related requests.",input_schema:{type:"object",properties:{to:{type:"string",description:"Recipient email address"},cc:{type:"string",description:"CC recipients (optional)"},subject:{type:"string",description:"Email subject line"},body:{type:"string",description:"Email body text (plain text or HTML)"},context:{type:"string",description:"Why this email is being drafted (internal note)"}},required:["to","subject","body"]}},
  {name:"create_text_draft",description:"Draft a text/SMS message for the user to review before sending. Use when user asks to text, message, or SMS someone.",input_schema:{type:"object",properties:{to_name:{type:"string",description:"Recipient name"},to_number:{type:"string",description:"Phone number (if known)"},body:{type:"string",description:"Message text (keep under 160 chars when possible)"},context:{type:"string",description:"Why this text is being drafted"}},required:["to_name","body"]}},
  {name:"create_memo_draft",description:"Draft a memo, note, or document for the user to review. Use for anything that isn't email or text — reports, summaries, talking points, proposals.",input_schema:{type:"object",properties:{title:{type:"string",description:"Document title"},body:{type:"string",description:"Full document content"},doc_type:{type:"string",description:"Type: memo, report, summary, proposal, talking_points, letter"}},required:["title","body"]}},
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
    case "create_email_draft":{
      const{data,error}=await sb.from("robot_artifacts").insert({user_id:uid,robot_id:rid,artifact_type:"email_draft",title:`Email to ${input.to}: ${input.subject}`,summary:input.context||`Email draft: ${input.subject}`,
        payload:{to:input.to,cc:input.cc||null,subject:input.subject,body:input.body,context:input.context||null},status:"draft"}).select().single();
      if(error)return{error:error.message};
      return{success:true,artifact:{id:data.id,type:"email_draft",title:data.title},message:`Email draft created: "${input.subject}" to ${input.to}. Review it in your Drafts tab.`};}
    case "create_text_draft":{
      const{data,error}=await sb.from("robot_artifacts").insert({user_id:uid,robot_id:rid,artifact_type:"text_draft",title:`Text to ${input.to_name}`,summary:input.context||`SMS draft to ${input.to_name}`,
        payload:{to_name:input.to_name,to_number:input.to_number||null,body:input.body,context:input.context||null},status:"draft"}).select().single();
      if(error)return{error:error.message};
      return{success:true,artifact:{id:data.id,type:"text_draft",title:data.title},message:`Text draft created to ${input.to_name}. Review it in your Drafts tab.`};}
    case "create_memo_draft":{
      const{data,error}=await sb.from("robot_artifacts").insert({user_id:uid,robot_id:rid,artifact_type:"memo_draft",title:input.title,summary:`${input.doc_type||"memo"}: ${input.title}`,
        payload:{title:input.title,body:input.body,doc_type:input.doc_type||"memo"},status:"draft"}).select().single();
      if(error)return{error:error.message};
      return{success:true,artifact:{id:data.id,type:"memo_draft",title:data.title},message:`Draft created: "${input.title}". Review it in your Drafts tab.`};}
    default:return{error:`Unknown tool: ${name}`};
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
    const sp=await bp(robot,user_id,message,sb);
    let msgs=[...(history||[]).slice(-20),{role:"user",content:message}];
    let ft="";const tc=[];const ar=[];let ti=0,to=0;
    for(let i=0;i<MI;i++){
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":AK,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:robot.model||"claude-sonnet-4-6",max_tokens:2048,system:sp,tools,messages:msgs})});
      if(!r.ok)throw new Error(`API ${r.status}: ${await r.text()}`);
      const res=await r.json();ti+=res.usage?.input_tokens||0;to+=res.usage?.output_tokens||0;
      if(res.stop_reason==="end_turn"){ft=res.content.filter(c=>c.type==="text").map(c=>c.text).join("");break;}
      if(res.stop_reason==="tool_use"){const tr=[];for(const b of res.content){if(b.type==="tool_use"){const result=await et(b.name,b.input,user_id,robot_id,sb);tc.push({tool:b.name,input:b.input,result});
        if(result.success&&result.artifact)ar.push(result.artifact);if(result.success&&result.task)ar.push({type:"task",title:result.task.name,id:result.task.id});
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
