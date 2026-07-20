declare module "get-windows" {
  export interface ActiveWindowResult {
    title: string;
    id: number;
    owner: { name: string; processId: number; path: string };
  }
  export function activeWindow(): Promise<ActiveWindowResult | undefined>;
}
