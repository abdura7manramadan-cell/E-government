/* Demonstration only: reports stay in this browser and are not sent to an agency. */
(function () {
    const storageKey = "krgDemoReports";
    const form = document.getElementById("reportForm");
    const result = document.getElementById("reportResult");
    const trackForm = document.getElementById("trackForm");
    const trackingResult = document.getElementById("trackingResult");
    const photoInput = document.getElementById("reportPhoto");
    const photoPreview = document.getElementById("reportPhotoPreview");
    let photoData = "";

    const messages = {
        ar: { saved: "تم حفظ البلاغ على هذا الجهاز.", tracking: "رقم المتابعة:", status: "الحالة: نموذج تجريبي محفوظ محلياً.", failed: "تعذر الحفظ في المتصفح. تأكد من تفعيل التخزين المحلي، ثم حاول مرة أخرى.", found: "البلاغ", notFound: "ما لقينا هذا الرقم ضمن البلاغات المحفوظة على هذا الجهاز." },
        en: { saved: "The report was saved on this device.", tracking: "Tracking number:", status: "Status: demonstration report saved locally.", failed: "The browser could not save this report. Enable local storage and try again.", found: "Report", notFound: "This number was not found among reports saved on this device." },
        ku: { saved: "ڕاپۆرتەکە لەم ئامێرە پاشەکەوت کرا.", tracking: "ژمارەی پەیڕەوکردن:", status: "دۆخ: ڕاپۆرتی تاقیکاری بە شێوەی ناوخۆیی پاشەکەوت کرا.", failed: "وێبگەڕ نەیتوانی ڕاپۆرتەکە پاشەکەوت بکات. پاشەکەوتکردنی ناوخۆیی چالاک بکە و دووبارە هەوڵ بدەرەوە.", found: "ڕاپۆرت", notFound: "ئەم ژمارەیە لە ڕاپۆرتە پاشەکەوتکراوەکانی ئەم ئامێرەدا نەدۆزرایەوە." }
    };
    function localizedMessages() { return messages[localStorage.getItem("preferredLanguage") || "ar"] || messages.ar; }

    function readReports() {
        try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); }
        catch (_) { return []; }
    }

    if (photoInput && photoPreview) {
        photoInput.addEventListener("change", function () {
            const file = photoInput.files && photoInput.files[0];
            photoData = "";
            photoPreview.hidden = true;
            if (!file) return;
            if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
                photoInput.value = "";
                alert("يرجى اختيار صورة لا يتجاوز حجمها 2 ميغابايت.");
                return;
            }
            const reader = new FileReader();
            reader.onload = function () { photoData = reader.result; photoPreview.src = photoData; photoPreview.hidden = false; };
            reader.readAsDataURL(file);
        });
    }

    if (form && result) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            if (!form.reportValidity()) return;

            const data = new FormData(form);
            const reference = "KRG-" + new Date().getFullYear() + "-" + Math.floor(100000 + Math.random() * 900000);
            const report = {
                reference,
                type: data.get("type"),
                city: data.get("city"),
                department: data.get("department"),
                description: data.get("description").trim(),
                photo: photoData,
                createdAt: new Date().toISOString(),
                status: localizedMessages().status
            };

            try {
                const reports = readReports();
                reports.push(report);
                localStorage.setItem(storageKey, JSON.stringify(reports));
                result.replaceChildren();
                const saved = document.createElement("strong"); saved.textContent = localizedMessages().saved; result.append(saved, document.createElement("br"));
                result.append(document.createTextNode(localizedMessages().tracking + " "));
                const code = document.createElement("b"); code.textContent = reference; result.append(code, document.createElement("br"));
                result.append(document.createTextNode(report.status));
                if (report.photo) {
                    const image = document.createElement("img");
                    image.src = report.photo; image.alt = "صورة مرفقة بالبلاغ";
                    image.style.cssText = "display:block;max-width:100%;max-height:240px;border-radius:12px;margin-top:12px";
                    result.append(image);
                }
                result.hidden = false;
                form.reset();
                photoData = "";
                if (photoPreview) { photoPreview.src = ""; photoPreview.hidden = true; }
            } catch (_) {
                result.textContent = localizedMessages().failed;
                result.hidden = false;
            }
        });
    }

    if (trackForm && trackingResult) {
        trackForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const reference = document.getElementById("trackingNumber").value.trim().toUpperCase();
            const report = readReports().find(function (item) { return item.reference === reference; });
            const text = localizedMessages();
            trackingResult.textContent = report
                ? text.found + " " + report.reference + " — " + report.type + ", " + report.city + ". " + report.status
                : text.notFound;
        });
    }
}());
