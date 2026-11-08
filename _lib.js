import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
export const json = (res, status, body) => res.status(status).setHeader('Content-Type','application/json').json(body);
export const method = (req, res, allowed='POST') => {
  if (req.method !== allowed) { json(res,405,{error:'Method not allowed'}); return false; }
  return true;
};
export const razorpayAuth = () => 'Basic ' + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
export const verifyWebhook = (raw, signature) => {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  if (!signature || signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

export const signSession = () => {
 const payload = Buffer.from(JSON.stringify({exp:Date.now()+8*60*60*1000,role:'owner'})).toString('base64url');
 const sig=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(payload).digest('base64url');
 return payload+'.'+sig;
};
export const validSession = token => {
 try { const [p,s]=String(token||'').split('.'); if(!p||!s)return false;
  const expected=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(p).digest();
  const got=Buffer.from(s,'base64url'); if(got.length!==expected.length||!crypto.timingSafeEqual(got,expected))return false;
  const d=JSON.parse(Buffer.from(p,'base64url').toString()); return d.role==='owner'&&d.exp>Date.now();
 } catch { return false; }
};
export const isOwner = req => { const c=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('jpnk_owner=')); return validSession(c?.slice('jpnk_owner='.length)); };
