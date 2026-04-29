import{n as e}from"./chunk-DnJy8xQt.js";import{n as t,r as n,s as r,t as i}from"./authStories.utils-DHK5tllI.js";var a,o,s,c,l,u,d=e((()=>{n(),t(),{fn:a}=__STORYBOOK_MODULE_TEST__,o={title:`Auth/UpdatePasswordForm`,component:r,args:{onSuccess:a()},parameters:{layout:`centered`}},s={args:{authClient:i()}},c={args:{authClient:i({result:{ok:!1,message:`That recovery session expired. Please request a new link.`}})}},l={args:{authClient:i({delayMs:1200})}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    authClient: createMockAuthClient()
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    authClient: createMockAuthClient({
      result: {
        ok: false,
        message: 'That recovery session expired. Please request a new link.'
      }
    })
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    authClient: createMockAuthClient({
      delayMs: 1200
    })
  }
}`,...l.parameters?.docs?.source}}},u=[`Default`,`Error`,`Loading`]}));d();export{s as Default,c as Error,l as Loading,u as __namedExportsOrder,o as default,d as t};