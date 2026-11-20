/*
 * Doublure — comportements de la page.
 *
 * 1. Configuration
 * 2. Langues (fr / en / es)
 * 3. Utilitaires
 * 4. Actions des boutons
 * 5. Navigation adaptative (thème au scroll)
 * 6. Tilt de l'orbe
 * 7. Navigation mobile
 * 8. Consentement et mesure d'audience
 * 9. Formulaire de contact
 * 10. Animations au scroll
 * 11. Initialisation
 *
 * Le contenu français est écrit dans le HTML : la page reste lisible même si
 * le JSON de traduction ne charge pas (ouverture en file://, par exemple).
 */

/* 1. CONFIGURATION */

const TRANSLATION_FILE_PATH = document.body.dataset.translationPath || "json/translation.json";
const CONTACT_EMAIL = "nicolas.speich@gmail.com";
const WHATSAPP_NUMBER = "33665110338";
const WHATSAPP_DEFAULT_MESSAGE =
    "Bonjour, je souhaite une démonstration de Doublure sur mes propres messages.";
const SUPPORTED_LANGUAGES = ["fr", "en", "es"];
const DEFAULT_LANGUAGE = "fr";
const LANGUAGE_STORAGE_KEY = "doublure.lang";

/* Mesure d'audience : aucun script n'est chargé sans consentement, et rien
 * n'est chargé du tout tant que `domain` est vide. Aucune clé secrète ne doit
 * figurer ici : un site statique est entièrement public. */
const ANALYTICS = {
    provider: "plausible",
    domain: "",
    scriptUrl: "https://plausible.io/js/script.js",
};
const CONSENT_STORAGE_KEY = "doublure.consent";
const FORM_MIN_SECONDS = 3;

/* HTTPS forcé : un site servi en http:// bascule sur https://. */
(function enforceHttps() {
    if (location.protocol !== "http:") {
        return;
    }
    const host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
        return;
    }
    location.replace(`https://${location.host}${location.pathname}${location.search}${location.hash}`);
})();

let translations = null;
let currentLanguage = DEFAULT_LANGUAGE;

/* 2. LANGUES */

function normalizeLanguage(value) {
    if (!value) {
        return null;
    }
    const base = value.toLowerCase().split("-")[0];
    return SUPPORTED_LANGUAGES.includes(base) ? base : null;
}

function detectLanguage() {
    let stored = null;
    try {
        stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch (error) {
        /* mode privé : on ignore */
    }
    const normalizedStored = normalizeLanguage(stored);
    if (normalizedStored) {
        return normalizedStored;
    }

    const candidates = navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language];
    for (const candidate of candidates) {
        const match = normalizeLanguage(candidate);
        if (match) {
            return match;
        }
    }
    return DEFAULT_LANGUAGE;
}

async function loadTranslations() {
    try {
        const response = await fetch(TRANSLATION_FILE_PATH);
        if (!response.ok) {
            throw new Error(`Impossible de charger ${TRANSLATION_FILE_PATH}`);
        }
        translations = await response.json();
    } catch (error) {
        console.error("Traductions indisponibles :", error);
        translations = null;
    }
}

function getNestedValue(object, path) {
    return path.split(".").reduce((value, key) => value?.[key], object);
}

function t(key) {
    const dictionary = translations?.[currentLanguage] || translations?.[DEFAULT_LANGUAGE];
    return getNestedValue(dictionary, key) || "";
}

function applyTranslations() {
    const dictionary = translations?.[currentLanguage] || translations?.[DEFAULT_LANGUAGE];
    if (!dictionary) {
        return;
    }

    document.querySelectorAll("[data-i18n]").forEach((element) => {
        const text = getNestedValue(dictionary, element.dataset.i18n);
        if (typeof text === "string") {
            element.textContent = text;
        }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
        const text = getNestedValue(dictionary, element.dataset.i18nPlaceholder);
        if (typeof text === "string") {
            element.setAttribute("placeholder", text);
        }
    });
}

function syncLanguageSwitch() {
    document.querySelectorAll("[data-lang]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.lang === currentLanguage));
    });
}

function setLanguage(language, { persist = true } = {}) {
    currentLanguage = normalizeLanguage(language) || DEFAULT_LANGUAGE;
    document.documentElement.lang = currentLanguage;
    applyTranslations();
    syncLanguageSwitch();

    if (persist) {
        try {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
        } catch (error) {
            /* mode privé : on ignore */
        }
    }
}

