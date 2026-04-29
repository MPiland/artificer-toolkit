import{n as e}from"./chunk-DnJy8xQt.js";import{a as t,i as n}from"./spellList.fixtures-NedsqSTv.js";import{n as r,t as i}from"./background.fixtures-BT5QxNEA.js";var a=e((()=>{t()}));function o(e){return{canView:e.permissions.canView,canEdit:e.permissions.canEdit,canCopy:e.permissions.canCopy,canDelete:e.permissions.canDelete}}function s(e){return e?e.toLowerCase().replaceAll(`_`,` `).replace(/^\w/,e=>e.toUpperCase()):`Draft`}function c(e){return e&&e.replace(/<[^>]*>/g,``).trim()||`No description yet.`}function l(e){return e.items.map(e=>({id:e.id,name:e.label,description:c(e.description),attributes:{},badges:[s(e.status)],filterValues:{status:e.status,source:e.provenance.kind},sortValues:{name:e.label,status:s(e.status)},searchText:c(e.description),sourceLabel:e.provenance.kind===`MASTER`?`SRD`:`Homebrew`,sourceKind:e.provenance.kind===`MASTER`?`master`:`owned`,permissions:o(e)}))}function u(e){return[{key:`status`,label:`Status`,placeholder:`Any status`,options:Array.from(new Set(e.items.map(e=>e.status))).sort().map(e=>({value:e,label:s(e)}))},{key:`source`,label:`Source`,placeholder:`Any source`,options:[{value:`MASTER`,label:`SRD`},{value:`OWNED`,label:`Homebrew`}]}]}function d(e){let t=e.items.filter(e=>e.provenance.kind===`MASTER`).length,n=e.items.length-t;return`${e.items.length} backgrounds / ${t} SRD / ${n} homebrew`}var f,p,m=e((()=>{f=[],p=[{value:`name`,label:`Name A-Z`},{value:`status`,label:`Status`}]})),h,g,_,v,y,b,x,S;e((()=>{a(),m(),r(),h={title:`Domains/Backgrounds/List`,component:n,parameters:{docs:{description:{component:`Background list state coverage using the shared authored-domain list pattern and explicit provenance/permission DTOs.`}}},args:{title:`Backgrounds`,summary:d(i),createLabel:`Create Background`,items:l(i),filters:u(i),attributeColumns:f,sortOptions:p}},g={},_={args:{items:l({...i,items:i.items.filter(e=>e.provenance.kind===`MASTER`)})}},v={args:{items:l({...i,items:i.items.filter(e=>e.provenance.kind===`OWNED`)})}},y={args:{items:[]}},b={args:{loading:!0}},x={args:{error:`The background list could not be loaded. Try again in a moment.`}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapBackgroundListToAuthoredItems({
      ...backgroundListResponseFixture,
      items: backgroundListResponseFixture.items.filter(item => item.provenance.kind === 'MASTER')
    })
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapBackgroundListToAuthoredItems({
      ...backgroundListResponseFixture,
      items: backgroundListResponseFixture.items.filter(item => item.provenance.kind === 'OWNED')
    })
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    items: []
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    error: 'The background list could not be loaded. Try again in a moment.'
  }
}`,...x.parameters?.docs?.source}}},S=[`Default`,`LockedMasterRows`,`OwnedRows`,`Empty`,`Loading`,`Error`]}))();export{g as Default,y as Empty,x as Error,b as Loading,_ as LockedMasterRows,v as OwnedRows,S as __namedExportsOrder,h as default};