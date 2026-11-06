import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { appendRow, driveImageUrl, readRows, updateRow } from '@/lib/sheets';
export const runtime = 'nodejs';
export async function GET() {
 if(!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({success:false},{status:401});
 try { const rows=await readRows('Inventory'); return NextResponse.json({success:true, shoes:rows.slice(1).filter(r=>r[0]).map((r,i)=>({rowNumber:i+2,id:String(r[0]),picture:driveImageUrl(r[1]),originalPicture:String(r[1]??''),buyingPrice:Number(r[2])||0,size:r[3],targetPrice:Number(r[4])||0,status:String(r[5]??''),payment:String(r[6]??''),priceSold:Number(r[7])||0,comment:String(r[9]??''),category:String(r[11]??'General'),stockType:r[12]}))}); } catch(e){return NextResponse.json({success:false,message:e instanceof Error?e.message:'Failed'},{status:500});}
}
export async function POST(req:NextRequest) {
 if(!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({success:false},{status:401});
 try { const b=await req.json(); const buy=Number(b.buyingPrice), target=Number(b.targetPrice), size=String(b.size??'').trim(); if(!size||!Number.isFinite(buy)||buy<0||!Number.isFinite(target)||target<0) return NextResponse.json({success:false,message:'Enter a valid size, buying price and selling price.'},{status:400}); const rows=await readRows('Inventory'); const batch=rows.slice(1).reduce((m,r)=>Math.max(m,Number(r[12])||0),0)+1; const id=`SHOE-${crypto.randomUUID()}`; await appendRow('Inventory',[id,String(b.picture??''),buy,size,target,'Available','','','',String(b.comment??''),'',String(b.category??'General'),Number(b.stockType)||batch]); return NextResponse.json({success:true,id}); } catch(e){return NextResponse.json({success:false,message:e instanceof Error?e.message:'Could not add shoe.'},{status:500});}
}
export async function PATCH(req:NextRequest) {
 if(!await requireAdmin(['Super Admin', 'Admin'])) return NextResponse.json({success:false},{status:401});
 try { const b=await req.json(); const rows=await readRows('Inventory'); const index=rows.findIndex((r,i)=>i>0&&String(r[0])===String(b.id)); if(index<1)return NextResponse.json({success:false,message:'Shoe not found.'},{status:404}); const row=[...rows[index]]; if(b.status!==undefined){if(!['Available','Reserved','Sold'].includes(b.status))return NextResponse.json({success:false,message:'Invalid status.'},{status:400});row[5]=b.status;} if(b.priceSold!==undefined)row[7]=Number(b.priceSold)||0; if(b.payment!==undefined)row[6]=String(b.payment); if(b.comment!==undefined)row[9]=String(b.comment); if(b.status==='Sold')row[10]=new Date().toISOString(); const cost=Number(row[2])||0, sold=Number(row[7])||0; row[8]=sold?(sold-cost)/sold:''; await updateRow('Inventory',index+1,row); return NextResponse.json({success:true}); }catch(e){return NextResponse.json({success:false,message:e instanceof Error?e.message:'Update failed.'},{status:500});}
}
