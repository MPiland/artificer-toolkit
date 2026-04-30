import{n as e}from"./chunk-DnJy8xQt.js";import{i as t}from"./spellList.fixtures-Bg_F-pT6.js";import{n,t as r}from"./background.fixtures-DpuMMYi0.js";import{t as i}from"./AuthoredList-DzfDSQEE.js";function a(e){return{canView:e.permissions.canView,canEdit:e.permissions.canEdit,canCopy:e.permissions.canCopy,canDelete:e.permissions.canDelete}}function o(e){return e?e.toLowerCase().replaceAll(`_`,` `).replace(/^\w/,e=>e.toUpperCase()):`Draft`}function s(e){return e&&e.replace(/<[^>]*>/g,``).trim()||`No description yet.`}function c(e){return e.items.map(e=>({id:e.id,name:e.label,description:s(e.description),attributes:{},badges:[o(e.status)],filterValues:{status:e.status,source:e.provenance.kind},sortValues:{name:e.label,status:o(e.status)},searchText:s(e.description),sourceLabel:e.provenance.kind===`MASTER`?`SRD`:`Homebrew`,sourceKind:e.provenance.kind===`MASTER`?`master`:`owned`,permissions:a(e)}))}function l(e){return[{key:`status`,label:`Status`,placeholder:`Any status`,options:Array.from(new Set(e.items.map(e=>e.status))).sort().map(e=>({value:e,label:o(e)}))},{key:`source`,label:`Source`,placeholder:`Any source`,options:[{value:`MASTER`,label:`SRD`},{value:`OWNED`,label:`Homebrew`}]}]}function u(e){let t=e.items.filter(e=>e.provenance.kind===`MASTER`).length,n=e.items.length-t;return`${e.items.length} backgrounds / ${t} SRD / ${n} homebrew`}var d,f,p=e((()=>{d=[],f=[{value:`name`,label:`Name A-Z`},{value:`status`,label:`Status`}]})),m,h,g,_,v,y,b,x;e((()=>{i(),p(),n(),m={title:`Domains/Backgrounds/List`,component:t,parameters:{docs:{description:{component:`Background list state coverage using the shared authored-domain list pattern and explicit provenance/permission DTOs.`}}},args:{title:`Backgrounds`,summary:u(r),createLabel:`Create Background`,items:c(r),filters:l(r),attributeColumns:d,sortOptions:f}},h={},g={args:{items:c({...r,items:r.items.filter(e=>e.provenance.kind===`MASTER`)})}},_={args:{items:c({...r,items:r.items.filter(e=>e.provenance.kind===`OWNED`)})}},v={args:{items:[]}},y={args:{loading:!0}},b={args:{error:`The background list could not be loaded. Try again in a moment.`}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapBackgroundListToAuthoredItems({
      ...backgroundListResponseFixture,
      items: backgroundListResponseFixture.items.filter(item => item.provenance.kind === 'MASTER')
    })
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    items: mapBackgroundListToAuthoredItems({
      ...backgroundListResponseFixture,
      items: backgroundListResponseFixture.items.filter(item => item.provenance.kind === 'OWNED')
    })
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    items: []
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    error: 'The background list could not be loaded. Try again in a moment.'
  }
}`,...b.parameters?.docs?.source}}},x=[`Default`,`LockedMasterRows`,`OwnedRows`,`Empty`,`Loading`,`Error`]}))();export{h as Default,v as Empty,b as Error,y as Loading,g as LockedMasterRows,_ as OwnedRows,x as __namedExportsOrder,m as default};