import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';
import {getAdminRepository} from '../data/adminRepositories';
import type {SurgiDataMode} from '../data/repositories';
import type {LibraryItem} from './libraries';
import type {AdminUser, ConfigurationAuditEvent, LibraryKey, LibraryState} from './libraryTypes';
import type {Permission} from './permissions';
import {defaultRolePermissions, sanitizeRolePermissions} from './permissions';
import type {UserRole} from '../store/types';
import type {SterilizationWorkflowConfig, WorkflowStageId} from './workflow';
export type {AdminUser, LibraryKey, LibraryState} from './libraryTypes';

type LibraryStore = LibraryState & {
  dataMode:SurgiDataMode;
  addItem:(key:LibraryKey,item:Omit<LibraryItem,'id'>)=>void; updateItem:(key:LibraryKey,id:string,item:Partial<LibraryItem>)=>void; removeItem:(key:LibraryKey,id:string)=>void;
  addUser:(user:Omit<AdminUser,'id'>)=>void; updateUser:(id:string,patch:Partial<AdminUser>)=>void; removeUser:(id:string)=>void;
  updateRolePermissions:(role:UserRole,permissions:Permission[],actor:string)=>void; resetRolePermissions:(role:UserRole,actor:string)=>void;
  updateSterilizationWorkflow:(patch:Partial<SterilizationWorkflowConfig>,actor?:string,reason?:string)=>void; setWorkflowStageEnabled:(id:WorkflowStageId,enabled:boolean,actor?:string,reason?:string)=>void; resetSterilizationWorkflow:(actor?:string,reason?:string)=>void;
  updateSystemSettings:(patch:Partial<LibraryState['systemSettings']>,actor?:string)=>void; resetData:()=>void;
};
const Ctx=createContext<LibraryStore|null>(null);
const cloneWorkflow=(c:SterilizationWorkflowConfig):SterilizationWorkflowConfig=>({...c,receiptPolicy:{...c.receiptPolicy},releasePolicy:{...c.releasePolicy},stages:c.stages.map(s=>({...s,checksEl:[...s.checksEl],checksEn:[...s.checksEn]}))});
const load=(repository:ReturnType<typeof getAdminRepository>):LibraryState=>{const initial=repository.getInitialData();try{const raw=localStorage.getItem(repository.storageKey);if(raw){const saved=JSON.parse(raw);return {...initial,...saved,systemSettings:{...initial.systemSettings,...(saved.systemSettings||{})},configurationAudit:saved.configurationAudit||[],workflowVersions:saved.workflowVersions?.length?saved.workflowVersions:[{version:saved.sterilizationWorkflow?.version||initial.sterilizationWorkflow.version,effectiveFrom:saved.sterilizationWorkflow?.updatedAt||new Date().toISOString(),changedBy:'System migration',config:cloneWorkflow(saved.sterilizationWorkflow||initial.sterilizationWorkflow)}]} as LibraryState;}}catch{}return initial;};
export function LibraryStoreProvider({children,dataMode='DEMO'}:{children:ReactNode;dataMode?:SurgiDataMode}){
 const repository=useMemo(()=>getAdminRepository(dataMode),[dataMode]); const [state,setState]=useState<LibraryState>(()=>load(repository));
 const commit=(fn:(s:LibraryState)=>LibraryState)=>setState(s=>{const n=fn(s);localStorage.setItem(repository.storageKey,JSON.stringify(n));return n});
 const audit=(s:LibraryState,e:Omit<ConfigurationAuditEvent,'id'|'at'>)=>[{...e,id:`cfg-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,at:new Date().toISOString()},...(s.configurationAudit||[])].slice(0,500);
 const actor=(x?:string)=>x||'Administrator';
 const nextWorkflow=(s:LibraryState,c:SterilizationWorkflowConfig,by:string,reason?:string)=>{const now=new Date().toISOString();const before=cloneWorkflow(s.sterilizationWorkflow);const v=cloneWorkflow({...c,version:s.sterilizationWorkflow.version+1,updatedAt:now});return {...s,sterilizationWorkflow:v,workflowVersions:[{version:v.version,effectiveFrom:now,changedBy:by,reason,config:cloneWorkflow(v)},...(s.workflowVersions||[])].slice(0,100),configurationAudit:audit(s,{entityType:'WORKFLOW',entityId:'cssd-workflow',action:'UPDATE',by,before,after:v,reason})};};
 const addItem=(key:LibraryKey,item:Omit<LibraryItem,'id'>)=>commit(s=>{const x={...item,id:`${key}-${Date.now()}`};return {...s,[key]:[...s[key],x],configurationAudit:audit(s,{entityType:'LIBRARY',entityId:`${key}:${x.id}`,action:'CREATE',by:'Administrator',after:x})}});
 const updateItem=(key:LibraryKey,id:string,item:Partial<LibraryItem>)=>commit(s=>{const before=s[key].find(x=>x.id===id);const after=before?{...before,...item}:undefined;return {...s,[key]:s[key].map(x=>x.id===id?{...x,...item}:x),configurationAudit:audit(s,{entityType:'LIBRARY',entityId:`${key}:${id}`,action:'UPDATE',by:'Administrator',before,after})}});
 const removeItem=(key:LibraryKey,id:string)=>commit(s=>{const before=s[key].find(x=>x.id===id);return {...s,[key]:s[key].filter(x=>x.id!==id),configurationAudit:audit(s,{entityType:'LIBRARY',entityId:`${key}:${id}`,action:'DELETE',by:'Administrator',before})}});
 const addUser=(user:Omit<AdminUser,'id'>)=>commit(s=>{const x={...user,id:`user-${Date.now()}`};return {...s,users:[...s.users,x],configurationAudit:audit(s,{entityType:'USER',entityId:x.id,action:'CREATE',by:'Administrator',after:x})}});
 const updateUser=(id:string,patch:Partial<AdminUser>)=>commit(s=>{const before=s.users.find(u=>u.id===id);const after=before?{...before,...patch}:undefined;return {...s,users:s.users.map(u=>u.id===id?{...u,...patch}:u),configurationAudit:audit(s,{entityType:'USER',entityId:id,action:'UPDATE',by:'Administrator',before,after})}});
 const removeUser=(id:string)=>commit(s=>{const before=s.users.find(u=>u.id===id);return {...s,users:s.users.filter(u=>u.id!==id),configurationAudit:audit(s,{entityType:'USER',entityId:id,action:'DELETE',by:'Administrator',before})}});
 const updateRolePermissions=(role:UserRole,permissions:Permission[],by:string)=>commit(s=>{const safe=sanitizeRolePermissions(role,permissions);return {...s,rolePermissions:{...s.rolePermissions,[role]:safe},rolePermissionAudit:[{id:`rpa-${Date.now()}`,role,at:new Date().toISOString(),by,permissions:[...safe]},...(s.rolePermissionAudit||[])].slice(0,100),configurationAudit:audit(s,{entityType:'ROLE_PERMISSIONS',entityId:role,action:'UPDATE',by,before:s.rolePermissions[role],after:safe})}});
 const resetRolePermissions=(role:UserRole,by:string)=>updateRolePermissions(role,[...defaultRolePermissions[role]],by);
 const updateSterilizationWorkflow=(patch:Partial<SterilizationWorkflowConfig>,by?:string,reason?:string)=>commit(s=>nextWorkflow(s,{...s.sterilizationWorkflow,...patch},actor(by),reason));
 const setWorkflowStageEnabled=(id:WorkflowStageId,enabled:boolean,by?:string,reason?:string)=>commit(s=>{const st=s.sterilizationWorkflow.stages.find(x=>x.id===id);if(!st||st.locked||st.enabled===enabled)return s;return nextWorkflow(s,{...s.sterilizationWorkflow,stages:s.sterilizationWorkflow.stages.map(x=>x.id===id?{...x,enabled}:x)},actor(by),reason||`${enabled?'Enable':'Disable'} ${id}`)});
 const resetSterilizationWorkflow=(by?:string,reason?:string)=>commit(s=>nextWorkflow(s,{...repository.getInitialData().sterilizationWorkflow,version:s.sterilizationWorkflow.version},actor(by),reason||'Reset workflow'));
 const updateSystemSettings=(patch:Partial<LibraryState['systemSettings']>,by?:string)=>commit(s=>{const after={...s.systemSettings,...patch};return {...s,systemSettings:after,configurationAudit:audit(s,{entityType:'SYSTEM_SETTINGS',entityId:'system',action:'UPDATE',by:actor(by),before:s.systemSettings,after})}});
 const resetData=()=>{localStorage.removeItem(repository.storageKey);setState(repository.getInitialData())};
 const value=useMemo(()=>({...state,dataMode,addItem,updateItem,removeItem,addUser,updateUser,removeUser,updateRolePermissions,resetRolePermissions,updateSterilizationWorkflow,setWorkflowStageEnabled,resetSterilizationWorkflow,updateSystemSettings,resetData}),[state,dataMode,repository]);
 return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useLibraries(){const v=useContext(Ctx);if(!v)throw new Error('useLibraries must be used inside LibraryStoreProvider');return v;}
