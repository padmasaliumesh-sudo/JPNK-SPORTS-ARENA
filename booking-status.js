import { supabase, json, method } from './_lib.js';
import crypto from 'node:crypto';
export default async function handler(req,res){
 if(!method(req,res,'GET'))return;
 const code=String(req.query.code||''),token=String(req.query.token||'');
 if(!/^JPNK-[A-F0-9]{10}$/.test(code)||!/^[a-f0-9]{64}$/.test(token))return json(res,400,{error:'Invalid booking reference'});
 const {data,error}=await supabase.from('bookings').select('code,status,slots,amount,access_token,paid_at').eq('code',code).maybeSingle();
 if(error)return json(res,500,{error:'Could not read booking status'});
 if(!data||!data.access_token||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(data.access_token)))return json(res,404,{error:'Booking not found'});
 return json(res,200,{booking:{code:data.code,status:data.status,slots:data.slots,amount:data.amount,paid_at:data.paid_at}});
}
