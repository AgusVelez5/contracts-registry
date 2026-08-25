import { useState } from "react";
import DeploymentEventsView from "../components/contracts/DeploymentEventsView";
import SiteNav from "../components/SiteNav";

function DeploymentEventsPage() {
  const [filter, setFilter] = useState("");

  return (
    <div>
      <SiteNav />
      <input
        placeholder="Filter by contract name..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="filter-input"
      />
      <DeploymentEventsView filter={filter} />
    </div>
  );
}

export default DeploymentEventsPage;