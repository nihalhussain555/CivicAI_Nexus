import { Outlet } from "react-router-dom";

const PublicLayout = () => (
  <div className="landing">
    <Outlet />
  </div>
);

export default PublicLayout;
