export type Operation = {
  type: "insert" | "delete";
  position: number;
  value?: string;
  length?: number;
  clientId: string;
  version: number;
};
