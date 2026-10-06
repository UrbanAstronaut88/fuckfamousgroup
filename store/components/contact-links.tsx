"use client";
import { useLanguage } from "./language";
import { managerLinks } from "../lib/links";
export function ContactLinks() {
  const { tr, t, language } = useLanguage();
  return (
    <div className="manager-links">
      {managerLinks.map((link) => (
        <a
          key={link.icon}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="manager-link"
          aria-label={`${t("Написати менеджеру в", "Contact our manager on")} ${link.name} ${t("(нова вкладка)", "(new tab)")}`}
        >
          <img src={`/icons/${link.icon}.svg`} alt="" width="20" height="20" />
          <span>{link.name}</span>
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}
