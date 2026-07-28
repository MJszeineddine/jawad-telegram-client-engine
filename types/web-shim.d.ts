declare namespace JSX { interface IntrinsicElements { [elementName: string]: any } }
declare namespace React { type ReactNode = any; interface FormEvent<T = Element> { currentTarget: T; preventDefault(): void } }
declare module "react" {
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useState<T>(initial: T): [T, (value: T) => void];
}
declare module "next" { export interface NextConfig { [key: string]: any } }
declare module "next/navigation" { export function redirect(url: string): never; export function notFound(): never; }
declare module "next/headers" {
  export function cookies(): Promise<{ get(name: string): { value: string } | undefined }>;
}
declare module "next/server" {
  export class NextResponse {
    cookies: { set(name: string, value: string, options?: any): void; delete(name: string): void };
    static json(body: unknown, init?: any): NextResponse;
    static redirect(url: URL, status?: number): NextResponse;
  }
}
declare module "next/script" { const Script: (props:any)=>any; export default Script; }
