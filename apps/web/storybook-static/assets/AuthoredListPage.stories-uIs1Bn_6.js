import{n as e}from"./chunk-DnJy8xQt.js";import{a as t,i as n,n as r,r as i,t as a}from"./spellList.fixtures-Dm-eWsv_.js";var o,s,c,l,u,d,f,p,m,h;e((()=>{t(),a(),o={title:`Platform/Authored List/AuthoredListPage`,component:n,tags:[`autodocs`],parameters:{docs:{description:{component:`Canonical authored-domain list pattern for non-character content indexes. Table view supports dense scanning; card view supports browsing and mobile readability. Master records are view/copy only, while owned records can edit, duplicate, and delete.`}}},args:{title:`Spells`,summary:`312 spells / 312 SRD / 0 homebrew`,createLabel:`Create Spell`,items:i,filters:r,attributeColumns:[{key:`level`,label:`Lvl`},{key:`school`,label:`School`},{key:`castingTime`,label:`Casting Time`}]}},s={},c={args:{initialViewMode:`cards`}},l={args:{initialViewMode:`cards`},parameters:{viewport:{defaultViewport:`mobile1`}}},u={args:{items:i.filter(e=>e.sourceKind===`master`)}},d={args:{items:i.filter(e=>e.sourceKind===`owned`)}},f={args:{loading:!0}},p={args:{items:[]}},m={args:{error:`The spell list could not be loaded. Try again in a moment.`}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    initialViewMode: 'cards'
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    initialViewMode: 'cards'
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    items: spellListItems.filter(item => item.sourceKind === 'master')
  }
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    items: spellListItems.filter(item => item.sourceKind === 'owned')
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    items: []
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    error: 'The spell list could not be loaded. Try again in a moment.'
  }
}`,...m.parameters?.docs?.source}}},h=[`Default`,`CardView`,`Mobile`,`LockedMasterRows`,`OwnedRows`,`Loading`,`Empty`,`Error`]}))();export{c as CardView,s as Default,p as Empty,m as Error,f as Loading,u as LockedMasterRows,l as Mobile,d as OwnedRows,h as __namedExportsOrder,o as default};