import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import type { WeekSchedule } from "@/data/schedule";
import { db } from "@/lib/firebase";

export type WeekRow = {
  id: string;
  label: string;
  data: WeekSchedule;
  sort_order: number;
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
    const data = entry.data() as Omit<WeekRow, "id">;
    return {
      id: entry.id,
      label: data.label,
      data: data.data,
      sort_order: data.sort_order,
    };
  });
}

export async function createWeek(input: Omit<WeekRow, "id">): Promise<WeekRow> {
  const ref = await addDoc(weeksCollection(), input);
  return { id: ref.id, ...input };
}

export async function deleteWeek(id: string): Promise<void> {
  await deleteDoc(doc(weeksCollection(), id));
}

export async function updateWeekData(id: string, data: WeekSchedule): Promise<void> {
  await updateDoc(doc(weeksCollection(), id), { data });
}
