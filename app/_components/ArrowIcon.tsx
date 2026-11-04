// components/ArrowIcon.tsx
export default function ArrowIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg 
      width="14" 
      height="14" 
      viewBox="0 0 14 14" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M13.0967 11.7598H10.0117V5.25586L2.18066 13.0869L0 10.9062L7.82129 3.08496H1.33691V0H13.0967V11.7598Z" fill="#191919"/>
    </svg>
  );
}