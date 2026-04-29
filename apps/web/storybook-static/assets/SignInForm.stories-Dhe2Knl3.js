import{n as e}from"./chunk-DnJy8xQt.js";import{c as t,n,r,t as i}from"./authStories.utils-BLks9iry.js";var a,o,s,c,l,u,d=e((()=>{r(),n(),{fn:a}=__STORYBOOK_MODULE_TEST__,o={title:`Auth/SignInForm`,component:t,args:{onSuccess:a()},parameters:{layout:`centered`}},s={args:{authClient:i()}},c={args:{authClient:i({result:{ok:!1,message:`Email or password is incorrect.`}})}},l={args:{authClient:i({delayMs:1200})}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    authClient: createMockAuthClient()
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    authClient: createMockAuthClient({
      result: {
        ok: false,
        message: 'Email or password is incorrect.'
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