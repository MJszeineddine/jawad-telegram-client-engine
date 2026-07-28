import { MiniAppShell } from "../../../components/MiniAppShell";
export default async function MiniAppSection({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return <MiniAppShell section={section}/>; }
