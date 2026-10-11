import { Suspense } from "react";
import { ContactsView } from "@/components/crm/contacts/ContactsView";

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsView />
    </Suspense>
  );
}
