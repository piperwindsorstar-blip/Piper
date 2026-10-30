import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '../styles.css?url'

/**
 * Older phones and tablets (Safari before 15.4, Chrome before 93, older
 * Samsung Internet) lack a few newer built-ins the site uses. This small
 * classic script fills them in before the app's modules run.
 */
const OLD_BROWSER_FILLS = `(function(){
var d=function(o,k,v){if(!o[k])Object.defineProperty(o,k,{value:v,writable:true,configurable:true})};
d(Object,'hasOwn',function(o,k){return Object.prototype.hasOwnProperty.call(o,k)});
var at=function(i){i=Math.trunc(i)||0;if(i<0)i+=this.length;return i<0||i>=this.length?undefined:this[i]};
d(Array.prototype,'at',at);d(String.prototype,'at',at);
d(Array.prototype,'findLast',function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return this[i]});
d(Array.prototype,'findLastIndex',function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return i;return -1});
d(String.prototype,'replaceAll',function(a,b){return a instanceof RegExp?this.replace(a,b):this.split(a).join(b)});
if(typeof structuredClone!=='function')window.structuredClone=function(v){return v===undefined?v:JSON.parse(JSON.stringify(v))};
})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'apple-mobile-web-app-title', content: 'DJ Piper P' },
      { name: 'theme-color', content: '#f4f1ec' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
      {
        name: 'google-site-verification',
        content: 'rC-19iyENoGxBTVddW7hMLMplqxu6KsJtb64zruLGWY',
      },
      { title: 'DJ Piper P' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600;700;800&display=swap',
      },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icons/icon-180.png' },
    ],
    scripts: [{ children: OLD_BROWSER_FILLS }],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-24">
      <h1 className="font-display text-4xl tracking-tight">
        That page is not here.
      </h1>
      <a className="mt-6 inline-flex text-sm text-muted" href="/">
        Back to DJ Piper P
      </a>
    </main>
  )
}
