import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BX9360Lk.js";import{f as n,u as r}from"./iframe-Cq-CYDK-.js";import{C as i,S as a,T as o,n as s,r as c,t as l,w as u,x as d}from"./forms-BkxKCF5b.js";import{n as f,r as p}from"./effects-eOx7MkQD.js";import{t as m}from"./editors-DGTK6m5g.js";import{r as h,t as g}from"./spellAuthoring.fixtures-BASwGOZO.js";import{a as _,i as v,n as y,r as b}from"./feat.fixtures-DwVBH-Io.js";function x({systemId:e,userId:t}){return{id:crypto.randomUUID(),label:``,description:``,status:`DRAFT`,detail:``,effects:[],features:[],userId:t,systemId:e}}function S(e){return{...e,label:e.label.trim()||`Untitled Feat`,description:e.description??``,detail:e.detail??``,status:e.status??`DRAFT`,effects:e.effects??[],features:e.features??[],grants:D(e.grants)}}function C(e){return{id:crypto.randomUUID(),label:``,description:``,order:e}}function w(){return{id:crypto.randomUUID(),resetKind:`LONG_REST`,limitKind:`FIXED_AMOUNT`,scalingKind:`NONE`,amount:1}}function T(){return{id:crypto.randomUUID(),groups:[]}}function E(){return{feats:[],modifiers:[],proficiencies:[],senses:[],spells:[]}}function D(e){if(!e)return;let t={feats:e.feats?.length?e.feats:void 0,modifiers:e.modifiers?.length?e.modifiers:void 0,proficiencies:e.proficiencies?.length?e.proficiencies:void 0,senses:e.senses?.length?e.senses:void 0,spells:e.spells?.length?e.spells:void 0};return Object.values(t).some(Boolean)?t:void 0}var O=e((()=>{}));function k(e,t){let[n]=e.path,r=t+1;return n===`effects`?f(r):n===`features`?C(r):n===`paths`?p(r):n===`proficiencies`?M(r):n===`modifiers`?j(r):{id:crypto.randomUUID(),order:r}}function A(e){let[t]=e.path;return t===`charges`?w():t===`grants`?E():t===`prerequisites`?T():{}}function j(e){return{id:crypto.randomUUID(),order:e,grantKind:`MODIFIER_GRANT`,selectionKind:`GRANTED`}}function M(e){return{id:crypto.randomUUID(),order:e,grantKind:`PROFICIENCY_GRANT`,selectionKind:`GRANTED`,proficiencyKind:`SKILL`,level:`FULL`}}var N,P,F,I=e((()=>{l(),m(),O(),N=x({systemId:``,userId:``}),P=C(1),F=s({defaultValues:N,groupDefaultValues:P,createArrayItem:k,createObjectItem:A})}));function L({mode:e,initialFeat:t,response:n,references:r,systemId:a,userId:o,resolveRuntime:s=!0,onSubmit:c,onSaveDraft:l,onCopy:u}){let d=t??n?.item??x({systemId:a,userId:o}),f=e===`view`||n?.permissions.canEdit===!1;return(0,z.jsx)(i,{children:(0,z.jsx)(R,{canCopy:!!(n?.permissions.canCopy&&u),feat:d,hasActiveDraft:e===`edit`&&n!=null,mode:e,readOnly:f,resolveRuntime:s,onCopy:u,onSaveDraft:l,onSubmit:c})})}function R({canCopy:e,feat:t,hasActiveDraft:r,mode:i,readOnly:a,resolveRuntime:s,onCopy:l,onSaveDraft:f,onSubmit:p}){let m=n(),h=o({defaultValues:t,onSubmit:async({value:e})=>{a||await p(S(e))}});async function g(){a||!f||await f(S(h.state.values))}return u({activateLabel:`Activate Feat`,canCopy:e,canSaveDraft:!!(f&&!a),hasActiveDraft:r,mapId:`feat`,mode:i,readOnly:a,resolveModel:s,saveDraftLabel:`Save Draft`,subjectKindLabel:`Feat`,subjectLabel:t.label||`Untitled Feat`,systemId:t.systemId},{onActivate:()=>h.handleSubmit(),onCancel:()=>m({to:`/feats`}),onClearPaths:e=>c(h,e),onCopy:l,onSaveDraft:f?g:void 0}),(0,z.jsx)(h.AppForm,{children:(0,z.jsx)(d,{children:(0,z.jsx)(F,{form:h})})})}var z,B=e((()=>{r(),l(),O(),I(),z=t(),L.__docgenInfo={description:``,methods:[],displayName:`FeatForm`,props:{mode:{required:!0,tsType:{name:`union`,raw:`'create' | 'view' | 'edit'`,elements:[{name:`literal`,value:`'create'`},{name:`literal`,value:`'view'`},{name:`literal`,value:`'edit'`}]},description:``},initialFeat:{required:!1,tsType:{name:`FeatAuthoredDto`},description:``},response:{required:!1,tsType:{name:`FeatResponseDto`},description:``},references:{required:!0,tsType:{name:`EffectEditorReferenceData`},description:``},systemId:{required:!0,tsType:{name:`string`},description:``},userId:{required:!0,tsType:{name:`string`},description:``},resolveRuntime:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`true`,computed:!1}},onSubmit:{required:!0,tsType:{name:`signature`,type:`function`,raw:`(feat: FeatAuthoredDto) => Promise<void>`,signature:{arguments:[{type:{name:`FeatAuthoredDto`},name:`feat`}],return:{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}}},description:``},onSaveDraft:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(feat: FeatAuthoredDto) => Promise<void>`,signature:{arguments:[{type:{name:`FeatAuthoredDto`},name:`feat`}],return:{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}}},description:``},onCopy:{required:!1,tsType:{name:`signature`,type:`function`,raw:`() => void`,signature:{arguments:[],return:{name:`void`}}},description:``}}}})),V,H,U,W,G,K;e((()=>{l(),g(),B(),y(),V=t(),H={title:`Domains/Feats/Form`,component:L,parameters:{docs:{description:{component:`Phase 9.8 Feat authoring form using the shared authored form layout, reusable effect editor, locked-master mode, and node-runtime-backed nested editors.`}}},decorators:[e=>(0,V.jsx)(`div`,{className:a,children:(0,V.jsx)(e,{})})]},U={args:{mode:`create`,systemId:`dnd-5e-srd`,userId:`user-1`,references:h,initialFeat:{...v,id:`new-feat`,label:``,description:``,detail:``,effects:[],features:[]},resolveRuntime:!1,onSubmit:async()=>void 0}},W={args:{mode:`edit`,systemId:_.item.systemId,userId:`user-1`,references:h,response:_,resolveRuntime:!1,onSubmit:async()=>void 0}},G={args:{mode:`view`,systemId:b.item.systemId,userId:`user-1`,references:h,response:b,resolveRuntime:!1,onSubmit:async()=>void 0,onCopy:()=>void 0}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'create',
    systemId: 'dnd-5e-srd',
    userId: 'user-1',
    references: spellReferenceFixture,
    initialFeat: {
      ...ownedFeatFixture,
      id: 'new-feat',
      label: '',
      description: '',
      detail: '',
      effects: [],
      features: []
    },
    resolveRuntime: false,
    onSubmit: async () => undefined
  }
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'edit',
    systemId: ownedFeatResponseFixture.item.systemId,
    userId: 'user-1',
    references: spellReferenceFixture,
    response: ownedFeatResponseFixture,
    resolveRuntime: false,
    onSubmit: async () => undefined
  }
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'view',
    systemId: masterFeatResponseFixture.item.systemId,
    userId: 'user-1',
    references: spellReferenceFixture,
    response: masterFeatResponseFixture,
    resolveRuntime: false,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}`,...G.parameters?.docs?.source}}},K=[`Create`,`EditOwned`,`LockedMasterReadonly`]}))();export{U as Create,W as EditOwned,G as LockedMasterReadonly,K as __namedExportsOrder,H as default};