import { Show, Switch, Match, splitProps, type ComponentProps } from "solid-js";

export type IconName = "panelLeft" | "panelLeftClose" | "house" | "dumbbell" | "history" | "x";

// Define props for the Icon component
// We want to accept any standard SVG element attributes
type IconProps = {
  name: IconName;
} & ComponentProps<"svg">; // Allows passing standard SVG props like class, width, height, etc.

// Individual SVG components (or direct JSX)
const PanelLeftIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M9 3v18"/>
  </svg>
);

const PanelLeftCloseIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M9 3v18"/>
    <path d="m16 15-3-3 3-3"/>
  </svg>
);

const HouseIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  </svg>
);

const DumbbellIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...props}>
    <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/>
    <path d="m2.5 21.5 1.4-1.4"/>
    <path d="m20.1 3.9 1.4-1.4"/>
    <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/>
    <path d="m9.6 14.4 4.8-4.8"/>
  </svg>
);

const HistoryIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history-icon lucide-history" {...props}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
);

const XIcon = (props: ComponentProps<"svg">) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x" {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

export const Icon = (props: IconProps) => {
  const [local, others] = splitProps(props, ["name", "class", "width", "height"]);
  
  const defaultWidth = local.width || "24";
  const defaultHeight = local.height || "24";
  const defaultClass = local.class || "lucide"; // Default class if none provided

  return (
    <Switch fallback={<Show when={import.meta.env.DEV}><p>Icon not found: {local.name}</p></Show>}>
      <Match when={local.name === "panelLeft"}>
        <PanelLeftIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "panelLeftClose"}>
        <PanelLeftCloseIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "house"}>
        <HouseIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "dumbbell"}>
        <DumbbellIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "history"}>
        <HistoryIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
      <Match when={local.name === "x"}>
        <XIcon width={defaultWidth} height={defaultHeight} class={defaultClass} {...others} />
      </Match>
    </Switch>
  );
};
