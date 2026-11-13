/**
 * One labelled row of pill buttons used to filter a list.
 *
 * `options` is `[{ value, label }]` and `value` is the selected one, with ""
 * meaning "no filter" — the same empty string the pages already turn into
 * `undefined` before calling the API. The active pill is *filled* rather than
 * only recoloured and carries aria-pressed, so the state survives a screen
 * with the colour taken away and still reaches assistive tech.
 */
const FilterChips = ({ label, options, value, onChange }) => (
  <div className="filter-row">
    <span className="filter-row-label">{label}</span>
    <div className="filter-chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value === "" ? "all" : option.value}
          type="button"
          className={`filter-pill${value === option.value ? " active" : ""}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

export default FilterChips;
