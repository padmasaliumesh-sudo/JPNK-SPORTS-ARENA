import { supabase, json, method } from './_lib.js';
import crypto from 'node:crypto';

const DAY=400, NIGHT=600;
const priceFor = slot => Number(slot.slice(-2)) >= 18 || Number(slot.slice(-2)) < 6 ? NIGHT : DAY;
const newCode = () => 'JPNK-' + crypto.randomBytes(5).toString('hex').toUpperCase();

export default async function handler(req,res) {
  if (!method(req,res)) return;
  try {
    const {name, phone, slots} = req.body || {};
    if (!name?.trim() || !/^[6-9]\d{9}$/.test(phone || '') || !Array.isArray(slots) || !slots.length || slots.length > 336)
      return json(res,400,{error:'Enter a valid name, Indian mobile number and 1–336 slots.'});
    const today = new Date(); today.setHours(0,0,0,0);
    const maxDate = new Date(today); maxDate.setDate(maxDate.getDate()+13);
    const invalidSlot = slots.some(s => {
      if (!/^\d{4}-\d{2}-\d{2}_([0-1][0-9]|2[0-3])$/.test(s)) return true;
      const [date,hour] = s.split('_'); const d = new Date(`${date}T00:00:00`);
      return Number.isNaN(d.getTime()) || d < today || d > maxDate || d.toISOString().slice(0,10) !== date;
    });
    if (new Set(slots).size !== slots.length || invalidSlot)
      return json(res,400,{error:'Invalid, past, duplicate or out-of-range slot selection.'});
    const amount = slots.reduce((sum,s)=>sum+priceFor(s),0);
    const bid = newCode();
    const accessToken = crypto.randomBytes(32).toString('hex');
    // SQL RPC locks all selected slots atomically and creates a short-lived pending-payment booking.
    const {data,error} = await supabase.rpc('jpnk_create_booking_hold',{p_code:bid,p_name:name.trim(),p_phone:phone,p_slots:slots,p_amount:amount});
    if(error) return json(res,409,{error:error.message});
    const closeBy = Math.floor(Date.now()/1000)+10*60;
    const qrResp = await fetch('https://api.razorpay.com/v1/payments/qr_codes',{
      method:'POST', headers:{Authorization:'Basic '+Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64'),'Content-Type':'application/json'},
      body:JSON.stringify({type:'upi_qr',name:`JPNK ${bid}`,usage:'single_use',fixed_amount:true,payment_amount:amount*100,description:`JPNK Sports Arena booking ${bid}`,close_by:closeBy,notes:{booking_code:bid}})
    });
    const qr = await qrResp.json();
    if(!qrResp.ok) { await supabase.rpc('jpnk_cancel_unpaid_booking',{p_code:bid}); return json(res,502,{error:qr.error?.description || 'Could not create payment QR. Check Razorpay QR Code activation.'}); }
    const {error:saveErr}=await supabase.from('bookings').update({razorpay_qr_id:qr.id,qr_image_url:qr.image_url,qr_short_url:qr.image_url,access_token:accessToken}).eq('code',bid);
    if(saveErr) { await supabase.rpc('jpnk_cancel_unpaid_booking',{p_code:bid}); return json(res,500,{error:'Could not save payment reference.'}); }
    return json(res,201,{bookingCode:bid,accessToken,amount,qrId:qr.id,qrImageUrl:qr.image_url,qrUrl:qr.image_url,expiresAt:qr.close_by});
  } catch(e) { return json(res,500,{error:'Unexpected server error.'}); }
}
