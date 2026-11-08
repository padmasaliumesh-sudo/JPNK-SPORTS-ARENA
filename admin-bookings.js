import { supabase, json, method, isOwner } from './_lib.js';
export default async function handler(req,res){
 if(!method(req,res,'GET'))return;
 if(!isOwner(req))return json(res,401,{error:'Owner sign-in required'});
 const {data,error}=await supabase.from('bookings').select('code,name,phone,slots,amount,status,created_at,paid_at').order('created_at',{ascending:false}).limit(200);
 if(error)return json(res,500,{error:'Could not load bookings'});
 return json(res,200,{bookings:data||[]});
}
