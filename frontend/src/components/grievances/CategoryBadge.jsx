import { CATEGORY_LABELS } from "../../utils/constants";

const CategoryBadge = ({ category }) => (
  <span className="badge badge-neutral">{CATEGORY_LABELS[category] || category}</span>
);

export default CategoryBadge;
