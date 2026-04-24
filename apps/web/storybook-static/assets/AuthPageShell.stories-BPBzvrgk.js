import{n as e}from"./chunk-DnJy8xQt.js";import{V as t}from"./layers.css.ts.vanilla-B9Gujw8f.js";import{a as n,c as r,i,o as a,r as o,s}from"./authStories.utils-CDuLCJNs.js";import{Default as c,t as l}from"./ResetPasswordForm.stories-Dx-wfgma.js";import{Default as u,t as d}from"./SignInForm.stories-CGqjAQvd.js";import{Default as f,t as p}from"./SignUpForm.stories-BW-opXUB.js";import{Default as m,t as h}from"./UpdatePasswordForm.stories-Bgsp6gpV.js";var g,_,v,y,b,x,S;e((()=>{o(),l(),d(),p(),h(),g=t(),_={title:`Guest/Auth/AuthPageShell`,component:i,parameters:{layout:`fullscreen`}},v={args:{title:`Sign in`,description:`Welcome back to Artificer Toolkit`,children:null},render:({title:e,description:t})=>(0,g.jsx)(i,{title:e,description:t,children:(0,g.jsx)(r,{...u.args})})},y={args:{title:`Create an account`,description:`Start building your world today`,children:null},render:({title:e,description:t})=>(0,g.jsx)(i,{title:e,description:t,children:(0,g.jsx)(n,{...f.args})})},b={args:{title:`Reset your password`,description:`Enter your email and we'll send you a reset link.`,children:null},render:({title:e,description:t})=>(0,g.jsx)(i,{title:e,description:t,children:(0,g.jsx)(a,{...c.args})})},x={args:{title:`Set a new password`,description:`Choose a new password to finish recovering your account.`,children:null},render:({title:e,description:t})=>(0,g.jsx)(i,{title:e,description:t,children:(0,g.jsx)(s,{...m.args})})},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Sign in',
    description: 'Welcome back to Artificer Toolkit',
    children: null
  },
  render: ({
    title,
    description
  }) => <AuthPageShell title={title} description={description}>\r
      <SignInForm {...SignInFormStories.Default.args} />\r
    </AuthPageShell>
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Create an account',
    description: 'Start building your world today',
    children: null
  },
  render: ({
    title,
    description
  }) => <AuthPageShell title={title} description={description}>\r
      <SignUpForm {...SignUpFormStories.Default.args} />\r
    </AuthPageShell>
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Reset your password',
    description: 'Enter your email and we\\'ll send you a reset link.',
    children: null
  },
  render: ({
    title,
    description
  }) => <AuthPageShell title={title} description={description}>\r
      <ResetPasswordForm {...ResetPasswordFormStories.Default.args} />\r
    </AuthPageShell>
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Set a new password',
    description: 'Choose a new password to finish recovering your account.',
    children: null
  },
  render: ({
    title,
    description
  }) => <AuthPageShell title={title} description={description}>\r
      <UpdatePasswordForm {...UpdatePasswordFormStories.Default.args} />\r
    </AuthPageShell>
}`,...x.parameters?.docs?.source}}},S=[`Login`,`Signup`,`ResetPassword`,`UpdatePassword`]}))();export{v as Login,b as ResetPassword,y as Signup,x as UpdatePassword,S as __namedExportsOrder,_ as default};