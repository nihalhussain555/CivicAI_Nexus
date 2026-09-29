import { Outlet } from "react-router-dom";

const PublicLayout = () => (
  <div className="landing">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <div id="main-content">
      <Outlet />
    </div>
  </div>
);

export default PublicLayout;