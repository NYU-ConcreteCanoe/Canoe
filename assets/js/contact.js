/* ==============================================
   NYU CONCRETE CANOE - CONTACT FORM
   Progressive enhancement over a plain form POST.
   Without this file the form still submits normally
   and Web3Forms shows its own confirmation page; this
   only upgrades it to submit in place.
   ============================================== */

(function () {
  "use strict";

  var form = document.getElementById("contactForm");
  if (!form) return;

  var button = document.getElementById("contactSubmit");
  var status = document.getElementById("contactStatus");
  var buttonText = button ? button.textContent.trim() : "Send Message";

  function setStatus(message, ok) {
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.classList.toggle("is-error", !ok);
    status.classList.toggle("is-success", !!ok);
    // Live regions alone are inconsistently announced, so move focus too.
    status.focus();
  }

  form.addEventListener("submit", function (e) {
    // If the access key was never filled in, fall through to a normal POST
    // rather than silently failing. Web3Forms will show a clear error.
    var key = form.querySelector('input[name="access_key"]');
    if (!key || /REPLACE-WITH/.test(key.value)) {
      console.warn("Contact form: Web3Forms access_key is not set.");
      return;
    }

    e.preventDefault();

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    fetch(form.action, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok && data.success, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          form.reset();
          setStatus(
            "Thanks. Your message has been sent, and we will reply to the address you gave.",
            true,
          );
        } else {
          setStatus(
            "Sorry, that did not send. Please email us directly at nyuconcretecanoe@gmail.com.",
            false,
          );
        }
      })
      .catch(function () {
        setStatus(
          "Sorry, that did not send. Please check your connection, or email us directly at nyuconcretecanoe@gmail.com.",
          false,
        );
      })
      .finally(function () {
        if (button) {
          button.disabled = false;
          button.textContent = buttonText;
        }
      });
  });
})();
