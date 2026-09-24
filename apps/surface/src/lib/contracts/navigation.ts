export type NavigationNode = { id: string; label: string; href?: string; children: NavigationNode[] };
export type NavigationMount = { namespace: string; name: string; source: string; projectRoot: string; status: string; publicPath?: string; pages?: Record<string, string> };
