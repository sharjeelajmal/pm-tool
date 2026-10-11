import { CrmGoogleAccount } from "@/models/crm/CrmGoogleAccount";
import type { CrmContactSummary, CrmGoogleStatus, GoogleBusyEvent } from "@/lib/crm/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Google Calendar sync over plain REST (no SDK). Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/crm/google/callback`;
}

export function buildGoogleAuthUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      ...body,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || `Google token request failed (${res.status})`);
  return data as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function connectGoogleAccount(username: string, code: string, origin: string) {
  const tokens = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: googleRedirectUri(origin),
  });
  const info = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
    .then((r) => r.json())
    .catch(() => ({}));

  const existing = await CrmGoogleAccount.findOne({ username });
  await CrmGoogleAccount.updateOne(
    { username },
    {
      $set: {
        email: info.email || "",
        accessToken: tokens.access_token,
        // Google only returns a refresh token on first consent; keep the old one otherwise.
        refreshToken: tokens.refresh_token || existing?.refreshToken || "",
        expiresAt: new Date(Date.now() + (tokens.expires_in - 60) * 1000),
        syncEnabled: true,
      },
    },
    { upsert: true }
  );
}

async function accessTokenFor(username: string): Promise<{ token: string; calendarId: string } | null> {
  const account = await CrmGoogleAccount.findOne({ username, syncEnabled: true });
  if (!account) return null;
  if (account.accessToken && account.expiresAt.getTime() > Date.now()) {
    return { token: account.accessToken, calendarId: account.calendarId || "primary" };
  }
  if (!account.refreshToken) return null;
  try {
    const tokens = await tokenRequest({ refresh_token: account.refreshToken, grant_type: "refresh_token" });
    account.accessToken = tokens.access_token;
    account.expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);
    await account.save();
    return { token: account.accessToken, calendarId: account.calendarId || "primary" };
  } catch (error) {
    // Revoked access: pause sync so we stop retrying, the user can reconnect from the calendar.
    console.error("Google token refresh failed:", error);
    account.syncEnabled = false;
    await account.save();
    return null;
  }
}

export async function getGoogleStatus(username: string): Promise<CrmGoogleStatus> {
  const account = await CrmGoogleAccount.findOne({ username }).lean<any>();
  return {
    configured: googleConfigured(),
    connected: !!account?.refreshToken,
    email: account?.email || "",
    syncEnabled: !!account?.syncEnabled,
  };
}

export async function setGoogleSync(username: string, enabled: boolean) {
  await CrmGoogleAccount.updateOne({ username }, { $set: { syncEnabled: enabled } });
}

export async function disconnectGoogle(username: string) {
  const account = await CrmGoogleAccount.findOne({ username });
  if (!account) return;
  const token = account.refreshToken || account.accessToken;
  if (token) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
  }
  await CrmGoogleAccount.deleteOne({ username });
}

async function calendarFetch(auth: { token: string }, path: string, init: RequestInit = {}) {
  return fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json", ...init.headers },
  });
}

interface SyncableAppointment {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: string;
  location: string;
  notes: string;
  assignedTo: string;
  createdBy: string;
  googleEventId: string;
  googleOwner: string;
}

function eventBody(appt: SyncableAppointment, contact: CrmContactSummary | null) {
  const lines = [
    contact?.businessName && `Business: ${contact.businessName}`,
    contact?.name && `Contact: ${contact.name}`,
    contact?.phone && `Phone: ${contact.phone}`,
    contact?.email && `Email: ${contact.email}`,
    contact?.address && `Address: ${contact.address}`,
    appt.notes && `\nNotes:\n${appt.notes}`,
    "\n— Booked from Leads CRM",
  ].filter(Boolean);
  return {
    summary: appt.title,
    description: lines.join("\n"),
    location: appt.location || contact?.address || "",
    start: { dateTime: appt.start.toISOString() },
    end: { dateTime: appt.end.toISOString() },
    extendedProperties: { private: { crmAppointmentId: appt.id } },
  };
}

export async function deleteGoogleEvent(owner: string, eventId: string) {
  if (!owner || !eventId) return;
  const auth = await accessTokenFor(owner);
  if (!auth) return;
  await calendarFetch(auth, `/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  }).catch(() => undefined);
}

// Pushes an appointment to its owner's linked Google Calendar. Returns the event reference to store.
export async function syncAppointmentToGoogle(
  appt: SyncableAppointment,
  contact: CrmContactSummary | null
): Promise<{ googleEventId: string; googleOwner: string }> {
  const owner = appt.assignedTo || appt.createdBy;

  // Owner changed: remove the event from the previous owner's calendar.
  if (appt.googleEventId && appt.googleOwner && appt.googleOwner !== owner) {
    await deleteGoogleEvent(appt.googleOwner, appt.googleEventId);
    appt = { ...appt, googleEventId: "", googleOwner: "" };
  }

  if (appt.status === "cancelled") {
    if (appt.googleEventId) await deleteGoogleEvent(appt.googleOwner || owner, appt.googleEventId);
    return { googleEventId: "", googleOwner: "" };
  }

  const auth = await accessTokenFor(owner);
  if (!auth) return { googleEventId: appt.googleEventId, googleOwner: appt.googleOwner };

  const calendarPath = `/calendars/${encodeURIComponent(auth.calendarId)}/events`;
  const body = JSON.stringify(eventBody(appt, contact));

  if (appt.googleEventId) {
    const res = await calendarFetch(auth, `${calendarPath}/${encodeURIComponent(appt.googleEventId)}`, {
      method: "PATCH",
      body,
    });
    if (res.ok) return { googleEventId: appt.googleEventId, googleOwner: owner };
    if (res.status !== 404 && res.status !== 410) {
      throw new Error(`Google Calendar update failed (${res.status})`);
    }
  }

  const res = await calendarFetch(auth, calendarPath, { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Google Calendar create failed (${res.status})`);
  return { googleEventId: data.id, googleOwner: owner };
}

// The user's own Google events in a range, shown as "Busy" blocks. CRM-created events are skipped.
export async function listGoogleBusy(username: string, from: Date, to: Date): Promise<GoogleBusyEvent[]> {
  const auth = await accessTokenFor(username);
  if (!auth) return [];
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await calendarFetch(auth, `/calendars/${encodeURIComponent(auth.calendarId)}/events?${params}`);
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({ items: [] }));
  return (data.items || [])
    .filter(
      (e: any) =>
        e.status !== "cancelled" && e.transparency !== "transparent" && !e.extendedProperties?.private?.crmAppointmentId
    )
    .map((e: any) => {
      const allDay = !e.start?.dateTime;
      return {
        id: e.id,
        title: e.summary || "Busy",
        start: allDay ? new Date(`${e.start.date}T00:00:00`).toISOString() : e.start.dateTime,
        end: allDay ? new Date(`${e.end.date}T00:00:00`).toISOString() : e.end.dateTime,
        allDay,
      };
    });
}
