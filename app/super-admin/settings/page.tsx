import { requireSuperAdmin } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminTitle } from "@/components/admin/admin-title";
import { AcademyForm, AccessForm, FaqForm, FooterForm, HomeForm, SubscriptionSettingsForm } from "@/components/admin/settings-forms";
import { SystemStatus, type SystemSummary } from "@/components/admin/system-status";
import { poolSize, usesPooledDatabase } from "@/lib/db/prisma";
import { appUrl, env, isMailConfigured } from "@/lib/env";
import { emailVerificationRequired } from "@/lib/env-schema";
import { storageStatus } from "@/lib/storage";
import { parseS3Config } from "@/lib/storage/config";

/** Configuration summary for the Tizim tab — names, hosts and modes only, never keys or passwords. */
function systemSummary(): SystemSummary {
  const storage = storageStatus();
  const s3 = parseS3Config(process.env);
  const mailConfigured = isMailConfigured();
  return {
    siteUrl: appUrl(),
    database: { pooled: usesPooledDatabase(), poolMax: poolSize() },
    storage: {
      ...storage,
      bucket: s3.ok ? s3.config?.bucket : undefined,
      host: s3.ok && s3.config ? new URL(s3.config.endpoint).host : undefined,
    },
    mail: { configured: mailConfigured, verificationRequired: emailVerificationRequired(env(), mailConfigured), host: mailConfigured ? env().SMTP_HOST : undefined },
  };
}

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const [academy, home, faq, footer, subscription, access] = await Promise.all([
    getSetting("academy"),
    getSetting("home"),
    getSetting("faq"),
    getSetting("footer"),
    getSetting("subscription"),
    getSetting("access"),
  ]);
  return (
    <>
      <AdminTitle title="Sayt sozlamalari" description="Akademiya ma’lumotlari, bosh sahifa matnlari, FAQ, footer, obuna afzalliklari, kirish sozlamalari va tizim holati." />
      <Tabs defaultValue="academy">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList>
            <TabsTrigger value="academy">Akademiya</TabsTrigger>
            <TabsTrigger value="home">Bosh sahifa</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="footer">Footer</TabsTrigger>
            <TabsTrigger value="subscription">Obuna</TabsTrigger>
            <TabsTrigger value="access">Kirish</TabsTrigger>
            <TabsTrigger value="system">Tizim</TabsTrigger>
          </TabsList>
        </div>
        <div className="card-surface mt-6 p-6">
          <TabsContent value="academy" className="mt-0"><AcademyForm defaults={academy} /></TabsContent>
          <TabsContent value="home" className="mt-0"><HomeForm defaults={home} /></TabsContent>
          <TabsContent value="faq" className="mt-0"><FaqForm defaults={faq} /></TabsContent>
          <TabsContent value="footer" className="mt-0"><FooterForm defaults={footer} /></TabsContent>
          <TabsContent value="subscription" className="mt-0"><SubscriptionSettingsForm defaults={subscription} /></TabsContent>
          <TabsContent value="access" className="mt-0"><AccessForm defaults={access} /></TabsContent>
          <TabsContent value="system" className="mt-0"><SystemStatus summary={systemSummary()} /></TabsContent>
        </div>
      </Tabs>
    </>
  );
}
