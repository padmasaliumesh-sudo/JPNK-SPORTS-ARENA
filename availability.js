import { supabase, json, method } from './_lib.js';
export default async function handler(req,res){
 if(!method(req,res,'GET')) return;
 const from=String(req.query.from||''),to=String(req.query.to||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)) return json(res,400,{error:'Invalid date range'});
 const {data,error}=await supabase.from('booked_slots').select('slot_key,confirmed,expires_at').gte('slot_key',from+'_00').lte('slot_key',to+'_23');
 if(error) return json(res,500,{error:'Availability unavailable'});
 const busy=(data||[]).filter(x=>x.confirmed||new Date(x.expires_at)>new Date()).map(x=>x.slot_key);
 return json(res,200,{busy});
}
