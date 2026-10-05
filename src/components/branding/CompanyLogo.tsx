import type { Company } from "../../types";

type CompanyLogoProps = {
  company: Pick<Company, "name" | "logo">;
  size?: number;
  className?: string;
};

export default function CompanyLogo({
  company,
  size = 48,
  className = "",
}: CompanyLogoProps) {
  const initials =
    company.name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "JT";

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f1f5f9",
        flexShrink: 0,
      }}
    >
      {company.logo ? (
        <img
          src={company.logo}
          alt={`${company.name} logo`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <span
          style={{
            fontSize: size * 0.35,
            fontWeight: 700,
            color: "#334155",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}