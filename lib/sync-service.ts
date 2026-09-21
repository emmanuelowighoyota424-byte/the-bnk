const STORAGE_KEY = "chase_banking_data"
const SYNC_KEY = "chase_banking_last_sync"
export interface SyncStatus { lastSynced:string|null; isOnline:boolean; isSyncing:boolean }
export function getLocalData(): any|null { if(typeof window==="undefined") return null; try { const saved=localStorage.getItem(STORAGE_KEY); return saved?JSON.parse(saved):null } catch { return null } }
export function saveLocalData(data:any):void { if(typeof window==="undefined") return; try { localStorage.setItem(STORAGE_KEY,JSON.stringify({...data,savedAt:new Date().toISOString()})) } catch {} }
export function getLastSyncTime():string|null { return typeof window==="undefined"?null:localStorage.getItem(SYNC_KEY) }
export function setLastSyncTime(time:string):void { if(typeof window!=="undefined") localStorage.setItem(SYNC_KEY,time) }
export async function syncToCloud(_email:string,_data:any):Promise<boolean> { return false }
export async function fetchFromCloud(_email:string):Promise<any|null> { return null }
function mergeArrayById(a:any[],b:any[]):any[] { const map=new Map<string,any>(); [...a,...b].forEach(x=>x?.id&&map.set(x.id,x)); return Array.from(map.values()) }
export function mergeData(localData:any,cloudData:any):any { if(!localData&&!cloudData)return null; if(!localData)return cloudData; if(!cloudData)return localData; return {...(new Date(cloudData.savedAt||0)>new Date(localData.savedAt||0)?cloudData:localData),transactions:mergeArrayById(localData.transactions||[],cloudData.transactions||[]),recentActivity:mergeArrayById(localData.recentActivity||[],cloudData.recentActivity||[]),notifications:mergeArrayById(localData.notifications||[],cloudData.notifications||[])} }
export async function performSync(email:string,localData:any):Promise<{success:boolean;mergedData:any|null}> { const cloud=await fetchFromCloud(email); const merged=mergeData(localData,cloud); if(merged) saveLocalData(merged); return {success:false,mergedData:merged} }
