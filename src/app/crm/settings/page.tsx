import { Suspense } from "react";
import { SettingsView } from "@/components/crm/settings/SettingsView";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
