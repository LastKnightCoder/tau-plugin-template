/* eslint-disable react-refresh/only-export-components -- 插件入口默认导出插件定义。 */
import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  definePlugin,
  useI18n,
  type PluginPageProps,
  type PluginSettingsProps,
} from "@tau/plugins";
import { Button, Dialog, DialogBody } from "@tau/ui";
import "./styles.css";
import { messages } from "./i18n";
import { CounterIcon } from "./CounterIcon";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

function Counter({ context }: PluginSettingsProps) {
  const { t } = useI18n(messages);
  const client = useQueryClient();
  const key = [context.pluginId, "count"];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const value = await context.storage.get("count");
      if (value !== undefined && typeof value !== "number") throw new Error("计数数据格式无效");
      return value ?? 0;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const next = (query.data ?? 0) + 1;
      await context.storage.set("count", next);
      return next;
    },
    onSuccess: value => {
      if (!context.signal.aborted) client.setQueryData(key, value);
    },
  });
  const [help, setHelp] = useState(false);
  return (
    <div className="example-counter">
      <p role="status">{query.isPending ? t("loading") : t("count", { count: query.data ?? 0 })}</p>
      <Button
        disabled={query.isPending || query.isError || save.isPending}
        onClick={() => save.mutate()}
      >
        {t("increment")}
      </Button>
      <Button variant="ghost" onClick={() => setHelp(true)}>
        {t("help")}
      </Button>
      {(query.error || save.error) && (
        <p role="alert">{query.error?.message ?? save.error?.message}</p>
      )}
      {query.isError && <Button onClick={() => void query.refetch()}>{t("retry")}</Button>}
      <Dialog open={help} onOpenChange={setHelp} title={t("helpTitle")}>
        <DialogBody>{t("helpBody")}</DialogBody>
      </Dialog>
    </div>
  );
}

function Settings(props: PluginSettingsProps) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={client}>
      <Counter {...props} />
    </QueryClientProvider>
  );
}

function Page({ context }: PluginPageProps) {
  const { t } = useI18n(messages);
  return (
    <section>
      <h1>{t("title")}</h1>
      <Settings context={context} />
    </section>
  );
}

export default definePlugin({
  ...__PLUGIN_META__,
  i18n: messages,
  create: () => ({
    activate(context) {
      const page = context.pages.register({
        id: "counter",
        title: messages.ref("title"),
        component: Page,
      });
      context.navigation.registerEntry({
        id: "counter",
        title: messages.ref("title"),
        icon: CounterIcon,
        page,
      });
      context.settings.register({
        id: "preferences",
        title: messages.ref("settings"),
        component: Settings,
      });
      context.commands.register({
        id: "open",
        title: messages.ref("open"),
        run: async () => {
          await page.open();
          return null;
        },
      });
    },
  }),
});
