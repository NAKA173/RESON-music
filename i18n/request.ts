import { getRequestConfig } from "next-intl/server";
import jaMessages from "@/messages/ja.json";
import { defaultLocale } from "./routing";

// Phase 1 keeps the existing Japanese URL structure and rendering behavior intact.
// Locale-aware URL routing will be enabled in a follow-up change once static preview
// and authentication routing are migrated together.
export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: jaMessages,
}));
