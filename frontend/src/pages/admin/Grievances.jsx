import { useEffect, useState } from "react";
import { Search, FileText } from "lucide-react";
import { getAllGrievances } from "../../services/grievanceService";
import { getDepartments } from "../../services/departmentService";
import { STATUSES, STATUS_LABELS, CATEGORIES, CATEGORY_LABELS, PRIORITIES } from "../../utils/constants";
import GrievanceCard from "../../components/grievances/GrievanceCard";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeleton";
import Pagination from "../../components/common/Pagination";

const Grievances = () => {
  const [filters, setFilters] = useState({ status: "", category: "", department: "", priority: "", search: "" });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);

  useEffect(() => { getDepartments().then((res) => setDepartments(res.data)); }, []);

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    getAllGrievances({ ...params, page, limit: 12 }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }, [filters, page]);

  const updateFilter = (key) => (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); };

  const submitSearch = (e) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: searchInput }));
    setPage(1);
  };

  return (
    <div>
      <div className="page-header"><div><h1>All Grievances</h1><p>Every grievance across every department.</p></div></div>

      <form onSubmit={submitSearch} className="card" style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", flex: "1 1 220px", gap: 6 }}>
          <input className="input" placeholder="Search title or description..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button type="submit" className="btn btn-secondary btn-sm"><Search size={14} /></button>
        </div>
        <select className="select" style={{ flex: "1 1 140px" }} value={filters.status} onChange={updateFilter("status")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select className="select" style={{ flex: "1 1 140px" }} value={filters.category} onChange={updateFilter("category")}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select className="select" style={{ flex: "1 1 160px" }} value={filters.department} onChange={updateFilter("department")}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.code} value={d.name}>{d.name}</option>)}
        </select>
        <select className="select" style={{ flex: "1 1 120px" }} value={filters.priority} onChange={updateFilter("priority")}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </form>

      {loading ? (
        <SkeletonList rows={6} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={FileText} title="No grievances found" description="Try adjusting your filters." />
      ) : (
        <>
          {data.items.map((g) => <GrievanceCard key={g.grievance_id} grievance={g} basePath="/admin/grievances" />)}
          <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default Grievances;
