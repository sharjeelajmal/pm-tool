"use client";

import * as React from "react";
import { CalendarClock, CircleCheck, CircleX, Trash2 } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
  type CrmAppointmentDTO,
} from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { ContactPicker, MemberSelect, toDateInput, type PickedContact } from "@/components/crm/common";
import { LeadSnapshot } from "@/components/crm/calendar/LeadSnapshot";
import { APPOINTMENT_STATUS_COLOR } from "@/components/crm/theme";
import { Button, ChoiceChips, Dropdown, Field, Input, Modal, Textarea, cn, useFeedback } from "@/components/crm/ui";
import { DatePicker, TimePicker } from "@/components/crm/pickers";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

const pad = (n: number) => String(n).padStart(2, "0");
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function nextSlot() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

export function AppointmentModal({
  open,
  onClose,
  appointment,
  defaultContact,
  defaultStart,
  defaultDuration = 30,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  appointment?: CrmAppointmentDTO | null;
  defaultContact?: PickedContact | null;
  defaultStart?: Date | null;
  defaultDuration?: number;
  onSaved?: (appointment: CrmAppointmentDTO) => void;
  onDeleted?: (id: string) => void;
}) {
  const { me } = useCrm();
  const { toast, confirm } = useFeedback();
  const [contact, setContact] = React.useState<PickedContact | null>(null);
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [duration, setDuration] = React.useState(30);
  const [assignedTo, setAssignedTo] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [status, setStatus] = React.useState<AppointmentStatus>("booked");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const start = appointment ? new Date(appointment.start) : defaultStart || nextSlot();
    const end = appointment ? new Date(appointment.end) : new Date(start.getTime() + defaultDuration * 60000);
    setContact(
      appointment?.contact
        ? { id: appointment.contact.id, name: appointment.contact.name, businessName: appointment.contact.businessName, phone: appointment.contact.phone }
        : defaultContact || null
    );
    setTitle(appointment?.title || "");
    setDate(toDateInput(start));
    setTime(toTime(start));
    setDuration(Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)));
    setAssignedTo(appointment?.assignedTo ?? me.username);
    setLocation(appointment?.location || "");
    setStatus(appointment?.status || "booked");
    setNotes(appointment?.notes || "");
  }, [open, appointment, defaultContact, defaultStart, defaultDuration, me]);

  const startDate = React.useMemo(() => {
    if (!date || !time) return null;
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm);
  }, [date, time]);

  const save = async (overrideStatus?: AppointmentStatus) => {
    if (!startDate) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        contactId: contact?.id || "",
        start: startDate.toISOString(),
        end: new Date(startDate.getTime() + duration * 60000).toISOString(),
        assignedTo,
        location,
        status: overrideStatus || status,
        notes,
      };
      const res = appointment ? await crmApi.appointments.update(appointment.id, payload) : await crmApi.appointments.create(payload);
      if (res.warning) toast(res.warning, "error");
      else toast(appointment ? "Appointment updated" : "Appointment booked");
      onSaved?.(res.appointment);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!appointment) return;
    const ok = await confirm({
      title: "Delete this appointment?",
      message: "It will also be removed from the connected Google Calendar.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await crmApi.appointments.remove(appointment.id);
      toast("Appointment deleted");
      onDeleted?.(appointment.id);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const endLabel = startDate
    ? new Date(startDate.getTime() + duration * 60000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={appointment ? appointment.title || "Appointment" : "Book an appointment"}
      description={
        startDate
          ? `${startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${endLabel}`
          : undefined
      }
      icon={CalendarClock}
      size={contact ? "xl" : "lg"}
      footer={
        <>
          {appointment && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={remove} className="mr-auto text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
              Delete
            </Button>
          )}
          {appointment && status !== "showed" && (
            <Button size="sm" variant="soft" icon={CircleCheck} onClick={() => save("showed")} className="hidden sm:inline-flex">
              Mark showed
            </Button>
          )}
          {appointment && status !== "noshow" && (
            <Button size="sm" variant="ghost" icon={CircleX} onClick={() => save("noshow")} className="hidden sm:inline-flex">
              No show
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={saving} disabled={!startDate} onClick={() => save()}>
            {appointment ? "Save" : "Book appointment"}
          </Button>
        </>
      }
    >
      <div className={cn("grid gap-6", contact && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        <div className="flex flex-col gap-4 min-w-0">
          <Field label="Lead">
            <ContactPicker value={contact} onChange={setContact} />
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={contact ? `Meeting with ${contact.name}` : "e.g. Demo call"} />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Date">
              <DatePicker value={date} onChange={setDate} clearable={false} />
            </Field>
            <Field label="Start time">
              <TimePicker value={time} onChange={setTime} />
            </Field>
            <Field label="Duration" className="col-span-2 sm:col-span-1">
              <Dropdown
                value={String(duration)}
                onChange={(v) => setDuration(Number(v))}
                options={[...new Set([...DURATIONS, duration])]
                  .sort((a, b) => a - b)
                  .map((d) => ({ value: String(d), label: d < 60 ? `${d} min` : `${d / 60} hr${d > 60 ? "s" : ""}` }))}
                label="Duration"
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Assigned to">
              <MemberSelect value={assignedTo} onChange={setAssignedTo} allowEmpty={false} />
            </Field>
            <Field label="Location / meeting link">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address, phone or Zoom/Meet link" />
            </Field>
          </div>
          <Field label="Status">
            <ChoiceChips
              size="sm"
              value={status}
              onChange={setStatus}
              options={APPOINTMENT_STATUSES.map((s) => ({ value: s, label: APPOINTMENT_STATUS_LABELS[s], colorName: APPOINTMENT_STATUS_COLOR[s] }))}
            />
          </Field>
          <Field label="Meeting notes" hint="Agenda or what was discussed in this meeting">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Client asked to call back on 15 Oct at 4 PM about pricing" />
          </Field>
        </div>
        {contact && (
          <aside className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02] p-4 h-fit">
            <LeadSnapshot key={contact.id} contactId={contact.id} />
          </aside>
        )}
      </div>
    </Modal>
  );
}
