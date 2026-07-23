<script setup lang="ts">
  import { useI18n } from "vue-i18n";
  import { type QueryValue, route } from "../../lib/api/base/urls";
  import PageQRCode from "./PageQRCode.vue";
  import { DialogID } from "@/components/ui/dialog-provider/utils";
  import { toast } from "@/components/ui/sonner";
  import MdiLoading from "~icons/mdi/loading";
  import MdiPrinterPos from "~icons/mdi/printer-pos";
  import MdiFileDownload from "~icons/mdi/file-download";

  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
  import { useDialog } from "@/components/ui/dialog-provider";
  import { Button, ButtonGroup } from "@/components/ui/button";
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import FormTextField from "~/components/Form/TextField.vue";

  const { t } = useI18n();
  const { openDialog, closeDialog } = useDialog();

  const props = defineProps<{
    type: string;
    id: string;
  }>();

  const pubApi = usePublicApi();

  const { data: status } = useAsyncData(async () => {
    const { data, error } = await pubApi.status();
    if (error) {
      toast.error(t("components.global.label_maker.toast.load_status_failed"));
      return;
    }

    return data;
  });

  const serverPrinting = ref(false);
  const shortcutName = ref("");
  const selectedLabelPosition = ref(1);
  const usesAverySheet = computed(() => props.type === "item" || props.type === "entity");

  const AVERY_5260_LABEL_COUNT = 30;

  function printAvery5260Sheet(printWindow: Window, labelUrl: string) {
    const doc = printWindow.document;
    doc.title = `label-${props.id}`;

    const style = doc.createElement("style");
    style.textContent = `
      @page { size: Letter portrait; margin: 0; }
      html, body { margin: 0; width: 8.5in; height: 11in; }
      .sheet {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(3, 2.625in);
        grid-template-rows: repeat(10, 1in);
        column-gap: 0.125in;
        width: 8.5in;
        height: 11in;
        padding: 0.5in 0.1875in;
      }
      .label { width: 2.625in; height: 1in; overflow: hidden; }
      .label img { display: block; width: 100%; height: 100%; object-fit: contain; }
    `;
    doc.head.appendChild(style);

    const sheet = doc.createElement("main");
    sheet.className = "sheet";

    for (let position = 1; position <= AVERY_5260_LABEL_COUNT; position++) {
      const cell = doc.createElement("div");
      cell.className = "label";

      if (position === selectedLabelPosition.value) {
        const image = doc.createElement("img");
        image.alt = "";
        image.addEventListener("load", () => {
          printWindow.focus();
          printWindow.print();
        });
        image.src = labelUrl;
        cell.appendChild(image);
      }

      sheet.appendChild(cell);
    }

    doc.body.appendChild(sheet);
  }

  function browserPrint() {
    const labelUrl = getLabelUrl(false);

    if (!usesAverySheet.value) {
      const printWindow = window.open(labelUrl, "_blank", "popup");
      if (printWindow !== null) {
        printWindow.onload = () => printWindow.print();
      }
      return;
    }

    const printWindow = window.open("", "_blank", "popup=true");

    if (printWindow !== null) {
      printAvery5260Sheet(printWindow, labelUrl);
    }
  }

  async function serverPrint() {
    serverPrinting.value = true;
    try {
      await fetch(getLabelUrl(true));
    } catch (err) {
      console.error("Failed to print labels:", err);
      serverPrinting.value = false;
      toast.error(t("components.global.label_maker.toast.print_failed"));
      return;
    }

    toast.success(t("components.global.label_maker.toast.print_success"));
    closeDialog(DialogID.PrintLabel);
    serverPrinting.value = false;
  }

  function downloadLabel() {
    const link = document.createElement("a");
    link.download = `label-${props.id}.png`;
    link.href = getLabelUrl(false);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getLabelUrl(print: boolean): string {
    const { selectedId } = useCollections();
    const params: Record<string, QueryValue> = {
      print,
      url: window.location.href,
      shortcutName: shortcutName.value,
    };

    if (selectedId.value) {
      params.tenant = selectedId.value;
    }

    if (props.type === "item" || props.type === "entity") {
      return route(`/labelmaker/entity/${props.id}`, params);
    } else if (props.type === "location") {
      return route(`/labelmaker/location/${props.id}`, params);
    } else if (props.type === "asset") {
      return route(`/labelmaker/asset/${props.id}`, params);
    } else {
      throw new Error(`Unexpected labelmaker type ${props.type}`);
    }
  }
</script>

<template>
  <div>
    <Dialog :dialog-id="DialogID.PrintLabel">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {{ $t("components.global.label_maker.print") }}
          </DialogTitle>
          <DialogDescription>
            {{ $t("components.global.label_maker.confirm_description") }}
          </DialogDescription>
        </DialogHeader>
        <img class="max-h-40 object-contain" :src="getLabelUrl(false)" />
        <FormTextField
          v-model="shortcutName"
          :label="$t('components.global.label_maker.shortcut_name')"
          :placeholder="$t('components.global.label_maker.shortcut_name_placeholder')"
          :max-length="255"
        />
        <div v-if="usesAverySheet">
          <p class="mb-2 text-sm font-medium">
            {{ $t("reports.label_generator.skip_first_labels") }}: {{ selectedLabelPosition - 1 }}
          </p>
          <div class="grid grid-cols-3 gap-1" role="grid">
            <Button
              v-for="position in AVERY_5260_LABEL_COUNT"
              :key="position"
              type="button"
              size="sm"
              :variant="selectedLabelPosition === position ? 'default' : 'outline'"
              :aria-label="`${$t('reports.label_generator.skip_first_labels')}: ${position - 1}`"
              @click="selectedLabelPosition = position"
            >
              {{ position }}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <ButtonGroup>
            <Button v-if="status?.labelPrinting || false" type="submit" :disabled="serverPrinting" @click="serverPrint">
              <MdiLoading v-if="serverPrinting" class="animate-spin" />
              {{ $t("components.global.label_maker.server_print") }}
            </Button>
            <Button type="submit" @click="browserPrint">
              {{ $t("components.global.label_maker.browser_print") }}
            </Button>
          </ButtonGroup>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <TooltipProvider :delay-duration="0">
      <ButtonGroup>
        <Button variant="outline" disabled class="disabled:opacity-100">
          {{ $t("components.global.label_maker.titles") }}
        </Button>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon" @click="downloadLabel">
              <MdiFileDownload name="mdi-file-download" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ $t("components.global.label_maker.download") }}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon" @click="openDialog(DialogID.PrintLabel)">
              <MdiPrinterPos name="mdi-printer-pos" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ $t("components.global.label_maker.browser_print") }}
          </TooltipContent>
        </Tooltip>

        <PageQRCode />
      </ButtonGroup>
    </TooltipProvider>
  </div>
</template>
