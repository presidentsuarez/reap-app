import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const MAX_ITERATIONS = 10;
function detectChannel(msg) { const m = msg.toLowerCase(); const ch = ["general"]; if (/email|gmail|reply|inbox/.test(m)) ch.push("email"); if (/text|sms|message them/.test(m)) ch.push("sms"); return ch; }
async function buildSystemPrompt(robot, userId, userMessage, sb) {
  const p = [];
  p.push(`You are ${robot.name}, a ${robot.role}.`);
  if (robot.personality) p.push(robot.personality);
  if (robot.description) p.push(robot.description);
  p.push("");
  try { const { data: soul } = await sb.from("org_soul").select("*").eq("user_id", userId).eq("active", true).maybeSingle();
    if (soul) { p.push("=== ORGANIZATION ==="); p.push(`Company: ${soul.org_name}`); if (soul.mission) p.push(`Mission: ${soul.mission}`); if (soul.vision) p.push(`Vision: ${soul.vision}`);
      if (soul.values?.length) { p.push("Values:"); soul.values.forEach(v => p.push(`  - ${v.value}: ${v.description}`)); }
      if (soul.voice_principles?.length) { p.push("Voice:"); soul.voice_principles.forEach(v => p.push(`  - ${v.principle}: ${v.description}`)); }
      if (soul.things_we_dont_do?.length) { p.push("Don'ts:"); soul.things_we_dont_do.forEach(v => p.push(`  - ${v.rule}`)); }
      if (soul.decision_precedents?.length) { p.push("Precedents:"); soul.decision_precedents.forEach(v => p.push(`  - ${v.precedent}`)); }
      p.push(""); } } catch(_){}
  try { const ch = detectChannel(userMessage); const { data: rules } = await sb.from("robot_style_guide").select("*").eq("user_id", userId).eq("active", true).in("channel", ch).order("importance", { ascending: false });
    if (rules?.length) { p.push("=== STYLE GUIDE ==="); rules.forEach(r => { p.push(`${r.rule_title} [${r.channel}]: DO: ${r.do_text || ""} | DON'T: ${r.dont_text || ""}`); }); p.push(""); } } catch(_){}
  try { const { data: mem } = await sb.from("robot_memories").select("*").eq("user_id", userId).order("importance", { ascending: false }).limit(10);
    if (mem?.length) { p.push("=== MEMORIES ==="); mem.forEach(m => p.push(`- [${m.category}] ${m.title}: ${m.content}`)); p.push(""); } } catch(_){}
  try { const { data: ex } = await sb.from("robot_exemplars").select("id, title, channel, why_its_good").eq("user_id", userId).order("importance", { ascending: false }).limit(5);
    if (ex?.length) { p.push("=== EXEMPLARS (use get_exemplars for full content) ==="); ex.forEach(e => p.push(`- "${e.title}" [${e.channel}]`)); p.push(""); } } catch(_){}
  p.push(`Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`);
  p.push("You work for Javier Suarez at REAP and Tampa Development Group.");
  p.push("\nRULES: Be concise. Use tools for real data. Never make up numbers. Format currency as $X,XXX. Outbound comms are ALWAYS drafts.");
  return p.join("\n");
}
const tools = [
  { name: "assign_task", description: "Create a task/reminder/to-do.", input_schema: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, priority: { type: "string", enum: ["low","medium","high","urgent"] }, due_date: { type: "string" } }, required: ["name"] } },
  { name: "query_deals", description: "Query real estate deals from REAP. Look up pipeline, properties, financials, REAP scores.", input_schema: { type: "object", properties: { search: { type: "string" }, status: { type: "string" }, sort_by: { type: "string", enum: ["reap_score","asking_price","arv_value","date_added"] }, limit: { type: "number" } } } },
  { name: "query_contacts", description: "Query contacts from REAP CRM. Look up lenders, buyers, investors, wholesalers.", input_schema: { type: "object", properties: { search: { type: "string" }, contact_type: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_pipeline_summary", description: "Get pipeline summary — counts, total value, avg REAP score, NOI.", input_schema: { type: "object", properties: {} } },
  { name: "search_memories", description: "Search knowledge base for memories, decisions, preferences. Use when user references something contextual.", input_schema: { type: "object", properties: { query: { type: "string" }, category: { type: "string" } }, required: ["query"] } },
  { name: "get_exemplars", description: "Get gold-standard communication examples to model drafts on.", input_schema: { type: "object", properties: { channel: { type: "string" }, tags: { type: "array", items: { type: "string" } } } } },
];
async function executeTool(name, input, userId, robotId, sb) {
  try { switch(name) {
    case "assign_task": { const { data, error } = await sb.from("robot_tasks").insert({ user_id: userId, robot_id: robotId, name: input.name, description: input.description||null, priority: input.priority||"medium", due_date: input.due_date||null, status: "open" }).select().single(); return error ? { error: error.message } : { success: true, task: { id: data.id, name: data.name, priority: data.priority } }; }
    case "query_deals": { let q = sb.from("deals").select("id,deal_name,property_address,city,state,type,deal_status,asking_price,our_offer,arv_value,improvement_budget,sqft_net,units,reap_score,noi_annual,cap_rate,roi,cash_flow_monthly,source,date_added,owner_email,assignee_email").order("date_added",{ascending:false});
      if(input.status) q=q.eq("deal_status",input.status); if(input.search) q=q.or(`property_address.ilike.%${input.search}%,city.ilike.%${input.search}%,deal_name.ilike.%${input.search}%`);
      if(input.sort_by){const m={reap_score:"reap_score",asking_price:"asking_price",arv_value:"arv_value",date_added:"date_added"};q=q.order(m[input.sort_by]||"date_added",{ascending:false});} q=q.limit(input.limit||10);
      const{data,error}=await q; return error?{error:error.message}:{deals:data,count:data?.length||0}; }
    case "query_contacts": { let q=sb.from("contacts").select("id,contact_name,company,email,phone,contact_type,temperature,notes").order("contact_name");
      if(input.search)q=q.or(`contact_name.ilike.%${input.search}%,email.ilike.%${input.search}%,company.ilike.%${input.search}%`); if(input.contact_type)q=q.ilike("contact_type",`%${input.contact_type}%`); q=q.limit(input.limit||10);
      const{data,error}=await q; return error?{error:error.message}:{contacts:data,count:data?.length||0}; }
    case "get_pipeline_summary": { const{data:deals}=await sb.from("deals").select("deal_status,asking_price,our_offer,arv_value,reap_score,noi_annual,source"); if(!deals) return{error:"No deals"};
      const active=deals.filter(d=>!["Dead","Closed"].includes(d.deal_status)); const sc={}; deals.forEach(d=>{sc[d.deal_status||"Unknown"]=(sc[d.deal_status||"Unknown"]||0)+1;});
      const tv=active.reduce((s,d)=>s+(parseFloat(d.our_offer)||0),0); const scored=active.filter(d=>d.reap_score&&parseFloat(d.reap_score)>0);
      const avg=scored.length?scored.reduce((s,d)=>s+parseFloat(d.reap_score),0)/scored.length:0; const noi=active.reduce((s,d)=>s+(parseFloat(d.noi_annual)||0),0);
      return{total_deals:deals.length,active_deals:active.length,status_breakdown:sc,total_pipeline_value:tv,avg_reap_score:Math.round(avg),total_noi_annual:noi}; }
    case "search_memories": { let q=sb.from("robot_memories").select("*").eq("user_id",userId).order("importance",{ascending:false});
      if(input.category)q=q.eq("category",input.category); if(input.query)q=q.or(`title.ilike.%${input.query}%,content.ilike.%${input.query}%`); q=q.limit(8);
      const{data}=await q; if(data?.length){for(const m of data){await sb.from("robot_memories").update({use_count:(m.use_count||0)+1,last_used_at:new Date().toISOString()}).eq("id",m.id);}}
      return{memories:data||[],count:data?.length||0}; }
    case "get_exemplars": { let q=sb.from("robot_exemplars").select("*").eq("user_id",userId).order("importance",{ascending:false});
      if(input.channel)q=q.eq("channel",input.channel); q=q.limit(3); const{data}=await q;
      return{exemplars:data||[],count:data?.length||0}; }
    default: return{error:`Unknown tool: ${name}`};
  }} catch(e){return{error:e.message};}
}
serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    const{robot_id,user_id,message,history}=await req.json();
    if(!robot_id||!user_id||!message)return new Response(JSON.stringify({error:"Missing fields"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
    const sb=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY);
    const{data:robot}=await sb.from("robots").select("*").eq("id",robot_id).single();
    if(!robot)return new Response(JSON.stringify({error:"Robot not found"}),{status:404,headers:{...corsHeaders,"Content-Type":"application/json"}});
    const sysPrompt=await buildSystemPrompt(robot,user_id,message,sb);
    let msgs=[...(history||[]).slice(-20),{role:"user",content:message}];
    let finalText="";const allTC=[];const allArt=[];let tIn=0,tOut=0;
    for(let i=0;i<MAX_ITERATIONS;i++){
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:robot.model||"claude-sonnet-4-6",max_tokens:2048,system:sysPrompt,tools,messages:msgs})});
      if(!r.ok)throw new Error(`API ${r.status}: ${await r.text()}`);
      const res=await r.json(); tIn+=res.usage?.input_tokens||0; tOut+=res.usage?.output_tokens||0;
      if(res.stop_reason==="end_turn"){finalText=res.content.filter(c=>c.type==="text").map(c=>c.text).join("");break;}
      if(res.stop_reason==="tool_use"){const tr=[];for(const b of res.content){if(b.type==="tool_use"){const result=await executeTool(b.name,b.input,user_id,robot_id,sb);allTC.push({tool:b.name,input:b.input,result});if(b.name==="assign_task"&&result.success)allArt.push({type:"task",title:result.task.name,id:result.task.id});tr.push({type:"tool_result",tool_use_id:b.id,content:JSON.stringify(result)});}}msgs=[...msgs,{role:"assistant",content:res.content},{role:"user",content:tr}];continue;}
      finalText=res.content.filter(c=>c.type==="text").map(c=>c.text).join("")||"Done.";break;
    }
    const cost=(tIn/1e6*3)+(tOut/1e6*15);
    await sb.from("api_usage_log").insert({service:"Anthropic",endpoint:"robot_chat",cost_estimate:cost}).catch(()=>{});
    const turn={timestamp:new Date().toISOString(),user_message:message,assistant_response:finalText,tool_calls:allTC,artifacts:allArt};
    try{const{data:c}=await sb.from("robot_conversations").select("id,messages").eq("user_id",user_id).eq("robot_id",robot_id).eq("channel_type","workspace").maybeSingle();
      if(c){await sb.from("robot_conversations").update({messages:[...(c.messages||[]),turn],updated_at:new Date().toISOString()}).eq("id",c.id);}
      else{await sb.from("robot_conversations").insert({user_id,robot_id,channel_type:"workspace",messages:[turn]});}}catch(_){}
    return new Response(JSON.stringify({response:finalText,tool_calls:allTC,artifacts:allArt,tokens:{input:tIn,output:tOut,cost}}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({response:"Error: "+e.message,error:e.message}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});}
});
