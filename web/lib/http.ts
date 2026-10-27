export async function readApiResponse(response:Response){
 const text=await response.text();
 let data;
 try{data=JSON.parse(text);}catch{
  throw new Error(`Server returned ${text.trim()?'an invalid':'an empty'} response (HTTP ${response.status}). Please retry. If it continues, check the Vercel runtime logs for this request.`);
 }
 if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:`Request failed (HTTP ${response.status}).`);
 return data;
}
