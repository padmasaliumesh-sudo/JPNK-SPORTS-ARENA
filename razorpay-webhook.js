import { supabase, json, verifyWebhook } from './_lib.js';
import crypto from 'node:crypto';
export const config = { api: { bodyParser: false } };
async function rawBody(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks);}
export default async function handler(req,res){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
  const raw=await rawBody(req),sig=req.headers['x-razorpay-signature'];
  if(!verifyWebhook(raw,sig)) return json(res,401,{error:'Invalid webhook signature'});
  let event;try{event=JSON.parse(raw.toString('utf8'));}catch{return json(res,400,{error:'Invalid JSON'});}
  if(event.event!=='qr_code.credited') return res.status(200).send('ignored');
  const payment=event.payload?.payment?.entity, qr=event.payload?.qr_code?.entity;
  const code=qr?.notes?.booking_code;
  if(!payment || payment.status!=='captured' || !code) return json(res,400,{error:'Missing captured payment or booking reference'});
  const {data:booking,error}=await supabase.from('bookings').select('*').eq('code',code).maybeSingle();
  if(error || !booking) return json(res,404,{error:'Booking not found'});
  if(booking.status==='confirmed') return res.status(200).send('already processed');
  if(Number(payment.amount)!==Number(booking.amount)*100 || payment.currency!=='INR' || qr.id!==booking.razorpay_qr_id)
    return json(res,409,{error:'Payment does not match booking amount or QR reference'});
  // Idempotency: payment ID is unique; confirmation RPC is transactional.
  const {error:confirmError}=await supabase.rpc('jpnk_confirm_paid_booking',{p_code:code,p_payment_id:payment.id,p_rrn:payment.acquirer_data?.rrn||null});
  if(confirmError) return json(res,500,{error:'Payment received but booking confirmation needs reconciliation.'});
  // WhatsApp Cloud API requires an approved template for business-initiated messages.
  if(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME){
    const params=[booking.name,booking.code,`₹${booking.amount}`,booking.slots.join(', ')].map(text=>({type:'text',text:String(text)}));
    await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:`91${booking.phone}`,type:'template',template:{name:process.env.WHATSAPP_TEMPLATE_NAME,language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE||'en'},components:[{type:'body',parameters:params}]}})}).catch(()=>{});
  }
  return res.status(200).send('ok');
}
