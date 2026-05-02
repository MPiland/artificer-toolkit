import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BX9360Lk.js";import{f as n,u as r}from"./iframe-Cq-CYDK-.js";import{C as i,S as a,T as o,n as s,r as c,t as l,w as u,x as d}from"./forms-BkxKCF5b.js";import{n as f,r as p,t as m}from"./editors-DGTK6m5g.js";import{a as h,i as g,n as _,r as v}from"./background.fixtures-B7yRtVU-.js";function y({systemId:e,userId:t}){return{kind:`BACKGROUND`,id:crypto.randomUUID(),label:``,description:``,status:`DRAFT`,details:[],proficiencies:[],features:[],startingEquipment:f(),userId:t,systemId:e}}function b(e){return{...e,label:e.label.trim()||`Untitled Background`,description:e.description??``,status:e.status??`DRAFT`,details:e.details??[],proficiencies:e.proficiencies??[],features:e.features??[],startingEquipment:e.startingEquipment??f()}}function x(e){return{id:crypto.randomUUID(),label:``,description:``,order:e}}function S(e){return{grantKind:`PROFICIENCY_GRANT`,id:crypto.randomUUID(),order:e,selectionKind:`GRANTED`,proficiencyKind:`SKILL`,authoringModeKind:`ALL`,level:`FULL`}}function C(e){return{id:crypto.randomUUID(),label:``,description:``,order:e}}var w=e((()=>{m()}));function T(e,t){let[n]=e.path,r=t+1;return n===`details`?x(r):n===`features`?C(r):n===`items`?p(r):n===`proficiencies`?S(r):{id:crypto.randomUUID(),order:r}}function E(e){let[t]=e.path;return t===`startingEquipment`?f():{}}var D,O,k,A=e((()=>{l(),m(),w(),D=y({systemId:``,userId:``}),O=x(1),k=s({defaultValues:D,groupDefaultValues:O,createArrayItem:T,createObjectItem:E})}));function j({mode:e,initialBackground:t,response:n,systemId:r,userId:a,resolveRuntime:o=!0,onSubmit:s,onSaveDraft:c,onCopy:l}){let u=t??n?.item??y({systemId:r,userId:a}),d=e===`view`||n?.permissions.canEdit===!1;return(0,N.jsx)(i,{children:(0,N.jsx)(M,{background:u,canCopy:!!(n?.permissions.canCopy&&l),hasActiveDraft:e===`edit`&&n!=null,mode:e,readOnly:d,resolveRuntime:o,onCopy:l,onSaveDraft:c,onSubmit:s})})}function M({background:e,canCopy:t,hasActiveDraft:r,mode:i,readOnly:a,resolveRuntime:s,onCopy:l,onSaveDraft:f,onSubmit:p}){let m=n(),h=o({defaultValues:e,onSubmit:async({value:e})=>{a||await p(b(e))}});async function g(){a||!f||await f(b(h.state.values))}return u({activateLabel:`Activate Background`,canCopy:t,canSaveDraft:!!(f&&!a),hasActiveDraft:r,mapId:`background`,mode:i,readOnly:a,resolveModel:s,saveDraftLabel:`Save Draft`,subjectKindLabel:`Background`,subjectLabel:e.label||`Untitled Background`,systemId:e.systemId},{onActivate:()=>h.handleSubmit(),onCancel:()=>m({to:`/backgrounds`}),onClearPaths:e=>c(h,e),onCopy:l,onSaveDraft:f?g:void 0}),(0,N.jsx)(h.AppForm,{children:(0,N.jsx)(d,{children:(0,N.jsx)(k,{form:h})})})}var N,P=e((()=>{r(),l(),w(),A(),N=t(),j.__docgenInfo={description:``,methods:[],displayName:`BackgroundForm`,props:{mode:{required:!0,tsType:{name:`union`,raw:`'create' | 'view' | 'edit'`,elements:[{name:`literal`,value:`'create'`},{name:`literal`,value:`'view'`},{name:`literal`,value:`'edit'`}]},description:``},initialBackground:{required:!1,tsType:{name:`BackgroundAuthoredDto`},description:``},response:{required:!1,tsType:{name:`BackgroundResponseDto`},description:``},systemId:{required:!0,tsType:{name:`string`},description:``},userId:{required:!0,tsType:{name:`string`},description:``},resolveRuntime:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`true`,computed:!1}},onSubmit:{required:!0,tsType:{name:`signature`,type:`function`,raw:`(background: BackgroundAuthoredDto) => Promise<void>`,signature:{arguments:[{type:{name:`BackgroundAuthoredDto`},name:`background`}],return:{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}}},description:``},onSaveDraft:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(background: BackgroundAuthoredDto) => Promise<void>`,signature:{arguments:[{type:{name:`BackgroundAuthoredDto`},name:`background`}],return:{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}}},description:``},onCopy:{required:!1,tsType:{name:`signature`,type:`function`,raw:`() => void`,signature:{arguments:[],return:{name:`void`}}},description:``}}}})),F,I,L,R,z,B;e((()=>{l(),P(),_(),F=t(),I={title:`Domains/Backgrounds/Form`,component:j,parameters:{docs:{description:{component:`Phase 9.7 Background authoring form using the shared TanStack Form runtime, Background DTOs, locked-master mode, and node-runtime-backed nested editors.`}}},decorators:[e=>(0,F.jsx)(`div`,{className:a,children:(0,F.jsx)(e,{})})]},L={args:{mode:`create`,systemId:`dnd-5e-srd`,userId:`user-1`,initialBackground:{...g,id:`new-background`,label:``,description:``,details:[],proficiencies:[],features:[]},resolveRuntime:!1,onSubmit:async()=>void 0}},R={args:{mode:`edit`,systemId:h.item.systemId,userId:`user-1`,response:h,resolveRuntime:!1,onSubmit:async()=>void 0}},z={args:{mode:`view`,systemId:v.item.systemId,userId:`user-1`,response:v,resolveRuntime:!1,onSubmit:async()=>void 0,onCopy:()=>void 0}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'create',
    systemId: 'dnd-5e-srd',
    userId: 'user-1',
    initialBackground: {
      ...ownedBackgroundFixture,
      id: 'new-background',
      label: '',
      description: '',
      details: [],
      proficiencies: [],
      features: []
    },
    resolveRuntime: false,
    onSubmit: async () => undefined
  }
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'edit',
    systemId: ownedBackgroundResponseFixture.item.systemId,
    userId: 'user-1',
    response: ownedBackgroundResponseFixture,
    resolveRuntime: false,
    onSubmit: async () => undefined
  }
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'view',
    systemId: masterBackgroundResponseFixture.item.systemId,
    userId: 'user-1',
    response: masterBackgroundResponseFixture,
    resolveRuntime: false,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}`,...z.parameters?.docs?.source}}},B=[`Create`,`EditOwned`,`LockedMasterReadonly`]}))();export{L as Create,R as EditOwned,z as LockedMasterReadonly,B as __namedExportsOrder,I as default};