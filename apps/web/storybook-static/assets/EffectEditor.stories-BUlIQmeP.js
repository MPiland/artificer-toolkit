import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{t as n}from"./react-Baqbuk-D.js";import{t as r}from"./jsx-runtime-BX9360Lk.js";import{i,n as a,r as o,t as s}from"./EffectEditor-Dfo5Tdcx.js";function c({readOnly:e=!1}){let[t,n]=(0,l.useState)([o(1)]);return(0,u.jsx)(s,{effects:t,form:{setFieldValue:(e,t)=>n(t)},references:d,readOnly:e})}var l,u,d,f,p,m,h;t((()=>{l=e(n(),1),a(),i(),u=r(),d={damageTypes:[{value:`fire`,label:`Fire`},{value:`cold`,label:`Cold`}],conditionTypes:[{value:`blinded`,label:`Blinded`},{value:`restrained`,label:`Restrained`}],creatures:[{value:`sprite`,label:`Sprite`}]},f={title:`Components/EffectEditor`,component:s,parameters:{docs:{description:{component:`Reusable full-screen modal editor for engine-backed effects. Domains own their summary sections and pass reference data; this component owns invocation, paths, and outcomes.`}}}},p={args:{effects:[],form:{setFieldValue:()=>{}},references:d},render:()=>(0,u.jsx)(c,{})},m={args:{effects:[],form:{setFieldValue:()=>{}},references:d,readOnly:!0},render:()=>(0,u.jsx)(c,{readOnly:!0})},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    effects: [],
    form: {
      setFieldValue: () => {}
    },
    references
  },
  render: () => <EffectEditorStory />
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    effects: [],
    form: {
      setFieldValue: () => {}
    },
    references,
    readOnly: true
  },
  render: () => <EffectEditorStory readOnly />
}`,...m.parameters?.docs?.source}}},h=[`Editable`,`Readonly`]}))();export{p as Editable,m as Readonly,h as __namedExportsOrder,f as default};