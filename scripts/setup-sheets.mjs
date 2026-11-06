import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});
import { google } from 'googleapis';
const spreadsheetId=process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
if(!spreadsheetId||!process.env.GOOGLE_SERVICE_ACCOUNT_JSON){console.error('Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON first.');process.exit(1);}
const credentials=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const auth=new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets']});
const api=google.sheets({version:'v4',auth});
const tabs={Inventory:['ID','Picture','Buying Price','size','Target Price','Status','method Payment','price sold','Profit Margin','comment','Date','Category','Stock Type'],Orders:['Order ID','Shoe ID','Customer Name','Phone','Location','Comment','Date','Status'],Admins:['Username','PasswordHash','Salt','Role','Active'],History:['Timestamp','Shoe ID','Field Changed','Old Value','New Value','Changed By','Full Row Snapshot','Action']};
const meta=await api.spreadsheets.get({spreadsheetId});
const existing=new Set((meta.data.sheets??[]).map(s=>s.properties?.title));
const requests=[];
for(const [title,headers] of Object.entries(tabs)){
 if(!existing.has(title)){requests.push({addSheet:{properties:{title}}});}
}
if(requests.length) await api.spreadsheets.batchUpdate({spreadsheetId,requestBody:{requests}});
for(const [title,headers] of Object.entries(tabs)){
 const res=await api.spreadsheets.values.get({spreadsheetId,range:`${title}!A1:Z1`});
 if(!res.data.values?.length) await api.spreadsheets.values.update({spreadsheetId,range:`${title}!A1`,valueInputOption:'RAW',requestBody:{values:[headers]}});
}
console.log('Sheet tabs checked. Existing data was not overwritten.');
