import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { WeekSchedule } from "@/data/schedule";
import { db } from "@/lib/firebase";

export type WeekRow = {
  id: string;
  label: string;
  data: WeekSchedule;
  sort_order: number;
  created_at?: string;
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
      data: data.data,
      sort_order: data.sort_order,
      created_at: data.created_at ? data.created_at.toDate().toISOString() : undefined,
    };
  });
}

export async function createWeek(input: Omit<WeekRow, "id">): Promise<WeekRow> {
  const payload = {
    ...input,
    created_at: serverTimestamp(),
  };
  const ref = await addDoc(weeksCollection(), payload);
  return { id: ref.id, ...input };
}

export async function deleteWeek(id: string): Promise<void> {
  await deleteDoc(doc(weeksCollection(), id));
}

export async function updateWeekData(id: string, data: WeekSchedule): Promise<void> {
  await updateDoc(doc(weeksCollection(), id), { data });
}
