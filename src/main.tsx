import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  useLocation,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { render } from 'solid-js/web'
import { For, children as resolveChildren, Show, createMemo } from 'solid-js'
import { Transition } from 'solid-transition-group'
import { Icon, type IconName } from './components/ui/icon'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import SkeuIcongenPage from './routes/SkeuIcongenPage'

import './styles.css'


import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from './components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from "./components/ui/tooltip"



const navRoutes: { path: string; name: string; iconName: IconName }[] = [
  { path: '/', name: 'Home', iconName: 'house' },
];

function AppSidebar() {
  const { setOpenMobile, isMobile, state } = useSidebar();
  const location = useLocation();
  
  const currentPath = () => location().pathname;

  const handleLinkClick = () => {
    if (isMobile()) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <For each={navRoutes}>
                {(route) => {
                  // Use createMemo for reactive route matching
                  const isActive = createMemo(() => {
                    return currentPath() === route.path;
                  });
                  
                  const linkChildren = resolveChildren(() => (
                    <div class="flex items-center gap-2 relative w-full">
                      <Icon name={route.iconName} class="h-5 w-5 absolute transition-all duration-200" classList={{
                        "left-0": state() === "expanded",
                        "-left-0.5": state() === "collapsed"
                      }} />
                      <span class="transition-all duration-200 pl-7 transform-gpu" classList={{ 
                        "opacity-0 blur-md pointer-events-none absolute text-2xl": state() === "collapsed",
                        "opacity-100 blur-0": state() === "expanded"
                      }}>
                        {route.name}
                      </span>
                    </div>
                  ));

                  return (
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        as={Link} 
                        to={route.path} 
                        preload="intent"
                        class="w-full text-left"
                        onClick={handleLinkClick}
                        tooltip={route.name}
                        isActive={isActive()}
                      >
                        {linkChildren()} 
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }}
              </For>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

const rootRoute = createRootRoute({
  component: () => {
    const location = useLocation();

    return (
      <SidebarProvider>
        <AppSidebar />
        <main class="flex flex-col flex-grow h-screen overflow-hidden p-2 transition-all duration-150 ease-in data-[sidebar-open=true]:md:ml-[var(--sidebar-width)] min-w-0">
          <div class="flex-shrink-0 p-1.5 border border-gray-200 backdrop-blur-sm rounded-lg">
            <Tooltip openDelay={500}>
              <TooltipTrigger>
                <SidebarTrigger />
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Sidebar</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div class="flex-grow overflow-y-auto py-4 relative">
            <Transition
              mode="outin"
              onEnter={(el, done) => {
                const animation = el.animate(
                  [
                    { opacity: 0, transform: 'translateY(10px)' },
                    { opacity: 1, transform: 'translateY(0px)' }
                  ],
                  { duration: 200, easing: 'ease-in-out' }
                );
                animation.finished.then(done);
              }}
              onExit={(el, done) => {
                const animation = el.animate(
                  [
                    { opacity: 1 },
                    { opacity: 0 }
                  ],
                  { duration: 200, easing: 'ease-in-out' }
                );
                animation.finished.then(done);
              }}
            >
              <Show when={location().pathname} keyed>
                {(_pathname) => ( 
                  <div class="page-container">
                    <Outlet />
                  </div>
                )}
              </Show>
            </Transition>
          </div>
          <TanStackRouterDevtools position="bottom-right" />
        </main>
      </SidebarProvider>
    );
  },
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SkeuIcongenPage,
})



const routeTree = rootRoute.addChildren([indexRoute])

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

// Create a new QueryClient instance
const queryClient = new QueryClient();

function MainApp() {
  return (
    // Wrap RouterProvider with QueryClientProvider
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const rootElement = document.getElementById('app')
if (rootElement) {
  render(() => <MainApp />, rootElement)
}
