import Script from "next/script";
import "./globals.css";
export const metadata={title:"Jawad Dev Desk",description:"Full-stack production rescue and white-label engineering intake"};
export const viewport={width:"device-width",initialScale:1,viewportFit:"cover",colorScheme:"dark light"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive"/></body></html>}
