import { Link, useLocation } from "react-router-dom";

function SiteNav() {
  const location = useLocation();
  const isEvents = location.pathname === "/deployment-events";

  return (
    <>
      <h1>Contract Registry</h1>
      <p className="subtitle">cross-chain deployment tracker</p>

      <div className="tabs">
        <Link className={!isEvents ? "tab active" : "tab"} to="/">
          Overview
        </Link>
        <Link className={isEvents ? "tab active" : "tab"} to="/deployment-events">
          History
        </Link>
      </div>
    </>
  );
}

export default SiteNav;