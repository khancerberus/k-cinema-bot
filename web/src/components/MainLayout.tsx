import { Outlet } from "react-router"
import { NavBar } from "./NavBar";
import { Toaster } from "sonner"

export const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Toaster richColors theme="dark"/>
      <NavBar />
      <Outlet />
    </div>
  );
};
