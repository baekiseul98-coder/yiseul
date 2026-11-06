const statuses=['todo','doing','done'], priorities=['high','normal','low'];
function validate(t){if(!t||typeof t!=='object'||typeof t.title!=='string'||!t.title.trim()||t.title.length>150||typeof t.description!=='string'||t.description.length>5000||!statuses.includes(t.status)||!priorities.includes(t.priority)||typeof t.due!=='string'||(t.due!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(t.due)))throw Error('입력값을 확인해 주세요.');return {title:t.title.trim(),description:t.description,status:t.status,priority:t.priority,due:t.due||null};}
const convert=t=>({id:t.id,title:t.title,description:t.description,status:t.status,priority:t.priority,due:t.due||'',created:Date.parse(t.created_at)});
export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');
if(!['GET','POST','PATCH','DELETE','PUT'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY,authorization=req.headers.authorization;
if(!url||!key)return res.status(503).json({error:'서버 설정이 필요합니다.'});
if(!authorization?.startsWith('Bearer '))return res.status(401).json({error:'로그인해 주세요.'});
const headers={apikey:key,Authorization:authorization,'Content-Type':'application/json'};
try{
const auth=await fetch(url+'/auth/v1/user',{headers});if(!auth.ok)return res.status(401).json({error:'로그인이 만료되었습니다. 다시 로그인해 주세요.'});const user=await auth.json();
const db=async(path,method='GET',body)=>{const response=await fetch(url+'/rest/v1/'+path,{method,headers:{...headers,Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{})});if(!response.ok){const e=Error('데이터베이스 요청 실패');e.status=response.status;throw e;}return response.status===204?null:response.json()};
let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'잘못된 JSON입니다.'})}}
if(req.method==='POST'){let values;try{values=validate(body)}catch(e){return res.status(400).json({error:e.message})}await db('tasks','POST',{...values,user_id:user.id});}
if(req.method==='PATCH'||req.method==='DELETE'){
if(typeof body?.id!=='string'||!body.id||body.id.length>100)return res.status(400).json({error:'잘못된 카드 ID입니다.'});
const path='tasks?id=eq.'+encodeURIComponent(body.id)+'&user_id=eq.'+user.id;
if(req.method==='DELETE'){const rows=await db(path,'DELETE');if(!rows?.length)return res.status(404).json({error:'카드가 없습니다.'});}
else{let patch;try{if(Object.keys(body).every(k=>['id','status'].includes(k))){if(!statuses.includes(body.status))throw Error('잘못된 상태입니다.');patch={status:body.status}}else patch=validate(body)}catch(e){return res.status(400).json({error:e.message})}const rows=await db(path,'PATCH',patch);if(!rows?.length)return res.status(404).json({error:'카드가 없습니다.'});}}
if(req.method==='PUT'){let rows;try{if(!Array.isArray(body?.tasks)||body.tasks.length>5000)throw Error('백업은 최대 5000개 카드까지 지원합니다.');rows=body.tasks.map(t=>{const v=validate(t);if(typeof t.id!=='string'||!t.id||t.id.length>100||!Number.isFinite(t.created)||!Number.isFinite(new Date(t.created).getTime()))throw Error('잘못된 백업입니다.');return {...v,id:t.id,created_at:new Date(t.created).toISOString()}});if(new Set(rows.map(t=>t.id)).size!==rows.length)throw Error('중복 ID가 있습니다.')}catch(e){return res.status(400).json({error:e.message})}await db('rpc/replace_tasks','POST',{items:rows});}
const rows=await db('tasks?select=*&order=created_at.desc&user_id=eq.'+user.id+'&limit=5001');
if(rows.length>5000)return res.status(409).json({error:'카드가 5000개를 초과했습니다. 페이지네이션 확장이 필요합니다.'});
return res.json(rows.map(convert));
}catch(e){console.error('Task API error:',e.message);return res.status(502).json({error:'Supabase 요청에 실패했습니다. 잠시 후 새로고침하여 실제 저장 상태를 확인해 주세요.'})}
}