function initializeLanguageSwitch() {
    document.querySelectorAll("[data-lang]").forEach((button) => {
        button.addEventListener("click", () => setLanguage(button.dataset.lang));
    });
}

/* 3. UTILITAIRES */

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToElement(selector) {
    const target = document.querySelector(selector);
    if (!target) {
        return;
    }
    target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start"
    });
}

/* 4. ACTIONS */

function goToTop() {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function openEmail() {
    window.location.href = `mailto:${CONTACT_EMAIL}`;
}

function openWhatsApp() {
    const encodedMessage = encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, "_blank", "noopener,noreferrer");
}

function openConsentBanner() {
    const banner = document.querySelector("[data-cookie-banner]");
    if (!banner) {
        return;
    }
    banner.hidden = false;
    banner.querySelector("[data-consent]")
        ?.focus?.();
}

const actions = {
    top: goToTop,
    email: openEmail,
    whatsapp: openWhatsApp,
    consent: openConsentBanner
};

function initializeActions(parent = document) {
    parent.querySelectorAll("[data-action]").forEach((element) => {
        const action = actions[element.dataset.action];
        if (!action || element.dataset.actionInitialized === "true") {
            return;
        }
        element.addEventListener("click", (event) => {
            event.preventDefault();
            action();
        });
        element.dataset.actionInitialized = "true";
    });
}

/* 5. NAVIGATION ADAPTATIVE
 * Chaque section porte data-nav-theme="dark" ou "light" : dès qu'elle passe
 * sous la barre, celle-ci prend le thème correspondant.
 */

function initAdaptiveNav() {
    const header = document.querySelector(".header");
    const themedSections = document.querySelectorAll("[data-nav-theme]");

    if (!header || themedSections.length === 0 || !("IntersectionObserver" in window)) {
        return;
    }

    const navHeight = header.offsetHeight;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    header.dataset.theme = entry.target.dataset.navTheme;
                }
            });
        },
        {
            rootMargin: `-${navHeight + 1}px 0px -70% 0px`,
            threshold: 0
        }
    );

    themedSections.forEach((section) => observer.observe(section));
}

/* 6. TILT DE L'ORBE */

