import{n as e}from"./chunk-DnJy8xQt.js";import{i as t}from"./spellList.fixtures-m_1B5jV9.js";import{t as n}from"./AuthoredList-VUCL2pgh.js";import{a as r,r as i}from"./creature.fixtures-CXKKxGgi.js";function a(e){return{canView:e.permissions.canView,canEdit:e.permissions.canEdit,canCopy:e.permissions.canCopy,canDelete:e.permissions.canDelete}}function o(e){return e?e.toLowerCase().replaceAll(`_`,` `).replace(/^\w/,e=>e.toUpperCase()):`Draft`}function s(e){return e?e===`NPC`?`NPC`:e.toLowerCase().replaceAll(`_`,` `).replace(/^\w/,e=>e.toUpperCase()):`Creature`}function c(e){return e&&e.replace(/<[^>]*>/g,``).trim()||`No description yet.`}function l(e){return e.items.map(e=>{let t=e.category??`CREATURE`,n=s(t),r=o(e.status);return{id:e.id,name:e.label,description:c(e.description),attributes:{Category:n},badges:[r],filterValues:{category:t,status:e.status,source:e.provenance.kind},sortValues:{category:n,name:e.label,status:r},searchText:`${c(e.description)} ${n}`,sourceLabel:e.provenance.kind===`MASTER`?`SRD`:`Homebrew`,sourceKind:e.provenance.kind===`MASTER`?`master`:`owned`,permissions:a(e)}})}function u(e){let t=Array.from(new Set(e.items.map(e=>e.status))).sort();return[{key:`category`,label:`Category`,placeholder:`Any category`,options:Array.from(new Set(e.items.map(e=>e.category??`CREATURE`))).sort().map(e=>({value:e,label:s(e)}))},{key:`status`,label:`Status`,placeholder:`Any status`,options:t.map(e=>({value:e,label:o(e)}))},{key:`source`,label:`Source`,placeholder:`Any source`,options:[{value:`MASTER`,label:`SRD`},{value:`OWNED`,label:`Homebrew`}]}]}function d(e){let t=e.items.filter(e=>e.provenance.kind===`MASTER`).length,n=e.items.length-t;return`${e.items.length} creatures / ${t} SRD / ${n} homebrew`}var f,p,m=e((()=>{f=[{key:`Category`,label:`Category`}],p=[{value:`name`,label:`Name A-Z`},{value:`category`,label:`Category`},{value:`status`,label:`Status`}]})),h,g,_,v,y,b,x,S,C;e((()=>{n(),m(),r(),h={title:`Domains/Creatures/List`,component:t,parameters:{docs:{description:{component:`Creature list state coverage using the shared authored list pattern, category filters, draft rows, and locked-master permissions.`}}},args:{title:`Creatures`,summary:d(i),createLabel:`Create Creature`,items:l(i),filters:u(i),attributeColumns:f,sortOptions:p}},g={},_={args:{items:l({...i,items:i.items.filter(e=>e.category===`MONSTER`)})}},v={args:{items:l({...i,items:i.items.filter(e=>e.category===`BEAST`)})}},y={args:{items:l({...i,items:i.items.filter(e=>e.provenance.kind===`MASTER`)})}},b={args:{items:[]}},x={args:{loading:!0}},S={args:{error:`The creature list could not be loaded. Try again in a moment.`}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapCreatureListToAuthoredItems({
      ...creatureListResponseFixture,
      items: creatureListResponseFixture.items.filter(item => item.category === 'MONSTER')
    })
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapCreatureListToAuthoredItems({
      ...creatureListResponseFixture,
      items: creatureListResponseFixture.items.filter(item => item.category === 'BEAST')
    })
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapCreatureListToAuthoredItems({
      ...creatureListResponseFixture,
      items: creatureListResponseFixture.items.filter(item => item.provenance.kind === 'MASTER')
    })
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    items: []
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    error: 'The creature list could not be loaded. Try again in a moment.'
  }
}`,...S.parameters?.docs?.source}}},C=[`Default`,`MonsterRows`,`BeastRows`,`LockedMasterRows`,`Empty`,`Loading`,`Error`]}))();export{v as BeastRows,g as Default,b as Empty,S as Error,x as Loading,y as LockedMasterRows,_ as MonsterRows,C as __namedExportsOrder,h as default};