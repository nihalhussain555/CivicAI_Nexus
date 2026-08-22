const Skeleton = ({ width = "100%", height = 16, radius = 8, style = {} }) => (
  <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />
);

export const SkeletonList = ({ rows = 4 }) => (
  <div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="list-row">
        <div style={{ flex: 1 }}>
          <Skeleton width="40%" height={14} style={{ marginBottom: 8 }} />
          <Skeleton width="70%" height={12} />
        </div>
        <Skeleton width={70} height={24} radius={999} />
      </div>
    ))}
  </div>
);

export default Skeleton;
