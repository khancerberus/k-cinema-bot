import { Outlet } from "react-router"
import { Toaster } from "sonner"

// La barra de navegación la pone ChannelLayout, porque depende del canal de la URL
export const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Toaster richColors theme="dark"/>
      <Outlet />
    </div>
  );
};
