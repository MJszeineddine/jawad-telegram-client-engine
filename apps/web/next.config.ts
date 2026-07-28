import type { NextConfig } from "next";

const sharedHeaders=[
  {key:"X-Content-Type-Options",value:"nosniff"},
  {key:"Referrer-Policy",value:"no-referrer"},
  {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"}
];
const baseCsp="default-src 'self'; connect-src 'self' https://api.telegram.org; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://telegram.org; object-src 'none'; base-uri 'self'; form-action 'self'";

const config: NextConfig={
  output:"standalone",
  poweredByHeader:false,
  transpilePackages:["@jawad/database","@jawad/domain","@jawad/qualification","@jawad/security","@jawad/telegram","@jawad/payments","@jawad/attachments"],
  experimental:{typedEnv:true},
  headers:async()=>[
    {source:"/:path*",headers:sharedHeaders},
    {source:"/",headers:[{key:"Content-Security-Policy",value:`${baseCsp}; frame-ancestors 'none'`},{key:"X-Frame-Options",value:"DENY"}]},
    {source:"/admin/:path*",headers:[{key:"Content-Security-Policy",value:`${baseCsp}; frame-ancestors 'none'`},{key:"X-Frame-Options",value:"DENY"}]},
    {source:"/mini-app/:path*",headers:[{key:"Content-Security-Policy",value:`${baseCsp}; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org`}]},
  ]
};
export default config;
