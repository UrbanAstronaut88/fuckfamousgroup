"use client";
import { useLanguage } from "./language";
import { socialLinks, musicLinks } from "../lib/links";
export function CommunityFooter() {
  const { tr, t, language } = useLanguage();
  return (
    <footer
      className="community-columns"
      aria-label={tr("Соцмережі та музика гурту")}
    >
      {[
        { title: tr("Соцмережі"), links: socialLinks },
        { title: tr("Музичні платформи"), links: musicLinks },
      ].map((column) => (
        <section key={column.title}>
          <h2>{column.title}</h2>
          <ul className="service-links">
            {column.links.map((link) => (
              <li key={link.icon}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${link.name} — FCK FAMOUS GROUP ${t("(нова вкладка)", "(new tab)")}`}
                >
                  <img
                    src={`/icons/${link.icon}.svg`}
                    alt=""
                    width="19"
                    height="19"
                  />
                  <span>{link.name}</span>
                  <span className="external-arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="partners-column">
        <h2>{tr("Наші партнери")}</h2>
        <ul className="service-links">
          <li>
            <a
              href="https://www.instagram.com/nord.division.music/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`NordDivision — Instagram ${t("(нова вкладка)", "(new tab)")}`}
            >
              <img src="/icons/instagram.svg" alt="" width="19" height="19" />
              <span>Nord Division</span>
              <span className="external-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </li>
        </ul>
      </section>
      <p className="community-motto">
        INDEPENDENT MUSIC. INDEPENDENT PEOPLE. WE ARE FFG.
      </p>
    </footer>
  );
}