function initOrbTilt() {
    const heroVisual = document.querySelector(".hero-visual");
    const orb = document.querySelector("#aiOrb");

    if (!heroVisual || !orb) {
        return;
    }
    if (prefersReducedMotion() || !window.matchMedia("(hover: hover)").matches) {
        return;
    }

    const MAX_TILT_DEGREES = 6;

    heroVisual.addEventListener("mousemove", (event) => {
        const bounds = heroVisual.getBoundingClientRect();
        const relativeX = (event.clientX - bounds.left) / bounds.width - 0.5;
        const relativeY = (event.clientY - bounds.top) / bounds.height - 0.5;

        const rotateY = relativeX * MAX_TILT_DEGREES * 2;
        const rotateX = relativeY * -MAX_TILT_DEGREES * 2;

        orb.style.transform = `translate(-50%, -50%) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    heroVisual.addEventListener("mouseleave", () => {
        orb.style.transform = "translate(-50%, -50%) rotateX(0deg) rotateY(0deg)";
    });
}

/* 7. NAVIGATION MOBILE */

function initMobileNav() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const navigation = document.querySelector(".navigation");

    if (!toggle || !navigation) {
        return;
    }

    navigation.dataset.open = "false";
    toggle.setAttribute("aria-expanded", "false");

    function setOpen(open) {
        navigation.dataset.open = String(open);
        toggle.setAttribute("aria-expanded", String(open));
    }

    toggle.addEventListener("click", () => {
        setOpen(navigation.dataset.open !== "true");
    });

    navigation.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            setOpen(false);
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 1024) {
            setOpen(false);
        }
    });
}

/* 8. CONSENTEMENT ET MESURE D'AUDIENCE */

function readConsent() {
    try {
        return localStorage.getItem(CONSENT_STORAGE_KEY);
    } catch (error) {
        return null;
    }
}

function loadAnalytics() {
    if (ANALYTICS.provider !== "plausible" || !ANALYTICS.domain) {
        return;
    }
    if (document.querySelector("script[data-analytics]")) {
        return;
    }

    const script = document.createElement("script");
    script.src = ANALYTICS.scriptUrl;
    script.defer = true;
    script.dataset.analytics = "true";
    script.setAttribute("data-domain", ANALYTICS.domain);
    document.head.appendChild(script);
}

function initConsentBanner() {
    const banner = document.querySelector("[data-cookie-banner]");
    const consent = readConsent();

    if (consent === "granted") {
        loadAnalytics();
    }

    if (!banner) {
        return;
    }

    if (consent) {
        banner.hidden = true;
        return;
    }

    banner.hidden = false;

    banner.querySelectorAll("[data-consent]").forEach((button) => {
        button.addEventListener("click", () => {
            const granted = button.dataset.consent === "granted";
            try {
                localStorage.setItem(CONSENT_STORAGE_KEY, granted ? "granted" : "denied");
            } catch (error) {
                /* mode privé : on ignore */
            }
            banner.hidden = true;
            if (granted) {
                loadAnalytics();
            }
        });
    });
}

/* 9. FORMULAIRE DE CONTACT */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function setFieldError(form, field, message) {
    const errorElement = form.querySelector(`[data-error-for="${field}"]`);
    const input = form.querySelector(`[name="${field}"]`);

    if (errorElement) {
        errorElement.textContent = message || "";
    }
    if (input) {
        if (message) {
            input.setAttribute("aria-invalid", "true");
        } else {
            input.removeAttribute("aria-invalid");
        }
    }
}

function buildMailto({ name, email, message }) {
    const subject = `Doublure — ${name}`;
    const body = `${name}\n${email}\n\n${message}`;
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function initContactForm() {
    const form = document.querySelector("[data-contact-form]");
    if (!form) {
        return;
    }

    const startedAt = Date.now();
    const status = form.querySelector("[data-form-status]");

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const name = form.name.value.trim();
        const email = form.email.value.trim();
        const message = form.message.value.trim();
        const consent = form.consent.checked;
        const honey = form.company_website.value;

        /* Anti-spam : champ appât rempli ou envoi instantané = robot. On affiche
         * le message de confirmation sans rien envoyer. */
        if (honey !== "" || (Date.now() - startedAt) / 1000 < FORM_MIN_SECONDS) {
            if (status) {
                status.textContent = t("contact.form.success");
            }
            form.reset();
            return;
        }

        let firstInvalid = null;

        setFieldError(form, "name", name.length < 2 ? t("contact.form.errorName") : "");
        if (name.length < 2) {
            firstInvalid = firstInvalid || form.name;
        }

        setFieldError(form, "email", EMAIL_PATTERN.test(email) ? "" : t("contact.form.errorEmail"));
        if (!EMAIL_PATTERN.test(email)) {
            firstInvalid = firstInvalid || form.email;
        }

        setFieldError(form, "message", message.length < 20 ? t("contact.form.errorMessage") : "");
        if (message.length < 20) {
            firstInvalid = firstInvalid || form.message;
        }

        setFieldError(form, "consent", consent ? "" : t("contact.form.errorConsent"));
        if (!consent) {
            firstInvalid = firstInvalid || form.consent;
        }

        if (firstInvalid) {
            if (status) {
                status.textContent = "";
            }
            firstInvalid.focus();
            return;
        }

        window.location.href = buildMailto({ name, email, message });
        if (status) {
            status.textContent = t("contact.form.success");
        }
    });
}

/* 10. ANIMATIONS AU SCROLL */

function initRevealAnimations() {
    const elements = document.querySelectorAll("[data-reveal]");
    if (elements.length === 0 || prefersReducedMotion() || !("IntersectionObserver" in window)) {
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15 }
    );

    elements.forEach((element) => {
        element.classList.add("reveal");
        observer.observe(element);
    });
}

function setCurrentYear() {
    const yearElement = document.querySelector("#current-year");
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

/* 11. INITIALISATION */

document.addEventListener("DOMContentLoaded", async () => {
    currentLanguage = detectLanguage();
    await loadTranslations();
    setLanguage(currentLanguage, { persist: false });

    initializeLanguageSwitch();
    initializeActions();
    initMobileNav();
    initConsentBanner();
    initContactForm();
    initAdaptiveNav();
    initOrbTilt();
    initRevealAnimations();
    setCurrentYear();
});
