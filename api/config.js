export default function handler(req,res){
res.setHeader('Cache-Control','no-store');
if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
if(!url||!key)return res.status(503).json({error:'Supabase 설정이 필요합니다.'});
return res.json({url,key});
}
