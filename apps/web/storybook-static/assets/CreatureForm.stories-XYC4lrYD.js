import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BX9360Lk.js";import{f as n,u as r}from"./iframe-Cq-CYDK-.js";import{C as i,S as a,T as o,g as s,h as c,i as l,m as u,n as d,p as f,r as ee,t as p,v as m,w as h,x as te,y as ne}from"./forms-BkxKCF5b.js";import{a as re,c as ie,i as g,l as _,n as v,o as y,s as b,t as x,u as S}from"./creature.fixtures-CXKKxGgi.js";function C({systemId:e,userId:t}){return{id:crypto.randomUUID(),label:``,description:``,quote:``,status:`DRAFT`,recordKind:`STAT_BLOCK`,category:f.MONSTER,creatureTypeId:``,size:m.MEDIUM,userId:t,systemId:e,tags:[],abilityScores:w(),armorClass:10,hitPoints:1,speeds:[],senses:[],damageVulnerabilities:[],damageResistances:[],damageImmunities:[],conditionImmunities:[],actions:[],bonusActions:[],reactions:[],details:[],features:[],proficiencies:[]}}function w(){return{STRENGTH:10,DEXTERITY:10,CONSTITUTION:10,INTELLIGENCE:10,WISDOM:10,CHARISMA:10,SPELLCASTING:0}}function T(e){return{id:crypto.randomUUID(),label:``,description:``,order:e}}function ae(e){return{id:crypto.randomUUID(),label:``,description:``,order:e}}function oe(){return{id:crypto.randomUUID(),label:``,description:``}}function E(){return{speedId:``,amount:30,unit:ne.FEET}}function D(){return{id:crypto.randomUUID(),order:1,grantKind:`PROFICIENCY_GRANT`,proficiencyKind:`SKILL`,selectionKind:`GRANTED`,level:`FULL`}}function O(){return{actionsCount:3,legendaryResistanceCount:0}}function k(){return{lairActions:[],regionalEffects:[]}}function A(){return{mountType:s.CONTROLLED,riderCount:1,notes:``}}function se(){return{bondType:u.ANIMAL_COMPANION,initiativeMode:c.USES_PC_INITIATIVE,notes:``}}function ce(){return{bonds:[],flaws:[],ideals:[],personalityTraits:[]}}function j(e){return{...e,label:e.label.trim()||`Untitled Creature`,description:e.description??``,quote:e.quote??``,recordKind:e.recordKind??`STAT_BLOCK`,status:e.status??`DRAFT`,tags:e.tags??[],speeds:e.speeds??[],senses:e.senses??[],damageVulnerabilities:e.damageVulnerabilities??[],damageResistances:e.damageResistances??[],damageImmunities:e.damageImmunities??[],conditionImmunities:e.conditionImmunities??[],actions:e.actions??[],bonusActions:e.bonusActions??[],reactions:e.reactions??[],details:e.details??[],features:e.features??[],proficiencies:e.proficiencies??[]}}function M(e){return{...e,description:e.description??``,quote:e.quote??``,recordKind:e.recordKind??`STAT_BLOCK`,tags:e.tags??[],abilityScores:e.abilityScores??w(),speeds:e.speeds??[],senses:e.senses??[],damageVulnerabilities:e.damageVulnerabilities??[],damageResistances:e.damageResistances??[],damageImmunities:e.damageImmunities??[],conditionImmunities:e.conditionImmunities??[],actions:e.actions??[],bonusActions:e.bonusActions??[],reactions:e.reactions??[],details:e.details??[],features:e.features??[],proficiencies:e.proficiencies??[]}}var N=e((()=>{l()}));function P(e,t){let[n]=e.path,r=t+1;return n===`actions`||n===`bonusActions`||n===`lairActions`||n===`reactions`?oe():n===`details`?T(r):n===`features`?ae(r):n===`logisticsNotes`||n===`regionalEffects`?{value:``}:n===`proficiencies`?D():n===`senses`||n===`tags`?{value:``}:n===`speeds`?E():n===`bonds`||n===`flaws`||n===`ideals`||n===`personalityTraits`?{value:``}:{id:crypto.randomUUID(),order:r}}function F(e){let[t]=e.path;return t===`abilityScores`?w():t===`carryingCapacity`?{amount:0,unit:`POUNDS`}:t===`companionProfile`?se():t===`cost`?{amount:0,currencyId:``}:t===`lairProfile`?k():t===`legendaryProfile`?O():t===`mountProfile`?A():t===`npcProfile`?ce():{}}var I,L,R,z=e((()=>{p(),N(),I=M(C({systemId:``,userId:``})),L=T(1),R=d({defaultValues:I,groupDefaultValues:L,createArrayItem:P,createObjectItem:F})}));function B({mode:e,initialCreature:t,response:n,systemId:r,userId:a,resolveRuntime:o=!0,runtimeModel:s,onSubmit:c,onSaveDraft:l,onCopy:u}){let d=M(t??n?.item??C({systemId:r,userId:a})),f=e===`view`||n?.permissions.canEdit===!1;return(0,H.jsx)(i,{children:(0,H.jsx)(V,{canCopy:!!(n?.permissions.canCopy&&u),creature:d,hasActiveDraft:e===`edit`&&n!=null,mode:e,readOnly:f,resolveRuntime:o,runtimeModel:s,onCopy:u,onSaveDraft:l,onSubmit:c})})}function V({canCopy:e,creature:t,hasActiveDraft:r,mode:i,readOnly:a,resolveRuntime:s,runtimeModel:c,onCopy:l,onSaveDraft:u,onSubmit:d}){let f=n(),p=o({defaultValues:t,onSubmit:async({value:e})=>{a||await d(j(e))}});async function m(){a||!u||await u(j(p.state.values))}return h({activateLabel:`Activate Creature`,canCopy:e,canSaveDraft:!!(u&&!a),hasActiveDraft:r,mapId:`creature`,mode:i,providedModel:c,readOnly:a,resolveModel:s,saveDraftLabel:`Save Draft`,subjectKindLabel:`Creature`,subjectLabel:t.label||`Untitled Creature`,systemId:t.systemId},{onActivate:()=>p.handleSubmit(),onCancel:()=>f({to:`/creatures`}),onClearPaths:e=>ee(p,e),onCopy:l,onSaveDraft:u?m:void 0}),(0,H.jsx)(p.AppForm,{children:(0,H.jsx)(te,{children:(0,H.jsx)(R,{form:p})})})}var H,U=e((()=>{r(),p(),N(),z(),H=t(),B.__docgenInfo={description:``,methods:[],displayName:`CreatureForm`,props:{mode:{required:!0,tsType:{name:`union`,raw:`'create' | 'view' | 'edit'`,elements:[{name:`literal`,value:`'create'`},{name:`literal`,value:`'view'`},{name:`literal`,value:`'edit'`}]},description:``},initialCreature:{required:!1,tsType:{name:`union`,raw:`CreatureAuthoredDto | CreatureFormValues`,elements:[{name:`CreatureAuthoredDto`},{name:`CreatureAuthoredDto`}]},description:``},response:{required:!1,tsType:{name:`CreatureResponseDto`},description:``},systemId:{required:!0,tsType:{name:`string`},description:``},userId:{required:!0,tsType:{name:`string`},description:``},resolveRuntime:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`true`,computed:!1}},runtimeModel:{required:!1,tsType:{name:`NodeRuntimeResolveResponseDto`},description:``},onSubmit:{required:!0,tsType:{name:`signature`,type:`function`,raw:`(creature: CreatureAuthoredDto) => Promise<void>`,signature:{arguments:[{type:{name:`CreatureAuthoredDto`},name:`creature`}],return:{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}}},description:``},onSaveDraft:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(creature: CreatureAuthoredDto) => Promise<void>`,signature:{arguments:[{type:{name:`CreatureAuthoredDto`},name:`creature`}],return:{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}}},description:``},onCopy:{required:!1,tsType:{name:`signature`,type:`function`,raw:`() => void`,signature:{arguments:[],return:{name:`void`}}},description:``}}}})),W,G,K,q,J,Y,X,Z,Q,$;e((()=>{p(),U(),re(),W=t(),G={title:`Domains/Creatures/Form`,component:B,parameters:{docs:{description:{component:`Phase 9.11 Creature authoring form using category-driven flows, node-runtime options, draft sidecar behavior, and locked-master copy affordances.`}}},decorators:[e=>(0,W.jsx)(`div`,{className:a,children:(0,W.jsx)(e,{})})]},K={args:{mode:`create`,systemId:`dnd-5e-srd`,userId:`user-1`,initialCreature:{..._,id:`new-creature`,label:``,quote:``,description:``,actions:[]},resolveRuntime:!1,runtimeModel:g,onSubmit:async()=>void 0}},q={args:{mode:`edit`,systemId:_.systemId,userId:`user-1`,response:ie,resolveRuntime:!1,runtimeModel:g,onSubmit:async()=>void 0}},J={args:{mode:`edit`,systemId:x.systemId,userId:`user-1`,initialCreature:x,resolveRuntime:!1,runtimeModel:g,onSubmit:async()=>void 0}},Y={args:{mode:`edit`,systemId:b.systemId,userId:`user-1`,initialCreature:b,resolveRuntime:!1,runtimeModel:g,onSubmit:async()=>void 0}},X={args:{mode:`edit`,systemId:v.systemId,userId:`user-1`,initialCreature:v,resolveRuntime:!1,runtimeModel:g,onSubmit:async()=>void 0}},Z={args:{mode:`edit`,systemId:S.systemId,userId:`user-1`,initialCreature:S,resolveRuntime:!1,runtimeModel:g,onSubmit:async()=>void 0}},Q={args:{mode:`view`,systemId:y.item.systemId,userId:`user-1`,response:y,resolveRuntime:!1,runtimeModel:g,onSubmit:async()=>void 0,onCopy:()=>void 0}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'create',
    systemId: 'dnd-5e-srd',
    userId: 'user-1',
    initialCreature: {
      ...ownedMonsterFixture,
      id: 'new-creature',
      label: '',
      quote: '',
      description: '',
      actions: []
    },
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}`,...K.parameters?.docs?.source}}},q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'edit',
    systemId: ownedMonsterFixture.systemId,
    userId: 'user-1',
    response: ownedCreatureResponseFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}`,...q.parameters?.docs?.source}}},J.parameters={...J.parameters,docs:{...J.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'edit',
    systemId: beastMountFixture.systemId,
    userId: 'user-1',
    initialCreature: beastMountFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}`,...J.parameters?.docs?.source}}},Y.parameters={...Y.parameters,docs:{...Y.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'edit',
    systemId: npcFixture.systemId,
    userId: 'user-1',
    initialCreature: npcFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}`,...Y.parameters?.docs?.source}}},X.parameters={...X.parameters,docs:{...X.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'edit',
    systemId: companionFixture.systemId,
    userId: 'user-1',
    initialCreature: companionFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}`,...X.parameters?.docs?.source}}},Z.parameters={...Z.parameters,docs:{...Z.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'edit',
    systemId: summonFixture.systemId,
    userId: 'user-1',
    initialCreature: summonFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined
  }
}`,...Z.parameters?.docs?.source}}},Q.parameters={...Q.parameters,docs:{...Q.parameters?.docs,source:{originalSource:`{
  args: {
    mode: 'view',
    systemId: masterCreatureResponseFixture.item.systemId,
    userId: 'user-1',
    response: masterCreatureResponseFixture,
    resolveRuntime: false,
    runtimeModel: creatureRuntimeFixture,
    onSubmit: async () => undefined,
    onCopy: () => undefined
  }
}`,...Q.parameters?.docs?.source}}},$=[`CreateMonster`,`EditMonster`,`BeastMount`,`NpcPersonality`,`CompanionProfile`,`SummonProfile`,`LockedMasterReadonly`]}))();export{J as BeastMount,X as CompanionProfile,K as CreateMonster,q as EditMonster,Q as LockedMasterReadonly,Y as NpcPersonality,Z as SummonProfile,$ as __namedExportsOrder,G as default};