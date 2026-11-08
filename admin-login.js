import { json, method, signSession } from './_lib.js';
import crypto from 'node:crypto';
export default async function handler(req,res){
 if(!method(req,res))return;
 const password=String(req.body?.password||''),expected=String(process.env.ADMIN_PASSWORD||'');
 if(!expected||password.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(password),Buffer.from(expected)))return json(res,401,{error:'Incorrect owner password'});
 res.setHeader('Set-Cookie',`jpnk_owner=${signSession()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);
 return json(res,200,{ok:true});
}
