// Entity-agnostic shapes shared by every import-row validator (Customer,
// Job, ...). The concrete validators live in validate-<entity>-rows.ts.

export interface RowError {
  field: string;
  message: string;
}

export interface ValidatedRow {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, string>;
  valid: boolean;
  errors: RowError[];
}

export interface ValidationResult {
  rows: ValidatedRow[];
  validCount: number;
  invalidCount: number;
}
