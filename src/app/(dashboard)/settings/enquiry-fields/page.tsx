import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { can } from "@/lib/permissions/capabilities";
import { getEnquiryFieldConfigMap } from "@/lib/enquiries/field-config";
import { EnquiryFieldConfigManager } from "./_components/EnquiryFieldConfigManager";

export default async function EnquiryFieldConfigSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "enquiryFieldConfig", "edit")) redirect("/settings");

  const initialConfig = await getEnquiryFieldConfigMap();

  return <EnquiryFieldConfigManager initialConfig={initialConfig} />;
}
