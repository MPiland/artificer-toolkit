import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{t as n}from"./react-Baqbuk-D.js";import{t as r}from"./jsx-runtime-BX9360Lk.js";import{E as i,a,n as o,p as s,t as c}from"./layers.css.ts.vanilla-DSufe1lN.js";import{c as l,d as u,i as d,l as f,n as p,r as m,t as h,u as ee}from"./iframe-BEas0QsY.js";import{n as te,t as g}from"./client-BB6RLuLS.js";import{n as _,r as v,t as ne}from"./primitives-BScFjZdY.js";import{n as re,t as ie}from"./ILogo-f3U8aUjg.js";import{t as ae}from"./ThemeToggle-p7fTRsZi.js";function y(e,t){f.show({title:e,message:t,color:`red`})}function b(e,t){f.show({title:e,message:t,color:`green`})}var x=t((()=>{l()}));function oe(e){if(!(typeof window>`u`))return`${window.location.origin}${e}`}var S,C=t((()=>{te(),S={async signIn(e){let{data:t,error:n}=await g().auth.signInWithPassword(e);return n?{ok:!1,message:n.message}:{ok:!0,session:t.session??null}},async signUp(e){let{data:t,error:n}=await g().auth.signUp({email:e.email,password:e.password,options:{data:{display_name:e.name},emailRedirectTo:oe(`/auth/confirmed`)}});return n?{ok:!1,message:n.message}:{ok:!0,session:t.session??null}},async requestPasswordReset(e){let{error:t}=await g().auth.resetPasswordForEmail(e.email,{redirectTo:oe(`/update-password`)});return t?{ok:!1,message:t.message}:{ok:!0}},async updatePassword(e){let{error:t}=await g().auth.updateUser({password:e.password});return t?{ok:!1,message:t.message}:{ok:!0}},async signOut(){let{error:e}=await g().auth.signOut();return e?{ok:!1,message:e.message}:{ok:!0}}}})),se=t((()=>{})),w,ce,T,le,ue,de,fe,pe,E,me,he,D,ge,_e,ve,ye,be,O,k,A,xe,j,M,N,P,Se,F,I,L=t((()=>{c(),se(),w=`vhumlw1`,ce=`vhumlw2`,T=`vhumlw3`,le=`vhumlw4`,ue=`vhumlw5`,de=`vhumlw6`,fe=`vhumlw7`,pe=`vhumlw8`,E=`vhumlw9`,me=`vhumlwa`,he=`vhumlwb`,D=`vhumlwc`,ge=`vhumlwd`,_e=`vhumlwe`,ve=`vhumlwf`,ye=`vhumlwg`,be=`vhumlwh`,O=`vhumlwi`,k=`vhumlwm`,A=`vhumlwp`,xe=`vhumlwq`,j=`vhumlwr`,M=`vhumlws`,N=`vhumlwt`,P=`vhumlwu`,Se=`vhumlwv`,F=`vhumlww`,I=`vhumlwx`}));function R(){return(0,z.jsxs)(`div`,{className:Se,"aria-hidden":`true`,children:[(0,z.jsx)(`span`,{className:F}),(0,z.jsx)(`span`,{children:`or`}),(0,z.jsx)(`span`,{className:F})]})}var z,B=t((()=>{L(),z=r(),R.__docgenInfo={description:``,methods:[],displayName:`AuthDivider`}})),V,H,Ce=t((()=>{d(),V=r(),H=m({name:`IArrowRight`,slot:{x:10,y:10,width:28,height:28,viewBox:`0 0 30 30`},content:(0,V.jsx)(`g`,{transform:`translate(48 0) scale(-1 1)`,children:(0,V.jsx)(`svg`,{x:10,y:10,width:28,height:28,viewBox:`0 0 30 30`,fill:`none`,preserveAspectRatio:`none`,dangerouslySetInnerHTML:{__html:`<path id="Vector" d="M15 29L1 15M1 15L15 1M1 15H29" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`}})})})}));function we({authClient:e=S,onSuccess:t}){let[n,r]=(0,U.useState)(``),[o,c]=(0,U.useState)(``),[l,u]=(0,U.useState)(!1),[d,f]=(0,U.useState)(null);async function p(r){r.preventDefault(),u(!0),f(null);try{let r=await e.signIn({email:n,password:o});if(!r.ok){let e=r.message??`Check your email and password, then try again.`;f({tone:`error`,message:e}),y(`Unable to sign in`,e);return}let i=`Your toolkit is ready.`;f({tone:`success`,message:i}),b(`Signed in`,i),await t?.(r)}finally{u(!1)}}return(0,W.jsxs)(`form`,{className:O,onSubmit:p,children:[(0,W.jsx)(a,{label:`Email address`,classNames:{input:A},name:`email`,type:`email`,placeholder:`you@example.com`,value:n,onChange:e=>r(e.currentTarget.value),required:!0}),(0,W.jsx)(s,{label:`Password`,classNames:{input:A},name:`password`,type:`password`,placeholder:`********`,value:o,onChange:e=>c(e.currentTarget.value),required:!0}),(0,W.jsx)(`div`,{className:xe,children:(0,W.jsx)(_,{className:j,to:`/reset-password`,type:`anchor`,children:`Forgot password?`})}),(0,W.jsx)(i,{className:P,type:`submit`,disabled:l,children:l?`Opening toolkit...`:`Sign in`}),d&&(0,W.jsx)(`div`,{className:`vhumlwj ${d.tone===`error`?`vhumlwk`:`vhumlwl`}`,role:d.tone===`error`?`alert`:`status`,"aria-live":d.tone===`error`?`assertive`:`polite`,children:d.message}),(0,W.jsx)(R,{}),(0,W.jsxs)(`div`,{className:I,children:[(0,W.jsx)(`span`,{children:`Don't have an account?`}),(0,W.jsxs)(_,{className:j,to:`/sign-up`,type:`anchor`,children:[`Sign up`,(0,W.jsx)(`span`,{className:M,"aria-hidden":`true`,children:(0,W.jsx)(H,{className:N,size:14})})]})]})]})}var U,W,Te=t((()=>{U=e(n(),1),x(),C(),L(),v(),B(),o(),Ce(),W=r(),we.__docgenInfo={description:``,methods:[],displayName:`SignInForm`,props:{authClient:{required:!1,tsType:{name:`AuthClient`},description:``,defaultValue:{value:`{
  async signIn(input) {
    const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword(input)
    return error ? { ok: false, message: error.message } : { ok: true, session: data.session ?? null }
  },
  async signUp(input) {
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.name
        },
        emailRedirectTo: getAuthRedirectUrl('/auth/confirmed')
      }
    })
    return error ? { ok: false, message: error.message } : { ok: true, session: data.session ?? null }
  },
  async requestPasswordReset(input) {
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(input.email, {
      redirectTo: getAuthRedirectUrl('/update-password')
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async updatePassword(input) {
    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password: input.password
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async signOut() {
    const { error } = await getSupabaseBrowserClient().auth.signOut()
    return error ? { ok: false, message: error.message } : { ok: true }
  }
}`,computed:!1}},onSuccess:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(result: AuthResult) => void | Promise<void>`,signature:{arguments:[{type:{name:`AuthResult`},name:`result`}],return:{name:`union`,raw:`void | Promise<void>`,elements:[{name:`void`},{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}]}}},description:``}}}}));function Ee({authClient:e=S,onSuccess:t}){let[n,r]=(0,G.useState)(``),[a,o]=(0,G.useState)(``),[c,l]=(0,G.useState)(!1),[u,d]=(0,G.useState)(null);async function f(r){if(r.preventDefault(),d(null),n.length<8){let e=`Use at least 8 characters for your new password.`;d({tone:`error`,message:e}),y(`Password is too short`,e);return}if(n!==a){let e=`Enter the same password in both fields.`;d({tone:`error`,message:e}),y(`Passwords do not match`,e);return}l(!0);try{let r=await e.updatePassword({password:n});if(!r.ok){let e=r.message??`Try the recovery link again or request a new reset email.`;d({tone:`error`,message:e}),y(`Unable to update password`,e);return}let i=`Use your new password the next time you sign in.`;d({tone:`success`,message:i}),b(`Password updated`,i),await t?.(r)}finally{l(!1)}}return(0,K.jsxs)(`form`,{className:O,onSubmit:f,children:[(0,K.jsx)(s,{label:`New password`,classNames:{input:A},name:`password`,type:`password`,placeholder:`********`,value:n,onChange:e=>r(e.currentTarget.value),required:!0}),(0,K.jsx)(`p`,{className:k,children:`Use at least 8 characters. Avoid a password you use at another table or tool.`}),(0,K.jsx)(s,{label:`Confirm password`,classNames:{input:A},name:`confirmPassword`,type:`password`,placeholder:`********`,value:a,onChange:e=>o(e.currentTarget.value),required:!0}),(0,K.jsx)(i,{className:P,type:`submit`,disabled:c,children:c?`Updating password...`:`Update password`}),u&&(0,K.jsx)(`div`,{className:`vhumlwj ${u.tone===`error`?`vhumlwk`:`vhumlwl`}`,role:u.tone===`error`?`alert`:`status`,"aria-live":u.tone===`error`?`assertive`:`polite`,children:u.message}),(0,K.jsx)(R,{}),(0,K.jsx)(`div`,{className:I,children:(0,K.jsxs)(_,{className:j,to:`/sign-in`,type:`anchor`,children:[(0,K.jsx)(`span`,{className:M,"aria-hidden":`true`,children:(0,K.jsx)(h,{className:N,size:14})}),`Back to sign in`]})})]})}var G,K,De=t((()=>{G=e(n(),1),o(),v(),C(),L(),B(),x(),p(),K=r(),Ee.__docgenInfo={description:``,methods:[],displayName:`UpdatePasswordForm`,props:{authClient:{required:!1,tsType:{name:`AuthClient`},description:``,defaultValue:{value:`{
  async signIn(input) {
    const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword(input)
    return error ? { ok: false, message: error.message } : { ok: true, session: data.session ?? null }
  },
  async signUp(input) {
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.name
        },
        emailRedirectTo: getAuthRedirectUrl('/auth/confirmed')
      }
    })
    return error ? { ok: false, message: error.message } : { ok: true, session: data.session ?? null }
  },
  async requestPasswordReset(input) {
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(input.email, {
      redirectTo: getAuthRedirectUrl('/update-password')
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async updatePassword(input) {
    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password: input.password
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async signOut() {
    const { error } = await getSupabaseBrowserClient().auth.signOut()
    return error ? { ok: false, message: error.message } : { ok: true }
  }
}`,computed:!1}},onSuccess:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(result: AuthResult) => void | Promise<void>`,signature:{arguments:[{type:{name:`AuthResult`},name:`result`}],return:{name:`union`,raw:`void | Promise<void>`,elements:[{name:`void`},{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}]}}},description:``}}}}));function Oe({authClient:e=S,onSuccess:t}){let[n,r]=(0,q.useState)(``),[o,s]=(0,q.useState)(!1),[c,l]=(0,q.useState)(null);async function u(r){r.preventDefault(),s(!0),l(null);try{let r=await e.requestPasswordReset({email:n});if(!r.ok){let e=r.message??`Check the email address and try again.`;l({tone:`error`,message:e}),y(`Unable to send reset link`,e);return}let i=`If email delivery is enabled, a secure reset link is on its way.`;l({tone:`success`,message:i}),b(`Reset link sent`,i),await t?.(r)}finally{s(!1)}}return(0,J.jsxs)(`form`,{className:O,onSubmit:u,children:[(0,J.jsx)(a,{label:`Email address`,classNames:{input:A},name:`email`,type:`email`,placeholder:`you@example.com`,value:n,onChange:e=>r(e.currentTarget.value),required:!0}),(0,J.jsx)(i,{className:P,type:`submit`,disabled:o,children:o?`Sending link...`:`Send reset link`}),c&&(0,J.jsx)(`div`,{className:`vhumlwj ${c.tone===`error`?`vhumlwk`:`vhumlwl`}`,role:c.tone===`error`?`alert`:`status`,"aria-live":c.tone===`error`?`assertive`:`polite`,children:c.message}),(0,J.jsx)(R,{}),(0,J.jsx)(`div`,{className:I,children:(0,J.jsxs)(_,{className:j,to:`/sign-in`,type:`anchor`,children:[(0,J.jsx)(`span`,{className:M,"aria-hidden":`true`,children:(0,J.jsx)(h,{className:N,size:14})}),`Back to sign in`]})})]})}var q,J,ke=t((()=>{q=e(n(),1),o(),v(),p(),C(),L(),B(),x(),J=r(),Oe.__docgenInfo={description:``,methods:[],displayName:`ResetPasswordForm`,props:{authClient:{required:!1,tsType:{name:`AuthClient`},description:``,defaultValue:{value:`{
  async signIn(input) {
    const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword(input)
    return error ? { ok: false, message: error.message } : { ok: true, session: data.session ?? null }
  },
  async signUp(input) {
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.name
        },
        emailRedirectTo: getAuthRedirectUrl('/auth/confirmed')
      }
    })
    return error ? { ok: false, message: error.message } : { ok: true, session: data.session ?? null }
  },
  async requestPasswordReset(input) {
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(input.email, {
      redirectTo: getAuthRedirectUrl('/update-password')
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async updatePassword(input) {
    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password: input.password
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async signOut() {
    const { error } = await getSupabaseBrowserClient().auth.signOut()
    return error ? { ok: false, message: error.message } : { ok: true }
  }
}`,computed:!1}},onSuccess:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(result: AuthResult) => void | Promise<void>`,signature:{arguments:[{type:{name:`AuthResult`},name:`result`}],return:{name:`union`,raw:`void | Promise<void>`,elements:[{name:`void`},{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}]}}},description:``}}}}));function Ae({authClient:e=S,onSuccess:t}){let[n,r]=(0,Y.useState)(``),[o,c]=(0,Y.useState)(``),[l,u]=(0,Y.useState)(``),[d,f]=(0,Y.useState)(!1),[p,m]=(0,Y.useState)(null);async function h(r){if(r.preventDefault(),l.length<8){let e=`Use at least 8 characters for your password.`;m({tone:`error`,message:e}),y(`Password is too short`,e);return}f(!0),m(null);try{let r=await e.signUp({name:n,email:o,password:l});if(!r.ok){let e=r.message??`Check the form and try again.`;m({tone:`error`,message:e}),y(`Unable to create account`,e);return}if(r.session){let e=`Your toolkit is ready.`;m({tone:`success`,message:e}),b(`Account created`,e)}else{let e=`Confirmation instructions were sent if email is enabled for this project.`;m({tone:`success`,message:e}),b(`Check your email`,e)}await t?.(r)}finally{f(!1)}}return(0,X.jsxs)(`form`,{className:O,onSubmit:h,children:[(0,X.jsx)(a,{label:`Name`,classNames:{input:A},name:`name`,type:`text`,placeholder:`Morgan Emberfall`,value:n,onChange:e=>r(e.currentTarget.value),required:!0}),(0,X.jsx)(a,{label:`Email address`,classNames:{input:A},name:`email`,type:`email`,placeholder:`you@example.com`,value:o,onChange:e=>c(e.currentTarget.value),required:!0}),(0,X.jsx)(s,{label:`Password`,classNames:{input:A},name:`password`,type:`password`,placeholder:`********`,value:l,onChange:e=>u(e.currentTarget.value),required:!0}),(0,X.jsx)(`p`,{className:k,children:`Use at least 8 characters. A mix of letters and numbers is easier to keep secure.`}),(0,X.jsx)(i,{className:P,type:`submit`,disabled:d,children:d?`Creating account...`:`Create account`}),p&&(0,X.jsx)(`div`,{className:`vhumlwj ${p.tone===`error`?`vhumlwk`:`vhumlwl`}`,role:p.tone===`error`?`alert`:`status`,"aria-live":p.tone===`error`?`assertive`:`polite`,children:p.message}),(0,X.jsx)(R,{}),(0,X.jsxs)(`div`,{className:I,children:[(0,X.jsx)(`span`,{children:`Already have an account?`}),(0,X.jsxs)(_,{className:j,to:`/sign-in`,type:`anchor`,children:[`Sign in`,(0,X.jsx)(`span`,{className:M,"aria-hidden":`true`,children:(0,X.jsx)(H,{className:N,size:14})})]})]})]})}var Y,X,je=t((()=>{Y=e(n(),1),o(),v(),Ce(),C(),L(),x(),B(),X=r(),Ae.__docgenInfo={description:``,methods:[],displayName:`SignUpForm`,props:{authClient:{required:!1,tsType:{name:`AuthClient`},description:``,defaultValue:{value:`{
  async signIn(input) {
    const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword(input)
    return error ? { ok: false, message: error.message } : { ok: true, session: data.session ?? null }
  },
  async signUp(input) {
    const { data, error } = await getSupabaseBrowserClient().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.name
        },
        emailRedirectTo: getAuthRedirectUrl('/auth/confirmed')
      }
    })
    return error ? { ok: false, message: error.message } : { ok: true, session: data.session ?? null }
  },
  async requestPasswordReset(input) {
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(input.email, {
      redirectTo: getAuthRedirectUrl('/update-password')
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async updatePassword(input) {
    const { error } = await getSupabaseBrowserClient().auth.updateUser({
      password: input.password
    })
    return error ? { ok: false, message: error.message } : { ok: true }
  },
  async signOut() {
    const { error } = await getSupabaseBrowserClient().auth.signOut()
    return error ? { ok: false, message: error.message } : { ok: true }
  }
}`,computed:!1}},onSuccess:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(result: AuthResult) => void | Promise<void>`,signature:{arguments:[{type:{name:`AuthResult`},name:`result`}],return:{name:`union`,raw:`void | Promise<void>`,elements:[{name:`void`},{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}]}}},description:``}}}}));function Me({title:e,description:t,children:n,variant:r=`entry`}){let i=r===`support`;return(0,Z.jsxs)(`main`,{className:i?`${w} ${ce}`:w,"data-testid":`auth-shell`,children:[(0,Z.jsxs)(`section`,{className:i?`${T} ${le}`:T,"aria-label":`Artificer Toolkit introduction`,children:[(0,Z.jsxs)(`div`,{className:ue,children:[(0,Z.jsxs)(u,{className:de,to:`/`,children:[(0,Z.jsx)(ie,{className:fe,"aria-hidden":`true`}),(0,Z.jsx)(`span`,{children:`Artificer Toolkit`})]}),(0,Z.jsx)(ae,{})]}),(0,Z.jsx)(`div`,{className:pe,children:(0,Z.jsxs)(`div`,{children:[(0,Z.jsx)(`h1`,{className:i?`${E} ${me}`:E,children:i?(0,Z.jsx)(Z.Fragment,{children:`Get back to your table.`}):(0,Z.jsx)(Z.Fragment,{children:`Make something worth playing.`})}),(0,Z.jsx)(`p`,{className:he,children:i?`A short account step, then you are back to building characters, content, and play-ready notes.`:`Sign in to keep your homebrew, characters, and table tools close without turning creativity into paperwork.`})]})})]}),(0,Z.jsx)(`section`,{className:i?`${D} ${ge}`:D,"aria-label":e,children:(0,Z.jsxs)(`div`,{className:_e,children:[(0,Z.jsxs)(`header`,{className:ve,children:[(0,Z.jsx)(`h2`,{className:ye,children:e}),(0,Z.jsx)(`p`,{className:be,children:t})]}),n]})})]})}var Z,Ne=t((()=>{ee(),re(),ne(),L(),Z=r(),Me.__docgenInfo={description:``,methods:[],displayName:`AuthPageShell`,props:{title:{required:!0,tsType:{name:`string`},description:``},description:{required:!0,tsType:{name:`string`},description:``},children:{required:!0,tsType:{name:`ReactNode`},description:``},variant:{required:!1,tsType:{name:`union`,raw:`'entry' | 'support'`,elements:[{name:`literal`,value:`'entry'`},{name:`literal`,value:`'support'`}]},description:``,defaultValue:{value:`'entry'`,computed:!1}}}}})),Pe=t((()=>{Te(),De(),ke(),je(),Ne()}));async function Q(e=0){e<=0||await new Promise(t=>window.setTimeout(t,e))}function Fe(e={}){let t=e.result??{ok:!0};return{signIn:$(async()=>(await Q(e.delayMs),t)),signUp:$(async()=>(await Q(e.delayMs),t)),requestPasswordReset:$(async()=>(await Q(e.delayMs),t)),updatePassword:$(async()=>(await Q(e.delayMs),t)),signOut:$(async()=>(await Q(e.delayMs),t))}}var $,Ie=t((()=>{({fn:$}=__STORYBOOK_MODULE_TEST__),Fe()}));export{Ae as a,we as c,Me as i,Ie as n,Oe as o,Pe as r,Ee as s,Fe as t};