import{n as e}from"./chunk-DnJy8xQt.js";import{t}from"./jsx-runtime-BX9360Lk.js";import{C as n,E as r,S as i,T as a,n as o,t as s,w as c,x as l}from"./forms-BkxKCF5b.js";function u({canCopy:e=!1,copyLabel:t,defaultValues:r={label:`Ember Ward`,description:`Use this field for formatted longform notes.`,notes:[{text:`Useful for playtest encounters`}]},model:i=f,readOnly:o=!1}){let s=a({defaultValues:r,onSubmit:async()=>void 0});return(0,d.jsx)(s.AppForm,{children:(0,d.jsx)(n,{children:(0,d.jsx)(_,{canCopy:e,copyLabel:t,form:s,model:i,readOnly:o})})})}var d,f,p,m,h,g,_,v,y,b,x,S,C,w,T;e((()=>{s(),d=t(),f={mapId:`storybook-form`,clearPaths:[],steps:[{id:`basics`,label:`Basics`,order:10,sections:[{id:`identity`,label:`Identity`,order:10,nodes:[{id:`label`,path:[`label`],label:`Name`,kind:`INPUT`,type:`TEXT`,visible:!0,required:!0,readOnly:!1,clearPaths:[]},{id:`description`,path:[`description`],label:`Rich Text Notes`,kind:`INPUT`,type:`RICH_TEXT`,visible:!0,required:!1,readOnly:!1,clearPaths:[]}]}]}]},p={mapId:`storybook-form`,clearPaths:[],steps:[...f.steps,{id:`casting`,label:`Casting`,order:20,sections:[{id:`casting`,label:`Casting`,order:10,nodes:[{id:`castingTime`,path:[`castingTime`],label:`Casting Time`,kind:`INPUT`,type:`TEXT`,visible:!0,required:!1,readOnly:!1,clearPaths:[]}]}]}]},m={mapId:`storybook-form`,clearPaths:[],steps:[{id:`notes`,label:`Notes`,order:10,sections:[{id:`notes`,label:`Notes`,order:10,nodes:[{id:`notes`,path:[`notes`],label:`note`,kind:`GROUP`,groupKind:`ARRAY`,childMapId:`storybook-note`,visible:!0,required:!1,readOnly:!1,clearPaths:[]}]}]}]},h={label:``,description:``,notes:[]},g=o({defaultValues:h,groupDefaultValues:{},createArrayItem:(e,t)=>({id:crypto.randomUUID(),order:t+1}),createObjectItem:()=>({})}),_=r({defaultValues:h,props:{canCopy:!1,copyLabel:void 0,model:f,readOnly:!1},render:function({canCopy:e,copyLabel:t,form:n,model:r,readOnly:i}){return c({activateLabel:`Submit`,canCopy:e,copyLabel:t,mapId:r.mapId,mode:i?`view`:`edit`,providedModel:r,readOnly:i,resolveModel:!1,subjectKindLabel:`Authoring Form`,subjectLabel:n.state.values.label||`Authoring Form`},{onActivate:()=>n.handleSubmit(),onCopy:()=>void 0}),(0,d.jsx)(l,{children:(0,d.jsx)(g,{form:n})})}}),v={title:`Platform/Form`,component:u,decorators:[e=>(0,d.jsx)(`div`,{className:i,children:(0,d.jsx)(e,{})})]},y={},b={args:{readOnly:!0}},x={args:{model:p}},S={args:{canCopy:!0,copyLabel:`Copy to edit`,readOnly:!0}},C={args:{defaultValues:{label:`Playtest Notes`,notes:[{text:`Useful for playtest encounters`}]},model:m}},w=y,y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    readOnly: true
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    model: sectionedModel
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    canCopy: true,
    copyLabel: 'Copy to edit',
    readOnly: true
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValues: {
      label: 'Playtest Notes',
      notes: [{
        text: 'Useful for playtest encounters'
      }]
    },
    model: nestedCollectionModel
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`FieldPrimitives`,...w.parameters?.docs?.source}}},T=[`FieldPrimitives`,`FieldPrimitivesReadonly`,`SectionedNodeMap`,`LockedMasterReadonly`,`NestedCollection`,`Default`]}))();export{w as Default,y as FieldPrimitives,b as FieldPrimitivesReadonly,S as LockedMasterReadonly,C as NestedCollection,x as SectionedNodeMap,T as __namedExportsOrder,v as default};