import { ContactDetail } from "@/components/crm/contacts/ContactDetail";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactDetail key={id} id={id} />;
}
