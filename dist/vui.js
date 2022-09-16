// Vimesh UI v0.2.0
"use strict";!function(t){if(!t.$vui){t.$vui={config:{},ready(e){t.Alpine?e():document.addEventListener("alpine:init",e)}};const o=t.$vui._={isString(e){return null!=e&&"string"==typeof e.valueOf()},isArray(e){return Array.isArray(e)},isFunction(e){return"function"==typeof e},isPlainObject(e){return null!==e&&"object"==typeof e&&e.constructor===Object},each(e,n){e&&(o.isArray(e)?e.forEach((e,t)=>{n(e,t,t)}):Object.entries(e).forEach(([e,t],r)=>{n(t,e,r)}))},extend(r,...t){var n=t.length;if(n<1||null==r)return r;for(let e=0;e<n;e++){const i=t[e];o.isPlainObject(i)&&Object.keys(i).forEach(e=>{var t=Object.getOwnPropertyDescriptor(i,e);t.get||t.set?Object.defineProperty(r,e,t):r[e]=i[e]})}return r},get(t,e){if(!o.isString(e)||!e)throw`Unable to get the property "${e}" in `+t;var r=e.split(".");for(let e=0;e<r.length-1;e++){if(!t[r[e]])return null;t=t[r[e]]}return t[r[r.length-1]]},set(t,e,r){if(!o.isString(e)||!e)throw`Unable to set the property "${e}" in `+t;var n=e.split(".");for(let e=0;e<n.length-1;e++)t[n[e]]||(t[n[e]]={}),t=t[n[e]];t[n[n.length-1]]=r}}}}(window),$vui.setups||($vui.setups={}),$vui.components||($vui.components={}),$vui.ready(()=>{const s=$vui._,{directive:e,bind:a,prefixed:c}=Alpine;e("component",(t,{expression:e},{})=>{"template"!==t.tagName.toLowerCase()&&warn("x-ui can only be used on a <template> tag",t);const o=e;s.each(t.content.querySelectorAll("script"),e=>{var t=e.getAttribute("part")||"",t=o+(t?"/"+t:"");const r=document.createElement("script");s.each(e.attributes,e=>r.setAttribute(e.name,e.value)),r.setAttribute("component",o),r.innerHTML=`
$vui.setups["${t}"] = ($el)=>{
${e.innerHTML}
}
//# sourceURL=__vui__/${t}.js
`,document.body.append(r)}),$vui.components[o]=class extends HTMLElement{connectedCallback(){const r={},n=[],e=(s.each(this.childNodes,e=>{var t;"TEMPLATE"===e.tagName?(t=e.getAttribute("slot"))&&(r[t]=e.content.cloneNode(!0).childNodes):n.push(e.cloneNode(!0))}),c("component"));s.each(t.attributes,t=>{if(e!==t.name)try{this.setAttribute(t.name,t.value)}catch(e){console.warn(`Fails to set attribute ${t.name}=${t.value} in `+this.tagName)}}),this.innerHTML=t.innerHTML,s.each(this.querySelectorAll("slot"),e=>{var t=e.getAttribute("name");e.after(...r[t]||n),e.remove()});let i=$vui.setups[o];i&&a(this,i(this)),s.each(this.querySelectorAll("*[part]"),e=>{var t=e.getAttribute("part")||"",t=o+(t?"/"+t:"");(i=$vui.setups[t])&&a(e,i(e))})}},customElements.define(o,$vui.components[o])})}),$vui.import=e=>{const l=$vui._,n=$vui.config.importMap;if(!n||!n["*"])return Promise.reject('You must setup import url template for the fallback namespace "*"');if($vui.imports||($vui.imports={}),$vui.importScriptIndex||($vui.importScriptIndex=1),l.isString(e)&&(e=[e]),l.isArray(e)){const i=[];return l.each(e,c=>{c=c.trim();const t=n["*"];let u=null;var e=c.split("/"),e=1===e.length?{namespace:"",component:c}:{namespace:e[0],component:e[1]};e.namespace&&n[e.namespace]&&(t=n[e.namespace]);try{const r=new Function("data","with (data){return `"+t+"`}");u=r(e)}catch(e){return void console.error(`Fails to parse url template ${t} with component `+c)}u&&!$vui.imports[u]&&($vui.imports[u]=!0,i.push(fetch(u).then(e=>e.text()).then(e=>{const t=document.createElement("div");t.innerHTML=e;let a=[...t.childNodes];return new Promise(o=>{const s=e=>{if(e<a.length){const n=a[e];if(n.remove(),"SCRIPT"===n.tagName){const i=document.createElement("script");var t,r=n.src&&!n.async;r&&(i.onload=()=>{s(e+1)},i.onerror=()=>{console.error(`Fails to load script from "${i.src}"`),s(e+1)}),l.each(n.attributes,e=>i.setAttribute(e.name,e.value)),n.src||(t=`__vui__/scripts/js_${$vui.importScriptIndex}.js`,i.setAttribute("file",t),i.innerHTML=n.innerHTML+`\r
//# sourceURL=`+t,$vui.importScriptIndex++),document.body.append(i),r||s(e+1)}else"TEMPLATE"===n.tagName&&document.body.append(n),s(e+1)}else console.log(`Imported ${c} @ `+u),o()};s(0)})}).catch(e=>{console.error(`Fails to import ${c} @ `+u,e)})))}),Promise.all(i)}return Promise.reject(`Fails to import ${comp} !`)},$vui.ready(()=>{const n=$vui._,{directive:e,evaluateLater:i,effect:o}=Alpine;e("import",(t,{expression:r},{})=>{if(r){let e=r.trim();if(e.startsWith("[")&&e.endsWith("]")){let e=i(t,r);o(()=>e(e=>{n.isArray(e)&&$vui.import(e)}))}else $vui.import(e.split(","))}})});