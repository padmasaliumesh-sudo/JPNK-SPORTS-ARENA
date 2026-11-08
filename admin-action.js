import { supabase, json, method, isOwner } from './_lib.js';
export default async function handler(req,res){
 if(!method(req,res))return;
 if(!isOwner(req))return json(res,401,{error:'Owner sign-in required'});
 const {code,action}=req.body||{};
 if(!/^JPNK-[A-F0-9]{10}$/.test(String(code||''))||action!=='cancel')return json(res,400,{error:'Invalid action'});
 const {data,error}=await supabase.rpc('jpnk_admin_cancel_booking',{p_code:code});
 if(error)return json(res,409,{error:error.message});
 return json(res,200,{ok:true});
}
