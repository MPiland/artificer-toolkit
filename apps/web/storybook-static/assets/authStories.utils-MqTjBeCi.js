import{a as e,n as t}from"./chunk-DnJy8xQt.js";import{t as n}from"./react-Baqbuk-D.js";import{t as r}from"./jsx-runtime-BX9360Lk.js";import{E as i,L as a,a as o,j as s,k as c,n as l,p as u,t as d}from"./layers.css.ts.vanilla-CgUoudx4.js";import{c as f,d as p,i as m,l as h,n as ee,r as te,t as ne,u as re}from"./iframe-DKeemS-Q.js";import{n as ie,t as g}from"./client-CCpfOV_x.js";import{n as ae,t as oe}from"./ILogo-D-SNLNvS.js";import{t as se}from"./ThemeToggle-DbTMJNoH.js";import{t as ce}from"./primitives-DGE540rO.js";function _(e,t){h.show({title:e,message:t,color:`red`})}function v(e,t){h.show({title:e,message:t,color:`green`})}var y=t((()=>{f()}));function le(e){if(!(typeof window>`u`))return`${window.location.origin}${e}`}var b,x=t((()=>{ie(),b={async signIn(e){let{data:t,error:n}=await g().auth.signInWithPassword(e);return n?{ok:!1,message:n.message}:{ok:!0,session:t.session??null}},async signUp(e){let{data:t,error:n}=await g().auth.signUp({email:e.email,password:e.password,options:{data:{display_name:e.name},emailRedirectTo:le(`/auth/confirmed`)}});return n?{ok:!1,message:n.message}:{ok:!0,session:t.session??null}},async requestPasswordReset(e){let{error:t}=await g().auth.resetPasswordForEmail(e.email,{redirectTo:le(`/update-password`)});return t?{ok:!1,message:t.message}:{ok:!0}},async updatePassword(e){let{error:t}=await g().auth.updateUser({password:e.password});return t?{ok:!1,message:t.message}:{ok:!0}},async signOut(){let{error:e}=await g().auth.signOut();return e?{ok:!1,message:e.message}:{ok:!0}}}})),ue=t((()=>{})),S,de,C,fe,pe,me,he,ge,w,_e,ve,T,ye,be,xe,Se,Ce,E,we,D,Te,O,k,A,j,Ee,M,N,P=t((()=>{d(),ue(),S=`vhumlw1`,de=`vhumlw2`,C=`vhumlw3`,fe=`vhumlw4`,pe=`vhumlw5`,me=`vhumlw6`,he=`vhumlw7`,ge=`vhumlw8`,w=`vhumlw9`,_e=`vhumlwa`,ve=`vhumlwb`,T=`vhumlwc`,ye=`vhumlwd`,be=`vhumlwe`,xe=`vhumlwf`,Se=`vhumlwg`,Ce=`vhumlwh`,E=`vhumlwi`,we=`vhumlwm`,D=`vhumlwp`,Te=`vhumlwq`,O=`vhumlwr`,k=`vhumlws`,A=`vhumlwt`,j=`vhumlwu`,Ee=`vhumlwv`,M=`vhumlww`,N=`vhumlwx`}));function F({children:e,className:t,ref:n,type:r=`styled`,...o}){let l={...o,className:t,component:p,ref:n,activeProps:{...o.activeProps,"data-active":!0},children:e};return r===`unstyled`?(0,I.jsx)(a,{...l}):r===`anchor`?(0,I.jsx)(c,{...l}):r===`alert`?(0,I.jsx)(s,{...l}):(0,I.jsx)(i,{...l})}var I,L=t((()=>{re(),l(),I=r(),F.__docgenInfo={description:``,methods:[],displayName:`Link`,props:{className:{required:!1,tsType:{name:`string`},description:``},ref:{required:!1,tsType:{name:`Ref`,elements:[{name:`HTMLAnchorElement`}],raw:`Ref<HTMLAnchorElement>`},description:``},children:{required:!1,tsType:{name:`ReactNode`},description:``},type:{required:!1,tsType:{name:`union`,raw:`'styled' | 'unstyled' | 'anchor' | 'alert'`,elements:[{name:`literal`,value:`'styled'`},{name:`literal`,value:`'unstyled'`},{name:`literal`,value:`'anchor'`},{name:`literal`,value:`'alert'`}]},description:``,defaultValue:{value:`'styled'`,computed:!1}},to:{required:!0,tsType:{name:`ToOptions['to']`,raw:`ToOptions['to']`},description:``},params:{required:!1,tsType:{name:`NavigateOptions['params']`,raw:`NavigateOptions['params']`},description:``}}}}));function R(){return(0,z.jsxs)(`div`,{className:Ee,"aria-hidden":`true`,children:[(0,z.jsx)(`span`,{className:M}),(0,z.jsx)(`span`,{children:`or`}),(0,z.jsx)(`span`,{className:M})]})}var z,B=t((()=>{P(),z=r(),R.__docgenInfo={description:``,methods:[],displayName:`AuthDivider`}})),V,H,De=t((()=>{m(),V=r(),H=te({name:`IArrowRight`,slot:{x:10,y:10,width:28,height:28,viewBox:`0 0 30 30`},content:(0,V.jsx)(`g`,{transform:`translate(48 0) scale(-1 1)`,children:(0,V.jsx)(`svg`,{x:10,y:10,width:28,height:28,viewBox:`0 0 30 30`,fill:`none`,preserveAspectRatio:`none`,dangerouslySetInnerHTML:{__html:`<path id="Vector" d="M15 29L1 15M1 15L15 1M1 15H29" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`}})})})}));function Oe({authClient:e=b,onSuccess:t}){let[n,r]=(0,U.useState)(``),[a,s]=(0,U.useState)(``),[c,l]=(0,U.useState)(!1),[d,f]=(0,U.useState)(null);async function p(r){r.preventDefault(),l(!0),f(null);try{let r=await e.signIn({email:n,password:a});if(!r.ok){let e=r.message??`Check your email and password, then try again.`;f({tone:`error`,message:e}),_(`Unable to sign in`,e);return}let i=`Your toolkit is ready.`;f({tone:`success`,message:i}),v(`Signed in`,i),await t?.(r)}finally{l(!1)}}return(0,W.jsxs)(`form`,{className:E,onSubmit:p,children:[(0,W.jsx)(o,{label:`Email address`,classNames:{input:D},name:`email`,type:`email`,placeholder:`you@example.com`,value:n,onChange:e=>r(e.currentTarget.value),required:!0}),(0,W.jsx)(u,{label:`Password`,classNames:{input:D},name:`password`,type:`password`,placeholder:`********`,value:a,onChange:e=>s(e.currentTarget.value),required:!0}),(0,W.jsx)(`div`,{className:Te,children:(0,W.jsx)(F,{className:O,to:`/reset-password`,type:`anchor`,children:`Forgot password?`})}),(0,W.jsx)(i,{className:j,type:`submit`,disabled:c,children:c?`Opening toolkit...`:`Sign in`}),d&&(0,W.jsx)(`div`,{className:`vhumlwj ${d.tone===`error`?`vhumlwk`:`vhumlwl`}`,role:d.tone===`error`?`alert`:`status`,"aria-live":d.tone===`error`?`assertive`:`polite`,children:d.message}),(0,W.jsx)(R,{}),(0,W.jsxs)(`div`,{className:N,children:[(0,W.jsx)(`span`,{children:`Don't have an account?`}),(0,W.jsxs)(F,{className:O,to:`/sign-up`,type:`anchor`,children:[`Sign up`,(0,W.jsx)(`span`,{className:k,"aria-hidden":`true`,children:(0,W.jsx)(H,{className:A,size:14})})]})]})]})}var U,W,ke=t((()=>{U=e(n(),1),y(),x(),P(),L(),B(),l(),De(),W=r(),Oe.__docgenInfo={description:``,methods:[],displayName:`SignInForm`,props:{authClient:{required:!1,tsType:{name:`AuthClient`},description:``,defaultValue:{value:`{
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
}`,computed:!1}},onSuccess:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(result: AuthResult) => void | Promise<void>`,signature:{arguments:[{type:{name:`AuthResult`},name:`result`}],return:{name:`union`,raw:`void | Promise<void>`,elements:[{name:`void`},{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}]}}},description:``}}}}));function Ae({authClient:e=b,onSuccess:t}){let[n,r]=(0,G.useState)(``),[a,o]=(0,G.useState)(``),[s,c]=(0,G.useState)(!1),[l,d]=(0,G.useState)(null);async function f(r){if(r.preventDefault(),d(null),n.length<8){let e=`Use at least 8 characters for your new password.`;d({tone:`error`,message:e}),_(`Password is too short`,e);return}if(n!==a){let e=`Enter the same password in both fields.`;d({tone:`error`,message:e}),_(`Passwords do not match`,e);return}c(!0);try{let r=await e.updatePassword({password:n});if(!r.ok){let e=r.message??`Try the recovery link again or request a new reset email.`;d({tone:`error`,message:e}),_(`Unable to update password`,e);return}let i=`Use your new password the next time you sign in.`;d({tone:`success`,message:i}),v(`Password updated`,i),await t?.(r)}finally{c(!1)}}return(0,K.jsxs)(`form`,{className:E,onSubmit:f,children:[(0,K.jsx)(u,{label:`New password`,classNames:{input:D},name:`password`,type:`password`,placeholder:`********`,value:n,onChange:e=>r(e.currentTarget.value),required:!0}),(0,K.jsx)(`p`,{className:we,children:`Use at least 8 characters. Avoid a password you use at another table or tool.`}),(0,K.jsx)(u,{label:`Confirm password`,classNames:{input:D},name:`confirmPassword`,type:`password`,placeholder:`********`,value:a,onChange:e=>o(e.currentTarget.value),required:!0}),(0,K.jsx)(i,{className:j,type:`submit`,disabled:s,children:s?`Updating password...`:`Update password`}),l&&(0,K.jsx)(`div`,{className:`vhumlwj ${l.tone===`error`?`vhumlwk`:`vhumlwl`}`,role:l.tone===`error`?`alert`:`status`,"aria-live":l.tone===`error`?`assertive`:`polite`,children:l.message}),(0,K.jsx)(R,{}),(0,K.jsx)(`div`,{className:N,children:(0,K.jsxs)(F,{className:O,to:`/sign-in`,type:`anchor`,children:[(0,K.jsx)(`span`,{className:k,"aria-hidden":`true`,children:(0,K.jsx)(ne,{className:A,size:14})}),`Back to sign in`]})})]})}var G,K,je=t((()=>{G=e(n(),1),l(),L(),x(),P(),B(),y(),ee(),K=r(),Ae.__docgenInfo={description:``,methods:[],displayName:`UpdatePasswordForm`,props:{authClient:{required:!1,tsType:{name:`AuthClient`},description:``,defaultValue:{value:`{
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
}`,computed:!1}},onSuccess:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(result: AuthResult) => void | Promise<void>`,signature:{arguments:[{type:{name:`AuthResult`},name:`result`}],return:{name:`union`,raw:`void | Promise<void>`,elements:[{name:`void`},{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}]}}},description:``}}}}));function Me({authClient:e=b,onSuccess:t}){let[n,r]=(0,q.useState)(``),[a,s]=(0,q.useState)(!1),[c,l]=(0,q.useState)(null);async function u(r){r.preventDefault(),s(!0),l(null);try{let r=await e.requestPasswordReset({email:n});if(!r.ok){let e=r.message??`Check the email address and try again.`;l({tone:`error`,message:e}),_(`Unable to send reset link`,e);return}let i=`If email delivery is enabled, a secure reset link is on its way.`;l({tone:`success`,message:i}),v(`Reset link sent`,i),await t?.(r)}finally{s(!1)}}return(0,J.jsxs)(`form`,{className:E,onSubmit:u,children:[(0,J.jsx)(o,{label:`Email address`,classNames:{input:D},name:`email`,type:`email`,placeholder:`you@example.com`,value:n,onChange:e=>r(e.currentTarget.value),required:!0}),(0,J.jsx)(i,{className:j,type:`submit`,disabled:a,children:a?`Sending link...`:`Send reset link`}),c&&(0,J.jsx)(`div`,{className:`vhumlwj ${c.tone===`error`?`vhumlwk`:`vhumlwl`}`,role:c.tone===`error`?`alert`:`status`,"aria-live":c.tone===`error`?`assertive`:`polite`,children:c.message}),(0,J.jsx)(R,{}),(0,J.jsx)(`div`,{className:N,children:(0,J.jsxs)(F,{className:O,to:`/sign-in`,type:`anchor`,children:[(0,J.jsx)(`span`,{className:k,"aria-hidden":`true`,children:(0,J.jsx)(ne,{className:A,size:14})}),`Back to sign in`]})})]})}var q,J,Ne=t((()=>{q=e(n(),1),l(),L(),ee(),x(),P(),B(),y(),J=r(),Me.__docgenInfo={description:``,methods:[],displayName:`ResetPasswordForm`,props:{authClient:{required:!1,tsType:{name:`AuthClient`},description:``,defaultValue:{value:`{
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
}`,computed:!1}},onSuccess:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(result: AuthResult) => void | Promise<void>`,signature:{arguments:[{type:{name:`AuthResult`},name:`result`}],return:{name:`union`,raw:`void | Promise<void>`,elements:[{name:`void`},{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}]}}},description:``}}}}));function Pe({authClient:e=b,onSuccess:t}){let[n,r]=(0,Y.useState)(``),[a,s]=(0,Y.useState)(``),[c,l]=(0,Y.useState)(``),[d,f]=(0,Y.useState)(!1),[p,m]=(0,Y.useState)(null);async function h(r){if(r.preventDefault(),c.length<8){let e=`Use at least 8 characters for your password.`;m({tone:`error`,message:e}),_(`Password is too short`,e);return}f(!0),m(null);try{let r=await e.signUp({name:n,email:a,password:c});if(!r.ok){let e=r.message??`Check the form and try again.`;m({tone:`error`,message:e}),_(`Unable to create account`,e);return}if(r.session){let e=`Your toolkit is ready.`;m({tone:`success`,message:e}),v(`Account created`,e)}else{let e=`Confirmation instructions were sent if email is enabled for this project.`;m({tone:`success`,message:e}),v(`Check your email`,e)}await t?.(r)}finally{f(!1)}}return(0,X.jsxs)(`form`,{className:E,onSubmit:h,children:[(0,X.jsx)(o,{label:`Name`,classNames:{input:D},name:`name`,type:`text`,placeholder:`Morgan Emberfall`,value:n,onChange:e=>r(e.currentTarget.value),required:!0}),(0,X.jsx)(o,{label:`Email address`,classNames:{input:D},name:`email`,type:`email`,placeholder:`you@example.com`,value:a,onChange:e=>s(e.currentTarget.value),required:!0}),(0,X.jsx)(u,{label:`Password`,classNames:{input:D},name:`password`,type:`password`,placeholder:`********`,value:c,onChange:e=>l(e.currentTarget.value),required:!0}),(0,X.jsx)(`p`,{className:we,children:`Use at least 8 characters. A mix of letters and numbers is easier to keep secure.`}),(0,X.jsx)(i,{className:j,type:`submit`,disabled:d,children:d?`Creating account...`:`Create account`}),p&&(0,X.jsx)(`div`,{className:`vhumlwj ${p.tone===`error`?`vhumlwk`:`vhumlwl`}`,role:p.tone===`error`?`alert`:`status`,"aria-live":p.tone===`error`?`assertive`:`polite`,children:p.message}),(0,X.jsx)(R,{}),(0,X.jsxs)(`div`,{className:N,children:[(0,X.jsx)(`span`,{children:`Already have an account?`}),(0,X.jsxs)(F,{className:O,to:`/sign-in`,type:`anchor`,children:[`Sign in`,(0,X.jsx)(`span`,{className:k,"aria-hidden":`true`,children:(0,X.jsx)(H,{className:A,size:14})})]})]})]})}var Y,X,Fe=t((()=>{Y=e(n(),1),l(),L(),De(),x(),P(),y(),B(),X=r(),Pe.__docgenInfo={description:``,methods:[],displayName:`SignUpForm`,props:{authClient:{required:!1,tsType:{name:`AuthClient`},description:``,defaultValue:{value:`{
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
}`,computed:!1}},onSuccess:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(result: AuthResult) => void | Promise<void>`,signature:{arguments:[{type:{name:`AuthResult`},name:`result`}],return:{name:`union`,raw:`void | Promise<void>`,elements:[{name:`void`},{name:`Promise`,elements:[{name:`void`}],raw:`Promise<void>`}]}}},description:``}}}}));function Ie({title:e,description:t,children:n,variant:r=`entry`}){let i=r===`support`;return(0,Z.jsxs)(`main`,{className:i?`${S} ${de}`:S,"data-testid":`auth-shell`,children:[(0,Z.jsxs)(`section`,{className:i?`${C} ${fe}`:C,"aria-label":`Artificer Toolkit introduction`,children:[(0,Z.jsxs)(`div`,{className:pe,children:[(0,Z.jsxs)(p,{className:me,to:`/`,children:[(0,Z.jsx)(oe,{className:he,"aria-hidden":`true`}),(0,Z.jsx)(`span`,{children:`Artificer Toolkit`})]}),(0,Z.jsx)(se,{})]}),(0,Z.jsx)(`div`,{className:ge,children:(0,Z.jsxs)(`div`,{children:[(0,Z.jsx)(`h1`,{className:i?`${w} ${_e}`:w,children:i?(0,Z.jsx)(Z.Fragment,{children:`Get back to your table.`}):(0,Z.jsx)(Z.Fragment,{children:`Make something worth playing.`})}),(0,Z.jsx)(`p`,{className:ve,children:i?`A short account step, then you are back to building characters, content, and play-ready notes.`:`Sign in to keep your homebrew, characters, and table tools close without turning creativity into paperwork.`})]})})]}),(0,Z.jsx)(`section`,{className:i?`${T} ${ye}`:T,"aria-label":e,children:(0,Z.jsxs)(`div`,{className:be,children:[(0,Z.jsxs)(`header`,{className:xe,children:[(0,Z.jsx)(`h2`,{className:Se,children:e}),(0,Z.jsx)(`p`,{className:Ce,children:t})]}),n]})})]})}var Z,Le=t((()=>{re(),ae(),ce(),P(),Z=r(),Ie.__docgenInfo={description:``,methods:[],displayName:`AuthPageShell`,props:{title:{required:!0,tsType:{name:`string`},description:``},description:{required:!0,tsType:{name:`string`},description:``},children:{required:!0,tsType:{name:`ReactNode`},description:``},variant:{required:!1,tsType:{name:`union`,raw:`'entry' | 'support'`,elements:[{name:`literal`,value:`'entry'`},{name:`literal`,value:`'support'`}]},description:``,defaultValue:{value:`'entry'`,computed:!1}}}}})),Re=t((()=>{ke(),je(),Ne(),Fe(),Le()}));async function Q(e=0){e<=0||await new Promise(t=>window.setTimeout(t,e))}function ze(e={}){let t=e.result??{ok:!0};return{signIn:$(async()=>(await Q(e.delayMs),t)),signUp:$(async()=>(await Q(e.delayMs),t)),requestPasswordReset:$(async()=>(await Q(e.delayMs),t)),updatePassword:$(async()=>(await Q(e.delayMs),t)),signOut:$(async()=>(await Q(e.delayMs),t))}}var $,Be=t((()=>{({fn:$}=__STORYBOOK_MODULE_TEST__),ze()}));export{Pe as a,Oe as c,Ie as i,Be as n,Me as o,Re as r,Ae as s,ze as t};