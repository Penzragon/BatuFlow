"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useDropzone } from "react-dropzone";
import { Download, Upload, Check, X, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import type { ImportValidationError } from "@/types";

const IMPORT_TYPES = [
  { value: "products", label: "Products" },
  { value: "customers", label: "Customers" },
  { value: "accounts", label: "Accounts" },
  { value: "employees", label: "Employees" },
] as const;

type ImportTypeValue = (typeof IMPORT_TYPES)[number]["value"];

/** Column config per import type for validation table display */
const DISPLAY_COLUMNS: Record<ImportTypeValue, string[]> = {
  products: ["SKU", "Name", "UOM", "Sell Price", "Category", "Brand", "Capital Cost", "Min Stock"],
  customers: ["Name", "Phone", "Address", "Tax ID", "Payment Terms (days)", "Salesperson ID", "GPS Lat", "GPS Lng"],
  accounts: ["Code", "Name", "Type"],
  employees: ["Name", "NIK", "Department", "Position"],
};

interface ImportHistoryItem {
  id: string;
  importType: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  importedAt: string;
  user: { name: string; email: string };
}

type RowError = { field: string; message: string };

/**
 * Groups validation errors by row number for easy lookup.
 * @param errors - Array of validation errors
 * @returns Map of row number to array of { field, message }
 */
function groupErrorsByRow(errors: ImportValidationError[]): Map<number, RowError[]> {
  const map = new Map<number, RowError[]>();
  for (const e of errors) {
    const list = map.get(e.row) ?? [];
    list.push({ field: e.field, message: e.message });
    map.set(e.row, list);
  }
  return map;
}

/**
 * Fetches import history from the API.
 */
async function fetchImportHistory(): Promise<ImportHistoryItem[]> {
  const res = await fetch("/api/import/history");
  const json = await res.json();
  if (!json.success) return [];
  return json.data ?? [];
}

/**
 * Client component for the Data Import wizard.
 * Step 1: Select type -> Step 2: Download template + Upload -> Step 3: Validation results -> Step 4: Confirm import.
 */
export function ImportPageClient() {
  const t = useTranslations("import");
  const tCommon = useTranslations("common");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importType, setImportType] = useState<ImportTypeValue | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    validRows: Record<string, unknown>[];
    errors: ImportValidationError[];
    totalRows: number;
    rows: Record<string, unknown>[];
  } | null>(null);
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /**
   * Downloads the Excel template for the current import type.
   */
  const handleDownloadTemplate = useCallback(() => {
    if (!importType) return;
    window.location.href = `/api/import/template?type=${importType}`;
  }, [importType]);

  /**
   * Validates the uploaded file via the API.
   */
  const handleValidate = useCallback(async () => {
    if (!file || !importType) return;
    setValidating(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", importType);
      const res = await fetch("/api/import/validate", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Validation failed");
        return;
      }
      setValidationResult({
        validRows: json.data.validRows ?? [],
        errors: json.data.errors ?? [],
        totalRows: json.data.totalRows ?? 0,
        rows: json.data.rows ?? [],
      });
      setStep(3);
    } catch {
      toast.error("Failed to validate file");
    } finally {
      setValidating(false);
    }
  }, [file, importType]);

  /**
   * Executes the import with valid rows only.
   */
  const handleExecuteImport = useCallback(async () => {
    if (!validationResult || validationResult.validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: importType,
          validRows: validationResult.validRows,
          fileName: file?.name ?? "upload.xlsx",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Import failed");
        return;
      }
      toast.success(
        t("importSuccess") + ` ${json.data?.successRows ?? 0} rows imported`
      );
      setValidationResult(null);
      setFile(null);
      setStep(1);
      setImportType("");
      setHistoryLoading(true);
      const logs = await fetchImportHistory();
      setHistory(logs);
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
      setHistoryLoading(false);
    }
  }, [validationResult, importType, file?.name, t]);

  /**
   * Loads import history on mount.
   */
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const logs = await fetchImportHistory();
      setHistory(logs);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /**
   * Dropzone callback for file acceptance.
   */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (f) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext !== "xlsx" && ext !== "xls") {
        toast.error("Please upload an Excel file (.xlsx or .xls)");
        return;
      }
      setFile(f);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: !importType || validating,
  });

  /**
   * Resets the wizard to step 1.
   */
  const handleReset = useCallback(() => {
    setStep(1);
    setFile(null);
    setValidationResult(null);
  }, []);

  const columns = importType ? DISPLAY_COLUMNS[importType as ImportTypeValue] ?? [] : [];
  const errorsByRow = validationResult
    ? groupErrorsByRow(validationResult.errors)
    : new Map();

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description="Import Products, Customers, Chart of Accounts, or Employees from Excel. Max 5,000 rows per upload."
      />

      {/* Step 1: Select type */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: {t("selectType")}</CardTitle>
          <CardDescription>
            Choose the type of data you want to import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {IMPORT_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setImportType(opt.value);
                  setStep(2);
                  setFile(null);
                  setValidationResult(null);
                }}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                  importType === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Download template + Upload */}
      {importType && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: {t("downloadTemplate")} & {t("uploadFile")}</CardTitle>
            <CardDescription>
              Download the template, fill in your data, then upload the file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={validating}
              >
                <Download className="mr-2 h-4 w-4" />
                {t("downloadTemplate")}
              </Button>
              <Select
                value={importType}
                onValueChange={(v) => setImportType(v as ImportTypeValue)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_TYPES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              {...getRootProps()}
              className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
                isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                {isDragActive
                  ? "Drop the file here..."
                  : "Drag & drop an Excel file here, or click to select"}
              </p>
              {file && (
                <p className="text-sm font-medium text-foreground">{file.name}</p>
              )}
            </div>
            <Button
              onClick={handleValidate}
              disabled={!file || validating}
            >
              {validating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tCommon("loading")}
                </>
              ) : (
                t("validate")
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Validation results */}
      {validationResult && step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Validation Results</CardTitle>
            <CardDescription>
              {validationResult.validRows.length} {t("validRows")}, {validationResult.errors.length} {t("errorRows")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead className="w-12">Row</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col}>{col}</TableHead>
                    ))}
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResult.rows.map((row, idx) => {
                    const rowNum = idx + 2;
                    const rowErrors = errorsByRow.get(rowNum) ?? [];
                    const isValid = rowErrors.length === 0;
                    return (
                      <TableRow
                        key={idx}
                        className={isValid ? "bg-green-50/50" : "bg-red-50/50"}
                      >
                        <TableCell>
                          {isValid ? (
                            <Check className="h-5 w-5 text-green-600" />
                          ) : (
                            <X className="h-5 w-5 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {rowNum}
                        </TableCell>
                        {columns.map((col) => {
                          const err = rowErrors.find((e: RowError) => e.field === col);
                          return (
                            <TableCell
                              key={col}
                              className={err ? "text-red-600" : ""}
                              title={err?.message}
                            >
                              {String(row[col] ?? "")}
                              {err && (
                                <span className="ml-1 text-xs text-red-600" title={err.message}>
                                  ({err.message})
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          {rowErrors.length > 0 ? (
                            <ul className="list-inside list-disc text-xs text-red-600">
                              {rowErrors.map((e: RowError, i: number) => (
                                <li key={i}>
                                  {e.field}: {e.message}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleExecuteImport}
                disabled={validationResult.validRows.length === 0 || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tCommon("loading")}
                  </>
                ) : (
                  t("importData")
                )}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                {tCommon("back")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import history */}
      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>
            Recent imports with date, type, rows imported, and user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-muted-foreground">{tCommon("loading")}...</p>
          ) : history.length === 0 ? (
            <p className="text-muted-foreground">{tCommon("noData")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Success</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.importedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="capitalize">{log.importType}</TableCell>
                    <TableCell>{log.fileName}</TableCell>
                    <TableCell>{log.totalRows}</TableCell>
                    <TableCell className="text-green-600">{log.successRows}</TableCell>
                    <TableCell className="text-red-600">{log.errorRows}</TableCell>
                    <TableCell>{log.user?.name ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
