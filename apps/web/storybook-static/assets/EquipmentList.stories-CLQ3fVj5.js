import{n as e}from"./chunk-DnJy8xQt.js";import{i as t}from"./spellList.fixtures-m_1B5jV9.js";import{t as n}from"./AuthoredList-VUCL2pgh.js";import{r,t as i}from"./equipment.fixtures-gWInAvB5.js";function a(e){return{canView:e.permissions.canView,canEdit:e.permissions.canEdit,canCopy:e.permissions.canCopy,canDelete:e.permissions.canDelete}}function o(e){return e?e.toLowerCase().replaceAll(`_`,` `).replace(/^\w/,e=>e.toUpperCase()):`Draft`}function s(e){return e?e.toLowerCase().replaceAll(`_`,` `).replace(/^\w/,e=>e.toUpperCase()):`Equipment`}function c(e){return e&&e.replace(/<[^>]*>/g,``).trim()||`No description yet.`}function l(e){return e.items.map(e=>{let t=e.category??`EQUIPMENT`;return{id:e.id,name:e.label,description:c(e.description),attributes:{Category:s(t)},badges:[o(e.status)],filterValues:{category:t,status:e.status,source:e.provenance.kind},sortValues:{category:s(t),name:e.label,status:o(e.status)},searchText:`${c(e.description)} ${s(t)}`,sourceLabel:e.provenance.kind===`MASTER`?`SRD`:`Homebrew`,sourceKind:e.provenance.kind===`MASTER`?`master`:`owned`,permissions:a(e)}})}function u(e){let t=Array.from(new Set(e.items.map(e=>e.status))).sort();return[{key:`category`,label:`Category`,placeholder:`Any category`,options:Array.from(new Set(e.items.map(e=>e.category??`EQUIPMENT`))).sort().map(e=>({value:e,label:s(e)}))},{key:`status`,label:`Status`,placeholder:`Any status`,options:t.map(e=>({value:e,label:o(e)}))},{key:`source`,label:`Source`,placeholder:`Any source`,options:[{value:`MASTER`,label:`SRD`},{value:`OWNED`,label:`Homebrew`}]}]}function d(e){let t=e.items.filter(e=>e.provenance.kind===`MASTER`).length,n=e.items.length-t;return`${e.items.length} items / ${t} SRD / ${n} homebrew`}var f,p,m=e((()=>{f=[{key:`Category`,label:`Category`}],p=[{value:`name`,label:`Name A-Z`},{value:`category`,label:`Category`},{value:`status`,label:`Status`}]})),h,g,_,v,y,b,x,S,C;e((()=>{n(),m(),r(),h={title:`Domains/Equipment/List`,component:t,parameters:{docs:{description:{component:`Equipment list state coverage using the shared authored-domain list pattern, category filters, draft rows, and locked-master permissions.`}}},args:{title:`Equipment`,summary:d(i),createLabel:`Create Equipment`,items:l(i),filters:u(i),attributeColumns:f,sortOptions:p}},g={},_={args:{items:l({...i,items:i.items.filter(e=>e.category!==`VARIANT`)})}},v={args:{items:l({...i,items:i.items.filter(e=>e.category===`VARIANT`)})}},y={args:{items:l({...i,items:i.items.filter(e=>e.provenance.kind===`MASTER`)})}},b={args:{items:[]}},x={args:{loading:!0}},S={args:{error:`The equipment list could not be loaded. Try again in a moment.`}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapEquipmentListToAuthoredItems({
      ...equipmentListResponseFixture,
      items: equipmentListResponseFixture.items.filter(item => item.category !== 'VARIANT')
    })
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapEquipmentListToAuthoredItems({
      ...equipmentListResponseFixture,
      items: equipmentListResponseFixture.items.filter(item => item.category === 'VARIANT')
    })
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapEquipmentListToAuthoredItems({
      ...equipmentListResponseFixture,
      items: equipmentListResponseFixture.items.filter(item => item.provenance.kind === 'MASTER')
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
    error: 'The equipment list could not be loaded. Try again in a moment.'
  }
}`,...S.parameters?.docs?.source}}},C=[`Default`,`BaseEquipment`,`Variants`,`LockedMasterRows`,`Empty`,`Loading`,`Error`]}))();export{_ as BaseEquipment,g as Default,b as Empty,S as Error,x as Loading,y as LockedMasterRows,v as Variants,C as __namedExportsOrder,h as default};