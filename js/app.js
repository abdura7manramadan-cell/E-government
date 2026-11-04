// ======================================
// E-GOVERNMENT - Main Application
// ======================================

document.addEventListener("DOMContentLoaded", function () {

    // 1. Mobile navigation
    const menuButton = document.querySelector(".menu-toggle");
    const navbar = document.querySelector(".navbar");

    if (menuButton && navbar) {
        menuButton.addEventListener("click", function () {
            navbar.classList.toggle("active");

            const isOpen = navbar.classList.contains("active");
            menuButton.setAttribute("aria-expanded", isOpen);
        });
    }

    // 2. Language selector
    const languageSelectors = document.querySelectorAll(
        ".language-select, #language"
    );

    languageSelectors.forEach(function (selector) {
        selector.addEventListener("change", function () {
            if (typeof changeLanguage === "function") {
                changeLanguage(this.value);
            }
        });
    });

    // 3. Website search
    const searchInputs = document.querySelectorAll("[data-search-input]");

    searchInputs.forEach(function (input) {
        input.addEventListener("input", function () {
            const searchText = this.value.trim().toLowerCase();
            const target = this.dataset.searchTarget || "[data-searchable]";
            const items = document.querySelectorAll(target);

            items.forEach(function (item) {
                const content = item.textContent.toLowerCase();
                item.style.display = content.includes(searchText) ? "" : "none";
            });
        });
    });

    // 4. Demo forms
    const demoForms = document.querySelectorAll("[data-demo-form]");

    demoForms.forEach(function (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            showToast(
                "تم استلام البيانات التجريبية. النظام غير مرتبط حالياً بقاعدة بيانات.",
                "info"
            );

            form.reset();
        });
    });

    // 5. Close mobile menu after clicking a link
    if (navbar) {
        const navLinks = navbar.querySelectorAll("a");

        navLinks.forEach(function (link) {
            link.addEventListener("click", function () {
                navbar.classList.remove("active");

                if (menuButton) {
                    menuButton.setAttribute("aria-expanded", "false");
                }
            });
        });
    }

    // 6. Automatic current year
    document.querySelectorAll("[data-current-year]").forEach(function (element) {
        element.textContent = new Date().getFullYear();
    });

});


// ======================================
// Notification Message
// ======================================

function showToast(message, type = "success") {

    let toast = document.getElementById("app-toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "app-toast";

        toast.style.cssText = `
            position: fixed;
            bottom: 25px;
            right: 20px;
            max-width: 350px;
            padding: 15px 20px;
            background: #10243a;
            color: white;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 1.7;
            z-index: 9999;
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        document.body.appendChild(toast);
    }

    toast.textContent = message;

    toast.style.borderRight =
        type === "error"
            ? "4px solid #dc3545"
            : "4px solid #d4af37";

    toast.style.opacity = "1";

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(function () {
        toast.style.opacity = "0";
    }, 4000);
}