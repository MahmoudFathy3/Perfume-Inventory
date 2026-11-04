import { ShieldCheck, Store, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, PageHeader } from "@/shared/components/ui";
import { useAppName } from "@/shared/hooks/useAppName";
import { SecuritySettings } from "../../auth";
import { BackupPanel } from "../../backup";
import { AboutCard } from "../components/AboutCard";
import { AppNameForm } from "../components/AppNameForm";
import { DatabasePathPicker } from "../components/DatabasePathPicker";
import { LanguageSelect } from "../components/LanguageSelect";
import { SettingsSection } from "../components/SettingsSection";
import { ShopInfoForm } from "../components/ShopInfoForm";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { name: appName } = useAppName();
  return (
    <>
      <PageHeader title={t("settings.title")} />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <LanguageSelect />
          <DatabasePathPicker />
        </Card>
        <SettingsSection
          icon={Type}
          title={t("settings.appNameTitle")}
          description={t("settings.appNameDesc", { name: appName })}
        >
          {(close) => <AppNameForm onSaved={close} />}
        </SettingsSection>
        <SettingsSection
          icon={Store}
          title={t("settings.shopTitle")}
          description={t("settings.shopDesc")}
        >
          {(close) => <ShopInfoForm onSaved={close} />}
        </SettingsSection>
        <SettingsSection
          icon={ShieldCheck}
          title={t("auth.securityTitle")}
          description={t("auth.securityDesc")}
        >
          {() => <SecuritySettings />}
        </SettingsSection>
        <div className="lg:col-span-2">
          <BackupPanel />
        </div>
        <AboutCard />
      </div>
    </>
  );
}
