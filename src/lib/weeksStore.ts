import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { WeekSchedule } from "@/data/schedule";
import { db } from "@/lib/firebase";
import { normalizeShortBookablePausesInWeek } from "@/lib/scheduleEdit";

export type WeekRow = {
  id: string;
  label: string;
  data: WeekSchedule;
  sort_order: number;
  created_at?: string;
  is_template?: boolean;
};

const COLLECTION_NAME = "weeks";

export const hasRemoteStore = Boolean(db);

function weeksCollection() {
  if (!db) {
    throw new Error("Firebase is not configured.");
  }
  return collection(db, COLLECTION_NAME);
}

export async function fetchWeeks(): Promise<WeekRow[]> {
  const snapshot = await getDocs(query(weeksCollection(), orderBy("sort_order", "asc")));
  return snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<WeekRow, "id"> & { created_at?: Timestamp };
    return {
      id: entry.id,
      label: data.label,
      data: normalizeShortBookablePausesInWeek(data.data),
      sort_order: data.sort_order,
      created_at: data.created_at ? data.created_at.toDate().toISOString() : undefined,
      is_template: data.is_template ?? false,
    };
  }).filter((entry) => !entry.is_template);
}

export async function createWeek(input: Omit<WeekRow, "id">): Promise<WeekRow> {
  const normalizedInput = {
    ...input,
    data: normalizeShortBookablePausesInWeek(input.data),
  };
  const payload = {
    ...normalizedInput,
    is_template: normalizedInput.is_template ?? false,
    created_at: serverTimestamp(),
  };
  const ref = await addDoc(weeksCollection(), payload);
  return { id: ref.id, ...normalizedInput };
}

export async function deleteWeek(id: string): Promise<void> {
  await deleteDoc(doc(weeksCollection(), id));
}

export async function updateWeekData(id: string, data: WeekSchedule): Promise<void> {
  await updateDoc(doc(weeksCollection(), id), { data: normalizeShortBookablePausesInWeek(data) });
}

export async function fetchStandardWeek(): Promise<WeekRow | null> {
  const snapshot = await getDocs(query(weeksCollection(), where("is_template", "==", true), limit(1)));
  const entry = snapshot.docs[0];
  if (!entry) return null;

  const data = entry.data() as Omit<WeekRow, "id"> & { created_at?: Timestamp };
  return {
    id: entry.id,
    label: data.label,
    data: normalizeShortBookablePausesInWeek(data.data),
    sort_order: data.sort_order,
    created_at: data.created_at ? data.created_at.toDate().toISOString() : undefined,
    is_template: true,
  };
}

export async function saveStandardWeek(input: Pick<WeekRow, "label" | "data" | "sort_order">): Promise<WeekRow> {
  const normalizedInput = {
    ...input,
    data: normalizeShortBookablePausesInWeek(input.data),
  };
  const existing = await fetchStandardWeek();
  if (existing) {
    await updateDoc(doc(weeksCollection(), existing.id), {
      label: normalizedInput.label,
      data: normalizedInput.data,
      sort_order: normalizedInput.sort_order,
      is_template: true,
    });
    return { ...existing, ...normalizedInput, is_template: true };
  }

  return createWeek({ ...normalizedInput, is_template: true });
}
