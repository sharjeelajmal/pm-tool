import { randomUUID } from "crypto";
import { isValidObjectId } from "mongoose";
import { CrmContact } from "@/models/crm/CrmContact";

const MAX_ACTIVITY = 200;

export function activityEntry(type: string, text: string, by: string) {
  return { id: randomUUID(), type, text, by, at: new Date() };
}

// Update fragment that appends to a contact's timeline, keeping only the latest entries.
export function pushActivity(entries: ReturnType<typeof activityEntry>[]) {
  return { activity: { $each: entries, $slice: -MAX_ACTIVITY } };
}

export async function logContactActivity(contactId: string, type: string, text: string, by: string) {
  if (!contactId || !isValidObjectId(contactId)) return;
  await CrmContact.updateOne(
    { _id: contactId },
    { $push: pushActivity([activityEntry(type, text, by)]), $set: { lastActivityAt: new Date() } }
  );
}
