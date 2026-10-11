"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import {
  LEAD_SOURCES,
  type CrmContactDTO,
  type CrmContactInput,
  type LeadStatus,
} from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { CustomFieldInput, MemberSelect, STATUS_OPTIONS, TagInput, fieldsForList, useListOptions } from "@/components/crm/common";
import { Button, Dropdown, Field, Input, Modal, useFeedback } from "@/components/crm/ui";

const EMPTY = {
  firstName: "",
  lastName: "",
  businessName: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  source: "",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
        {title}
        <span className="flex-1 h-px bg-slate-100 dark:bg-white/5" />
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

export function ContactFormModal({
  open,
  onClose,
  defaultListId = "",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  defaultListId?: string;
  onCreated?: (contact: CrmContactDTO) => void;
}) {
  const { fields, me, refreshLists } = useCrm();
  const listOptions = useListOptions();
  const { toast } = useFeedback();
  const [data, setData] = React.useState({ ...EMPTY });
  const [listId, setListId] = React.useState(defaultListId);
  const [status, setStatus] = React.useState<LeadStatus>("new");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [custom, setCustom] = React.useState<Record<string, unknown>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setData({ ...EMPTY });
    setListId(defaultListId);
    setStatus("new");
    setAssignedTo(me.scope === "assigned" ? me.username : "");
    setTags([]);
    setCustom({});
  }, [open, defaultListId, me]);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setData((d) => ({ ...d, [key]: e.target.value }));
  const listFields = fieldsForList(fields, listId);
  const canSave = Object.values(data).some((v) => v.trim());

  const save = async (addAnother: boolean) => {
    setSaving(true);
    try {
      const payload: CrmContactInput = { ...data, listId, status, assignedTo, tags, customFields: custom };
      const res = await crmApi.contacts.create(payload);
      toast("Lead added");
      onCreated?.(res.contact);
      refreshLists();
      if (addAnother) {
        setData({ ...EMPTY });
        setCustom({});
        setTags([]);
      } else {
        onClose();
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a new lead"
      description="Only fill what you have, you can complete the profile later."
      icon={UserPlus}
      size="lg"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="soft" disabled={!canSave} loading={saving} onClick={() => save(true)} className="hidden sm:inline-flex">
            Save & add another
          </Button>
          <Button size="sm" variant="primary" disabled={!canSave} loading={saving} onClick={() => save(false)}>
            Save lead
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) save(false);
        }}
      >
        <Section title="Contact">
          <Field label="First name">
            <Input value={data.firstName} onChange={set("firstName")} autoFocus />
          </Field>
          <Field label="Last name">
            <Input value={data.lastName} onChange={set("lastName")} />
          </Field>
          <Field label="Business name">
            <Input value={data.businessName} onChange={set("businessName")} placeholder="e.g. Swift Relief Housebuyers" />
          </Field>
          <Field label="Phone">
            <Input type="tel" value={data.phone} onChange={set("phone")} placeholder="+1 555 0100" />
          </Field>
          <Field label="Email">
            <Input type="email" value={data.email} onChange={set("email")} />
          </Field>
          <Field label="Website">
            <Input value={data.website} onChange={set("website")} placeholder="https://" />
          </Field>
        </Section>

        <Section title="Address">
          <Field label="Street address" className="sm:col-span-2">
            <Input value={data.address} onChange={set("address")} />
          </Field>
          <Field label="City">
            <Input value={data.city} onChange={set("city")} />
          </Field>
          <Field label="State / Province">
            <Input value={data.state} onChange={set("state")} />
          </Field>
          <Field label="Postal code">
            <Input value={data.postalCode} onChange={set("postalCode")} />
          </Field>
          <Field label="Country">
            <Input value={data.country} onChange={set("country")} />
          </Field>
        </Section>

        <Section title="Lead details">
          <Field label="Lead list">
            <Dropdown value={listId} onChange={setListId} options={listOptions} label="Lead list" />
          </Field>
          <Field label="Status">
            <Dropdown value={status} onChange={setStatus} options={STATUS_OPTIONS} label="Status" />
          </Field>
          <Field label="Source">
            <Input list="crm-lead-sources" value={data.source} onChange={set("source")} placeholder="e.g. Google Maps" />
            <datalist id="crm-lead-sources">
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Owner">
            <MemberSelect value={assignedTo} onChange={setAssignedTo} />
          </Field>
          <Field label="Tags" className="sm:col-span-2">
            <TagInput value={tags} onChange={setTags} />
          </Field>
        </Section>

        {listFields.length > 0 && (
          <Section title="Custom fields">
            {listFields.map((field) => (
              <Field key={field.id} label={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                <CustomFieldInput field={field} value={custom[field.id]} onChange={(v) => setCustom((c) => ({ ...c, [field.id]: v }))} />
              </Field>
            ))}
          </Section>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
