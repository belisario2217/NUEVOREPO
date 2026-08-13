import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { publicFileUrl } from "../lib/api";

export const DEFAULT_INSTITUTION_LOGO = `${import.meta.env.BASE_URL}assets/campus-frontera.jpg`;

export function institutionLogoUrl(logoPath?: string | null) {
  if (!logoPath || logoPath === "/assets/campus-frontera.jpg") return DEFAULT_INSTITUTION_LOGO;
  return publicFileUrl(logoPath);
}

type InstitutionLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  logoPath?: string | null;
};

export function InstitutionLogo({ logoPath, alt = "Logo de Campus Frontera", ...props }: InstitutionLogoProps) {
  const requested = institutionLogoUrl(logoPath);
  const [source, setSource] = useState(requested);

  useEffect(() => setSource(requested), [requested]);

  return (
    <img
      {...props}
      src={source}
      alt={alt}
      onError={() => {
        if (source !== DEFAULT_INSTITUTION_LOGO) setSource(DEFAULT_INSTITUTION_LOGO);
      }}
    />
  );
}

