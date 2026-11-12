export default function Calendar({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path
        d="M15.0013 18.3327V11.666M18.3346 14.9993H11.668"
        stroke={style?.color || "#D3F4FA"}
        strokeWidth={style?.strokeWidth || 1}
        fill={style?.fill || "none"}
      />
      <path
        d="M9.9987 16.6667H3.33203V9.16667M3.33203 9.16667V5H6.66536M3.33203 9.16667H16.6654V5H13.332M6.66536 2.5V5M6.66536 5H13.332M13.332 2.5V5"
        stroke={style?.color || "#D3F4FA"}
        strokeWidth={style?.strokeWidth || 1.5}
      />
    </svg>
  );
}
