export type Operation = {
  type: "insert" | "delete";
  position: number;
  value?: string;
  length?: number;
  clientId: string;
  opId: string;
  version: number;
};
