import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BX9360Lk.js";import{f as n,u as r}from"./iframe-Cq-CYDK-.js";import{C as i,S as a,T as o,d as s,i as c,n as l,r as u,t as d,u as f,v as p,w as m,x as h,y as g}from"./forms-BkxKCF5b.js";import{a as _,c as v,i as y,n as b,o as x,r as S,t as C}from"./race.fixtures-CZbObcEk.js";function w({systemId:e,userId:t}){return{id:crypto.randomUUID(),label:``,quote:``,description:``,status:`DRAFT`,category:f.BASE,selectionMode:s.DIRECT,heritageIds:[],details:[],features:[],size:p.MEDIUM,speeds:[O()],userId:t,systemId:e}}function T(e){return w(e)}function E(e){return{id:crypto.randomUUID(),label:``,description:``,order:e}}function D(e){return{id:crypto.randomUUID(),label:``,description:``,order:e}}function O(){return{speedId:``,amount:30,unit:g.FEET}}function k(){return{id:crypto.randomUUID(),label:``,description:``,options:[]}}function A(e){return{id:crypto.randomUUID(),label:``,description:``,order:e,features:[]}}function j(e){return e.category===f.SUBRACE?{...e,quote:e.quote??``,description:e.description??``,details:e.details??[],features:e.features??[]}:{...e,quote:e.quote??``,description:e.description??``,heritageIds:e.heritageIds??[],details:e.details??[],features:e.features??[],speeds:e.speeds??[],ancestry:e.ancestry}}function M(e){let t={id:e.id,label:e.label.trim()||`Untitled Race`,quote:e.quote??``,description:e.description??``,status:e.status??`DRAFT`,details:e.details??[],features:e.features??[],userId:e.userId,systemId:e.systemId};return e.category===f.SUBRACE?{...t,category:f.SUBRACE,parentRaceId:e.parentRaceId??``}:{...t,category:f.BASE,selectionMode:e.selectionMode??s.DIRECT,ancestry:N(e.ancestry),heritageIds:e.heritageIds??[],size:e.size??p.MEDIUM,speeds:e.speeds??[]}}function N(e){if(e)return{...e,label:e.label.trim(),description:e.description??``,options:e.options??[]}}var P=e((()=>{c()}));function F(e,t){let[n]=e.path,r=t+1;return n===`details`?E(r):n===`features`?D(r):n===`options`?A(r):n===`speeds`?O():{id:crypto.randomUUID(),order:r}}function I(e){let[t]=e.path;return t===`ancestry`?k():{}}var L,R,z,B=e((()=>{d(),P(),L=j(w({systemId:``,userId:``})),R=E(1),z=l({defaultValues:L,groupDefaultValues:R,createArrayItem:F,createObjectItem:I})}));function V({mode:e,initialRace:t,response:n,systemId:r,userId:a,resolveRuntime:o=!0,runtimeModel:s,onSubmit:c,onSaveDraft:l,onCopy:u}){let d=j(t??n?.item??T({systemId:r,userId:a})),f=e===`view`||n?.permissions.canEdit===!1;return(0,U.jsx)(i,{children:(0,U.jsx)(H,{canCopy:!!(n?.permissions.canCopy&&u),hasActiveDraft:e===`edit`&&n!=null,mode:e,race:d,readOnly:f,resolveRuntime:o,runtimeModel:s,onCopy:u,onSaveDraft:l,onSubmit:c})})}function H({canCopy:e,hasActiveDraft:t,mode:r,race:i,readOnly:a,resolveRuntime:s,runtimeModel:c,onCopy:l,onSaveDraft:d,onSubmit:f}){let p=n(),g=o({defaultValues:i,onSubmit:async({value:e})=>{a||await f(M(e))}});async function _(){a||!d||await d(M(g.state.values))}return m({activateLabel:`Activate Race`,canCopy:e,canSaveDraft:!!(d&&!a),hasActiveDraft:t,mapId:`race`,mode:r,providedModel:c,readOnly:a,resolveModel:s,saveDraftLabel:`Save Draft`,subjectKindLabel:`Race`,subjectLabel:i.label||`Untitled Race`,systemId:i.systemId},{onActivate:()=>g.handleSubmit(),onCancel:()=>p({to:`/races`}),onClearPaths:e=>u(g,e),onCopy:l,onSaveDraft:d?_:void 0}),(0,U.jsx)(g.AppForm,{children:(0,U.jsx)(h,{children:(0,U.jsx)(z,{form:g})})})}var U,W=e((()=>{r(),d(),P(),B(),U=t(),V.__docgenInfo={description:``,methods:[],displayName:`RaceForm`,props:{mode:{required:!0,tsType:{name:`union`,raw:`'create' | 'view' | 'edit'`,elements:[{name:`literal`,value:`'create'`},{name:`literal`,value:`'view'`},{name:`literal`,value:`'edit'`}]},description:``},initialRace:{required:!1,tsType:{name:`union`,raw:`RaceAuthoredDto | RaceFormValues`,elements:[{name:`RaceAuthoredDto`},{name:`signature`,type:`object`,raw:`{
  id: string
  label: string
  quote?: string
  description?: string
  status?: RaceAuthoredDto['status']
  category: BaseRaceDto['category'] | SubraceDto['category']
  selectionMode?: BaseRaceDto['selectionMode']
  ancestry?: BaseRaceDto['ancestry']
  heritageIds?: string[]
  details?: DetailDto[]
  features?: FeatureDto[]
  size?: BaseRaceDto['size']
  speeds?: SpeedDto[]
  parentRaceId?: string
  userId: string
  systemId: string
}`,signature:{properties:[{key:`id`,value:{name:`string`,required:!0}},{key:`label`,value:{name:`string`,required:!0}},{key:`quote`,value:{name:`string`,required:!1}},{key:`description`,value:{name:`string`,required:!1}},{key:`status`,value:{name:`RaceAuthoredDto['status']`,raw:`RaceAuthoredDto['status']`,required:!1}},{key:`category`,value:{name:`union`,raw:`BaseRaceDto['category'] | SubraceDto['category']`,elements:[{name:`Extract['category']`,raw:`BaseRaceDto['category']`},{name:`Extract['category']`,raw:`SubraceDto['category']`}],required:!0}},{key:`selectionMode`,value:{name:`Extract['selectionMode']`,raw:`BaseRaceDto['selectionMode']`,required:!1}},{key:`ancestry`,value:{name:`Extract['ancestry']`,raw:`BaseRaceDto['ancestry']`,required:!1}},{key:`heritageIds`,value:{name:`Array`,elements:[{name:`string`}],raw:`string[]`,required:!1}},{key:`details`,value:{name:`Array`,elements:[{name:`DetailDto`}],raw:`DetailDto[]`,required:!1}},{key:`features`,value:{name:`Array`,elements:[{name:`FeatureDto`}],raw:`FeatureDto[]`,required:!1}},{key:`size`,value:{name:`Extract['size']`,raw:`BaseRaceDto['size']`,required:!1}},{key:`speeds`,value:{name:`Array`,elements:[{name:`SpeedDto`}],raw:`SpeedDto[]`,required:!1}},{key:`parentRaceId`,value:{name:`string`,required:!1}},{key:`userId`,value:{name:`string`,required:!0}},{key:`systemId`,value:{name:`string`,required:!0}}]}}]},description:``},response:{required:!1,tsType:{name:`RaceResponseDto`},description:``},systemId:{required:!0,tsType:{name:`string`},description:``},userId:{required:!0,tsType:{name:`string`},description:``},resolveRuntime:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`true`,computed:!1}},runtimeModel:{required:!1,tsType:{name:`NodeRuntimeResolveResponseDto`},description:``},onSubmit:{required:!0,tsType:{name:`signature`,type:`function`,raw:`(race: RaceAuthoredDto) => Promise<void>`,signature:{arguments:[{type:{name:`RaceAuthoredDto`},name:`race`}],return:{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}}},description:``},onSaveDraft:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(race: RaceAuthoredDto) => Promise<void>`,signature:{arguments:[{type:{name:`RaceAuthoredDto`},name:`race`}],return:{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}}},description:``},onCopy:{required:!1,tsType:{name:`signature`,type:`function`,raw:`() => void`,signature:{arguments:[],return:{name:`void`}}},description:``}}}})),G,K,q,J,Y,X,Z;e((()=>{d(),W(),C(),G=t(),K={title:`Domains/Races/Form`,component:V,parameters:{docs:{description:{component:`Phase 9.9 Race authoring form using separate base-race and subrace flows, shared authored form layout, node-runtime options, and draft-aware locked-master behavior.`}}},decorators:[e=>(0,G.jsx)(`div`,{className:a,children:(0,G.jsx)(e,{})})]},q={args:{mode:`create`,systemId:`dnd-5e-srd`,userId:`user-1`,initialRace:{...S,id:`new-race`,label:``,quote:``,description:``,details:[],features:[]},resolveRuntime:!1,runtimeModel:v,onSubmit:async()=>void 0}},J={args:{mode:`edit`,systemId:S.systemId,userId:`user-1`,response:y,resolveRuntime:!1,runtimeModel:v,onSubmit:async()=>void 0}},Y={args:{mode:`edit`,systemId:_.systemId,userId:`user-1`,response:x,resolveRuntime:!1,runtimeModel:v,onSubmit:async()=>void 0}},X={args:{mode:`view`,systemId:b.item.systemId,userId:`user-1`,response:b,resolveRuntime:!1,runtimeModel:v,onSubmit:async()=>void 0,onCopy:()=>void 0}},q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'create',
    systemId: 'dnd-5e-srd',
    userId: 'user-1',
    initialRace: {
      ...ownedBaseRaceFixture,
      id: 'new-race',
      label: '',
      quote: '',
      description: '',
      details: [],
      features: []
    },
    resolveRuntime: false,
    runtimeModel: raceRuntimeFixture,
    onSubmit: async () => undefined
  }
}`,...q.parameters?.docs?.source}}},J.parameters={...J.parameters,docs:{...J.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'edit',
    systemId: ownedBaseRaceFixture.systemId,
    userId: 'user-1',
    response: ownedBaseRaceResponseFixture,
    resolveRuntime: false,
    runtimeModel: raceRuntimeFixture,
    onSubmit: async () => undefined
  }
}`,...J.parameters?.docs?.source}}},Y.parameters={...Y.parameters,docs:{...Y.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'edit',
    systemId: ownedSubraceFixture.systemId,
    userId: 'user-1',
    response: ownedSubraceResponseFixture,
    resolveRuntime: false,
    runtimeModel: raceRuntimeFixture,
    onSubmit: async () => undefined
  }
}`,...Y.parameters?.docs?.source}}},X.parameters={...X.parameters,docs:{...X.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'view',
    systemId: masterRaceResponseFixture.item.systemId,
    userId: 'user-1',
    response: masterRaceResponseFixture,
    resolveRuntime: false,
    runtimeModel: raceRuntimeFixture,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}`,...X.parameters?.docs?.source}}},Z=[`CreateBaseRace`,`EditBaseRace`,`EditSubrace`,`LockedMasterReadonly`]}))();export{q as CreateBaseRace,J as EditBaseRace,Y as EditSubrace,X as LockedMasterReadonly,Z as __namedExportsOrder,K as default};