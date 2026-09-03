"use client";

import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal-on-scroll")
    );

    const mobileMenus = Array.from(
      document.querySelectorAll<HTMLElement>(".mobile-menu")
    );

    const closeMenus = () => {
      mobileMenus.forEach((menu) => {
        if (menu instanceof HTMLDetailsElement) {
          menu.open = false;
        }
      });
    };

    const menuLinks = Array.from(
      document.querySelectorAll<HTMLElement>(".mobile-menu-panel a")
    );

    menuLinks.forEach((link) => {
      link.addEventListener("click", closeMenus);
    });

    if (nodes.length) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("revealed");
              observer.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.14,
          rootMargin: "0px 0px -8% 0px",
        }
      );

      nodes.forEach((node, index) => {
        node.style.transitionDelay = `${Math.min(index * 60, 240)}ms`;
        if (node.classList.contains("revealed")) return;
        observer.observe(node);
      });

      return () => {
        observer.disconnect();
        menuLinks.forEach((link) => {
          link.removeEventListener("click", closeMenus);
        });
      };
    }

    return () => {
      menuLinks.forEach((link) => {
        link.removeEventListener("click", closeMenus);
      });
    };
  }, []);

  return null;
}
