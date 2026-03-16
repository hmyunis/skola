import { apiFetch } from "./api";

export type OwnerExportDatasetId = "users" | "posts" | "resources" | "quizzes" | "analytics";

export interface OwnerExportDatasetSummary {
  id: OwnerExportDatasetId;
  label: string;
  description: string;
  recordCount: number;
  estimatedSizeBytes: number;
}

export interface OwnerExportResponse {
  fileName: string;
  generatedAt: string;
  classroom: { id: string; name: string };
  datasetIds: OwnerExportDatasetId[];
  datasets: Partial<Record<OwnerExportDatasetId, unknown>>;
}

export async function fetchOwnerExportDatasets(): Promise<OwnerExportDatasetSummary[]> {
  const data = await apiFetch("/admin/exports/datasets");
  if (!Array.isArray(data)) return [];

  const allowed = new Set<OwnerExportDatasetId>([
    "users",
    "posts",
    "resources",
    "quizzes",
    "analytics",
  ]);

  return data
    .map((item: any) => ({
      id: String(item?.id || "").trim().toLowerCase(),
      label: String(item?.label || "Unnamed Dataset"),
      description: String(item?.description || ""),
      recordCount: Number(item?.recordCount || 0),
      estimatedSizeBytes: Number(item?.estimatedSizeBytes || 0),
    }))
    .filter((item) => allowed.has(item.id as OwnerExportDatasetId))
    .map((item) => ({
      ...item,
      id: item.id as OwnerExportDatasetId,
    }));
}

export async function exportOwnerData(
  datasetIds: OwnerExportDatasetId[],
): Promise<OwnerExportResponse> {
  return apiFetch("/admin/exports", {
    method: "POST",
    body: JSON.stringify({ datasetIds }),
  });
}

export function downloadOwnerExport(payload: OwnerExportResponse) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.fileName || "owner-export.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
